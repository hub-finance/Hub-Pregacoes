import { db } from './db/db';
import { forgetMemoryCache } from './bible/repository';
import { downloadBlob } from './share/share';

/**
 * Backup e portabilidade (seção 21 da especificação).
 * O usuário é dono dos seus dados: exportação completa, restauração e exclusão.
 *
 * As traduções **embutidas** não entram: são reconstituíveis a partir do próprio
 * aplicativo, e incluí-las só engordaria o arquivo. As **importadas** entram
 * quando o usuário pede — ver `includeTranslations` abaixo.
 */

export const BACKUP_VERSION = 2;

/** Texto de uma tradução importada, para viajar junto com os dados do usuário. */
export interface BackupTranslations {
  /** Registros de `settings` com a chave `translation:meta:*`. */
  meta: unknown[];
  /** Registros de `books` das traduções importadas. */
  books: unknown[];
}

export interface BackupFile {
  app: 'hub-bible';
  version: number;
  exportedAt: string;
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
  settings?: unknown;
  /**
   * Bíblias importadas pelo usuário, quando ele pede para levá-las.
   *
   * Isto é a **cópia dele indo do aparelho dele para o aparelho dele** — o
   * mesmo princípio da importação. Não muda a regra do projeto: nada de texto
   * protegido entra no que é publicado, e este arquivo é gerado no aparelho,
   * não distribuído com o aplicativo.
   */
  translations?: BackupTranslations;
  /**
   * O resto do aparelho, quando o usuário pede a cópia completa: os arquivos
   * importados (PDF, Word, apresentações), o Assistente bíblico, os
   * dicionários e comentários importados e as análises do Estudo guiado.
   */
  extra?: BackupExtra;
}

export interface BackupExtra {
  /** Arquivos importados, com o conteúdo em base64. */
  attachments: unknown[];
  dictionaries: unknown[];
  dictionaryEntries: unknown[];
  commentaries: unknown[];
  commentaryEntries: unknown[];
  aiAnalyses: unknown[];
  /** Registros de `settings` que são dados do usuário (assistente, base doutrinária…). */
  settings: unknown[];
}

export interface BackupOptions {
  /**
   * Levar também as Bíblias importadas. Custa caro em tamanho — uma tradução
   * passa de 4 MB, e com números Strong pode triplicar — então é escolha
   * explícita, não padrão.
   */
  includeTranslations?: boolean;
  /**
   * Levar tudo o que está no aparelho (ver `BackupExtra`). É o que permite
   * passar do tablet para o notebook sem reimportar nada.
   */
  complete?: boolean;
  /**
   * O que levar, escolhido pelo usuário item por item. Os textos dele
   * (sermões, anotações, Rhema, cursos, planos…) vão sempre.
   */
  parts?: Partial<Record<BackupPart, boolean>>;
}

/** Os tipos de coisa que o usuário escolhe levar ou não. */
export type BackupPart = 'sermons' | 'courses' | 'bibles' | 'files' | 'assistant' | 'doctrinal' | 'dictionaries' | 'appearance';

export const BACKUP_PARTS: Array<{ id: BackupPart; label: string; hint: string; off?: boolean }> = [
  { id: 'sermons', label: 'Sermões (Gerador)', hint: 'Os sermões do Gerador, com os arquivos importados neles.', off: true },
  { id: 'courses', label: 'Cursos', hint: 'Os cursos, com os arquivos de aula importados neles.', off: true },
  { id: 'bibles', label: 'Bíblias importadas', hint: 'Todas as traduções que você importou (as que vêm com o app o outro aparelho já tem).' },
  { id: 'files', label: 'Apostilas do Rhema (arquivos)', hint: 'Os PDF e Word das apostilas do Rhema — os que abrem no Modo Aula.' },
  { id: 'assistant', label: 'Assistente bíblico', hint: 'Conversas, documentos montados, materiais importados e as análises do Estudo guiado.' },
  { id: 'doctrinal', label: 'Base doutrinária', hint: 'A base que você importou para os Guias e o assistente.' },
  { id: 'dictionaries', label: 'Dicionários e comentários importados', hint: 'Os arquivos .SQLite3 ou JSON que você importou.' },
  { id: 'appearance', label: 'Configurações', hint: 'Tema, letra, tamanho e as demais escolhas do app.' },
];

/** O que entra, conforme as opções (o "complete" antigo vale como tudo marcado). */
function wants(options: BackupOptions, part: BackupPart): boolean {
  if (options.complete) return true;
  if (options.parts) return !!options.parts[part];
  if (part === 'bibles') return !!options.includeTranslations;
  // as cópias automáticas guardam sempre os sermões e os cursos
  return part === 'appearance' || part === 'sermons' || part === 'courses';
}

