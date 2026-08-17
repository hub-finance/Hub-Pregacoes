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
}

export interface BackupOptions {
  /**
   * Levar também as Bíblias importadas. Custa caro em tamanho — uma tradução
   * passa de 4 MB, e com números Strong pode triplicar — então é escolha
   * explícita, não padrão.
   */
  includeTranslations?: boolean;
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
] as const;

export async function createBackup(
  settings?: unknown,
  options: BackupOptions = {},
): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const name of TABLES) {
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
    settings,
  };

  if (options.includeTranslations) {
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
</style></head><body>${html}<footer>Gerado pelo Hub Bible</footer></body></html>`);
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