/** A tabela de cada parte escolhível dos textos: sermões e cursos (`devotionals`). */
const PART_TABLE: Partial<Record<(typeof TABLES)[number], BackupPart>> = { sermons: 'sermons', devotionals: 'courses' };


const EXTRA_TABLES = ['dictionaries', 'dictionaryEntries', 'commentaries', 'commentaryEntries', 'aiAnalyses'] as const;

/* Um arquivo (Blob) não cabe em JSON: vai como base64 e volta como Blob. */
interface PackedBlob { __blob: string; type: string }

async function packBlob(blob: Blob): Promise<PackedBlob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return { __blob: btoa(binary), type: blob.type };
}

function unpackBlob(packed: PackedBlob): Blob {
  const binary = atob(packed.__blob);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: packed.type });
}

const isPacked = (v: unknown): v is PackedBlob => !!v && typeof v === 'object' && typeof (v as PackedBlob).__blob === 'string';

/** De quem é cada arquivo: do Rhema, de um sermão ou de um curso. */
async function attachmentOwners(): Promise<{ sermons: Set<string>; courses: Set<string> }> {
  return {
    sermons: new Set((await db.sermons.toCollection().primaryKeys()) as string[]),
    courses: new Set((await db.devotionals.toCollection().primaryKeys()) as string[]),
  };
}

async function collectExtra(want: (part: BackupPart) => boolean): Promise<BackupExtra> {
  const packed = [];
  const owners = await attachmentOwners();
  // cada arquivo vai junto com a parte a que pertence
  const takeFile = (docId: string) =>
    owners.sermons.has(docId) ? want('sermons') : owners.courses.has(docId) ? want('courses') : want('files');
  for (const a of await db.attachments.toArray()) {
    if (takeFile(a.docId)) packed.push({ ...a, blob: a.blob instanceof Blob ? await packBlob(a.blob) : a.blob });
  }
  const extra = { attachments: packed, settings: [] as unknown[] } as BackupExtra;
  for (const name of EXTRA_TABLES) {
    const take = name === 'aiAnalyses' ? want('assistant') : want('dictionaries');
    extra[name] = take ? await db.table(name).toArray() : [];
  }
  // só registros do usuário; marcas internas (reparos, caches) o app refaz.
  // `export:` e `book:` são pequenos e vão sempre que há "extra"
  const prefixes = ['export:', 'book:', ...(want('assistant') ? ['assistant:'] : []), ...(want('doctrinal') ? ['doctrinal-pack'] : [])];
  const all = await db.settings.toArray();
  extra.settings = all.filter((r) => prefixes.some((p) => r.key.startsWith(p)));
  return extra;
}

export interface PartSize { bytes: number; detail: string }

/**
 * Quanto cada tipo ocupa no arquivo, para a tela mostrar antes de exportar.
 * É uma estimativa (o JSON de cada parte), boa para dizer o que pesa.
 */
export async function estimateBackupParts(): Promise<Record<BackupPart, PartSize>> {
  const json = (v: unknown) => JSON.stringify(v ?? null).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const metas = await db.settings.where('key').startsWith('translation:meta:').toArray();
  const ids = metas.map((r) => r.key.replace('translation:meta:', ''));
  let bibleBytes = 0;
  if (ids.length) await db.books.where('translation').anyOf(ids).each((b) => { bibleBytes += json(b); });

  const atts = await db.attachments.toArray();
  const owners = await attachmentOwners();
  const fileSize = (a: (typeof atts)[number]) => Math.ceil((a.size || a.blob?.size || 0) * 1.37);
  const rhemaFiles = atts.filter((a) => !owners.sermons.has(a.docId) && !owners.courses.has(a.docId));
  const fileBytes = rhemaFiles.reduce((n, a) => n + fileSize(a), 0);
  const ownBytes = (ids: Set<string>) => atts.filter((a) => ids.has(a.docId)).reduce((n, a) => n + fileSize(a), 0);
  const sermons = await db.sermons.toArray();
  const courses = await db.devotionals.toArray();

  const rows = await db.settings.toArray();
  const conv = rows.find((r) => r.key === 'assistant:conversations')?.value;
  const mats = rows.find((r) => r.key === 'assistant:materials')?.value;
  const assistantBytes = rows.filter((r) => r.key.startsWith('assistant:')).reduce((n, r) => n + json(r), 0)
    + json(await db.aiAnalyses.toArray());
  const pack = rows.find((r) => r.key === 'doctrinal-pack');

  const dicts = await db.dictionaries.count();
  const coms = await db.commentaries.count();
  // os verbetes podem ser dezenas de milhares: mede uma amostra e multiplica
  const sample = async (table: string) => {
    const total = await db.table(table).count();
    if (!total) return 0;
    const some = await db.table(table).limit(200).toArray();
    return Math.round((json(some) / some.length) * total);
  };
  const dictBytes = (await sample('dictionaryEntries')) + (await sample('commentaryEntries'));

  const nConv = Array.isArray(conv) ? conv.length : 0;
  const nMat = Array.isArray(mats) ? mats.length : 0;
  return {
    bibles: { bytes: bibleBytes, detail: ids.length ? plural(ids.length, 'Bíblia', 'Bíblias') : 'nenhuma importada' },
    sermons: { bytes: json(sermons) + ownBytes(owners.sermons), detail: sermons.length ? plural(sermons.length, 'sermão', 'sermões') : 'nenhum' },
    courses: { bytes: json(courses) + ownBytes(owners.courses), detail: courses.length ? plural(courses.length, 'curso', 'cursos') : 'nenhum' },
    files: { bytes: fileBytes, detail: rhemaFiles.length ? plural(rhemaFiles.length, 'arquivo', 'arquivos') : 'nenhum arquivo' },
    assistant: { bytes: assistantBytes, detail: nConv || nMat ? `${plural(nConv, 'conversa', 'conversas')} e ${plural(nMat, 'material', 'materiais')}` : 'nada ainda' },
    doctrinal: { bytes: pack ? json(pack) : 0, detail: pack ? 'importada' : 'nenhuma importada' },
    dictionaries: { bytes: dictBytes, detail: dicts || coms ? `${plural(dicts, 'dicionário', 'dicionários')} e ${plural(coms, 'comentário', 'comentários')}` : 'nenhum importado' },
    appearance: { bytes: 2000, detail: 'tema, letra e tamanho' },
  };
}

const TABLES = [
  'favorites',
  'highlights',
  'notes',
  'sermons',
  'studies',
  'devotionals',
  'libraryDocs',
  'plans',
  'readingEvents',
  // Documentos de exportação e suas versões aprovadas. Os arquivos gerados
  // (`exportFiles`) ficam de fora: são binários, e qualquer um deles pode ser
  // gerado de novo a partir da versão guardada aqui.
  'exportDocs',
  'exportVersions',
] as const;

export async function createBackup(
  settings?: unknown,
  options: BackupOptions = {},
): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const name of TABLES) {
    // parte desmarcada fica fora do arquivo (e não vazia): assim restaurar
    // não apaga os sermões ou cursos que já existam no outro aparelho
    const part = PART_TABLE[name];
    if (part && !wants(options, part)) continue;
    const rows = await db.table(name).toArray();
    data[name] = rows;
    counts[name] = rows.length;
  }

  const backup: BackupFile = {
    app: 'hub-bible',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    data,
    settings: wants(options, 'appearance') ? settings : undefined,
  };

  const want = (part: BackupPart) => wants(options, part);
  if (want('files') || want('assistant') || want('doctrinal') || want('dictionaries') || (options.parts && (want('sermons') || want('courses')))) {
    const extra = await collectExtra(want);
    backup.extra = extra;
    counts.attachments = extra.attachments.length;
    counts.dictionaries = extra.dictionaries.length;
    counts.commentaries = extra.commentaries.length;
    counts.aiAnalyses = extra.aiAnalyses.length;
    counts.userSettings = extra.settings.length;
  }

  if (want('bibles')) {
    const translations = await collectImportedTranslations();
    if (translations) {
      backup.translations = translations;
      counts.translations = translations.meta.length;
    }
  }

  return backup;
}

/**
 * Junta o texto das traduções importadas.
 *
 * Só as importadas: as que acompanham o aplicativo voltam sozinhas, e pô-las
 * aqui acrescentaria 20 MB sem necessidade nenhuma.
 */
async function collectImportedTranslations(): Promise<BackupTranslations | null> {
  const metaRows = await db.settings.where('key').startsWith('translation:meta:').toArray();
  if (!metaRows.length) return null;

  const ids = metaRows.map((r) => r.key.replace('translation:meta:', ''));
  const books = await db.books.where('translation').anyOf(ids).toArray();
  return { meta: metaRows, books };
}

export async function downloadBackup(
  settings?: unknown,
  options?: BackupOptions,
): Promise<BackupFile> {
  const backup = await createBackup(settings, options);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    `hub-bible-backup-${stamp}.json`,
  );
  return backup;
}

export interface RestoreResult {
  restored: Record<string, number>;
  settings?: unknown;
}

/**
 * Restaura um backup. `mode: 'merge'` preserva o que já existe (mesmo id é
 * sobrescrito); `mode: 'replace'` limpa as tabelas antes de gravar.
 */
export async function restoreBackup(
  file: unknown,
  mode: 'merge' | 'replace' = 'merge',
): Promise<RestoreResult> {
  const backup = file as BackupFile;
  if (!backup || backup.app !== 'hub-bible' || !backup.data) {
    throw new Error('Arquivo de backup inválido.');
  }
  const restored: Record<string, number> = {};
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      const rows = backup.data[name];
      if (!Array.isArray(rows)) continue;
      if (mode === 'replace') await db.table(name).clear();
      await db.table(name).bulkPut(rows);
      restored[name] = rows.length;
    }
  });

  /* As Bíblias importadas, quando o arquivo as trouxer. Ficam fora da
     transação acima porque são outras tabelas e o volume é bem maior: um erro
     aqui não pode desfazer a restauração dos sermões, que é o que importa. */
  const translations = backup.translations;
  if (translations?.meta?.length) {
    await db.transaction('rw', [db.settings, db.books], async () => {
      await db.settings.bulkPut(translations.meta as Parameters<typeof db.settings.bulkPut>[0]);
      await db.books.bulkPut(translations.books as Parameters<typeof db.books.bulkPut>[0]);
    });
    restored.translations = translations.meta.length;
    // o catálogo em memória guarda a lista antiga; sem isto elas não aparecem
    forgetMemoryCache();
  }

  /* O resto do aparelho, tabela por tabela: um dicionário que falhe não
     desfaz os arquivos das apostilas. */
  const extra = backup.extra;
  if (extra) {
    if (Array.isArray(extra.attachments) && extra.attachments.length) {
      const rows = extra.attachments.map((a) => {
        const row = a as Record<string, unknown>;
        return isPacked(row.blob) ? { ...row, blob: unpackBlob(row.blob) } : row;
      });
      await db.attachments.bulkPut(rows as unknown as Parameters<typeof db.attachments.bulkPut>[0]);
      restored.attachments = rows.length;
    }
    for (const name of EXTRA_TABLES) {
      const rows = extra[name];
      if (!Array.isArray(rows) || !rows.length) continue;
      await db.table(name).bulkPut(rows);
      restored[name] = rows.length;
    }
    if (Array.isArray(extra.settings) && extra.settings.length) {
      await db.settings.bulkPut(extra.settings as Parameters<typeof db.settings.bulkPut>[0]);
      restored.userSettings = extra.settings.length;
    }
  }

  return { restored, settings: backup.settings };
}

/* ------------------------- exportação de documentos ---------------------- */

export function exportAsMarkdown(filename: string, markdown: string): void {
  downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${filename}.md`);
}

export function exportAsText(filename: string, text: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filename}.txt`);
}

/**
 * Exportação para PDF via impressão do sistema (funciona no Android/Chrome sem
 * dependências) — o usuário escolhe "Salvar como PDF".
 */
export function exportAsPdf(title: string, html: string): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=820,height=1000');
  if (!win) {
    throw new Error('O navegador bloqueou a janela de impressão. Libere pop-ups para exportar.');
  }
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 22mm 18mm; }
  body { font: 12pt/1.6 Georgia, 'Times New Roman', serif; color: #14120f; }
  h1 { font-size: 20pt; margin: 0 0 4pt; color: #1f4e79; border-bottom: 2pt solid #8a6a2f; padding-bottom: 6pt; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; color: #6f5423; text-transform: uppercase; letter-spacing: .06em; }
  p { margin: 0 0 8pt; white-space: pre-wrap; }
  blockquote { margin: 8pt 0; padding: 6pt 12pt; border-left: 3px solid #8a6a2f; background: #faf6ee; }
  .meta { font-size: 10pt; color: #6b645b; margin-bottom: 16pt; font-family: system-ui, sans-serif; }
  /* sermão montado em blocos: no papel, o mesmo desenho que se vê ao escrever */
  .s-section { font-size: 13.5pt; margin: 16pt 0 7pt; color: #1f4e79; text-transform: none;
    letter-spacing: 0; border-bottom: 1pt solid #8a6a2f; padding-bottom: 3pt; page-break-after: avoid; }
  .s-text { white-space: normal; text-align: justify; }
  .s-highlight { margin: 10pt 0; padding: 8pt 12pt; background: #eef3f9; border-left: 3pt solid #1f4e79;
    page-break-inside: avoid; }
  .s-scripture { font-style: italic; }
  .s-scripture cite { display: block; margin-top: 4pt; text-align: right; font-style: normal;
    font-family: system-ui, sans-serif; font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #6f5423; }
  .s-list { margin: 0 0 8pt; }
  .s-list ul, .s-list ol { margin: 0; padding-left: 18pt; }
  .s-list li { margin-bottom: 3pt; }
  footer { margin-top: 24pt; font-size: 9pt; color: #8a837a; font-family: system-ui, sans-serif; }
</style></head><body>${html}<footer>Gerado pelo Farol da Palavra</footer></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lê um arquivo escolhido pelo usuário como JSON. */
export function readJsonFile<T = unknown>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as T);
      } catch {
        reject(new Error('O arquivo não é um JSON válido.'));
      }
    };
    reader.readAsText(file);
  });
}
