import { db, now, uid } from '../db/db';
import {
  LOCAL_USER,
  type ExportCategory,
  type ExportDoc,
  type ExportFile,
  type ExportLayout,
  type ExportSourceKind,
  type ExportStatus,
  type ExportStructure,
  type ExportVersion,
  type SermonBlock,
} from '../db/types';
import { BASE_LAYOUT, categoryById, layoutFor, modelById } from '../export/templates';
import { loadCompiled, loadSource } from '../export/sources';
import { EXPORT_THEMES, PAGE_MM } from '../export/themes';

/**
 * Documentos de exportação: rascunho, versões aprovadas e arquivos gerados.
 *
 * O caminho é sempre o mesmo — revisar, aprovar, gerar. Os arquivos saem da
 * **versão aprovada**, nunca do rascunho: assim o Word e o PDF de uma versão
 * são, garantidamente, do mesmo texto, e editar depois de aprovar não muda um
 * arquivo que já foi entregue.
 */

const PREFERRED_KEY = 'export:preferredLayout';

/* ------------------------------ validação ------------------------------- */

const LIMITS = {
  title: 200,
  blocks: 5000,
  /** Soma do HTML de todos os blocos. */
  html: 6 * 1024 * 1024,
  text: 300,
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
};

const cleanText = (value: unknown, max = LIMITS.text) =>
  // eslint-disable-next-line no-control-regex
  (typeof value === 'string' ? value : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);

/**
 * Normaliza o layout vindo da tela ou de um backup: valores fora da faixa são
 * trazidos para dentro dela, e o que não se reconhece volta ao padrão.
 */
export function normalizeLayout(input: Partial<ExportLayout> | undefined): ExportLayout {
  const l = { ...BASE_LAYOUT, ...(input ?? {}) };
  const logo =
    l.logo && /^data:image\/(png|jpeg);base64,/.test(l.logo.dataUrl) && l.logo.dataUrl.length < 3 * 1024 * 1024
      ? {
          dataUrl: l.logo.dataUrl,
          mime: l.logo.mime === 'image/png' ? ('image/png' as const) : ('image/jpeg' as const),
          width: clampNumber(l.logo.width, 1, 4000, 200),
          height: clampNumber(l.logo.height, 1, 4000, 200),
        }
      : undefined;
  return {
    theme: EXPORT_THEMES.some((t) => t.id === l.theme) ? l.theme : BASE_LAYOUT.theme,
    pageSize: l.pageSize in PAGE_MM ? l.pageSize : 'A4',
    margins: ['estreita', 'normal', 'larga'].includes(l.margins) ? l.margins : 'normal',
    fontSize: clampNumber(l.fontSize, 9, 16, BASE_LAYOUT.fontSize),
    lineSpacing: clampNumber(l.lineSpacing, 1, 2.2, BASE_LAYOUT.lineSpacing),
    accentColor: /^#[0-9a-f]{6}$/i.test(l.accentColor ?? '') ? l.accentColor : '',
    cover: !!l.cover,
    subtitle: cleanText(l.subtitle),
    author: cleanText(l.author, 120),
    institution: cleanText(l.institution, 160),
    dateLabel: cleanText(l.dateLabel, 80),
    logo,
    toc: !!l.toc,
    pageNumbers: !!l.pageNumbers,
    pageNumberAlign: l.pageNumberAlign === 'right' ? 'right' : 'center',
    header: cleanText(l.header, 160),
    footer: cleanText(l.footer, 160),
    breakBeforeSections: !!l.breakBeforeSections,
    notesSpace: !!l.notesSpace,
  };
}

/** Confere se o documento pode virar arquivo. Devolve o problema, ou `null`. */
export function validateForExport(input: { title: string; content: SermonBlock[] }): string | null {
  if (!input.title.trim()) return 'Dê um título ao documento antes de gerar o arquivo.';
  if (input.title.length > LIMITS.title) return `O título passou de ${LIMITS.title} caracteres.`;
  if (!Array.isArray(input.content) || !input.content.length) return 'O documento está sem conteúdo.';
  if (input.content.length > LIMITS.blocks) return 'O documento tem blocos demais para um arquivo só.';
  const total = input.content.reduce((n, b) => n + (b.html?.length ?? 0) + (b.reference?.length ?? 0), 0);
  if (total > LIMITS.html) return 'O conteúdo passou do tamanho máximo de um documento.';
  return null;
}

/* ------------------------------ assinatura ------------------------------ */

/** Impressão digital do que vai para o arquivo: título, blocos, estrutura e aparência. */
export function signatureOf(doc: Pick<ExportDoc, 'title' | 'content' | 'structure' | 'layout'>): string {
  const payload = JSON.stringify([
    doc.title,
    doc.content.map((b) => [b.id, b.type, b.html, b.reference ?? '']),
    doc.structure,
    doc.layout,
  ]);
  // FNV-1a de 32 bits, duas vezes em sentidos opostos: curto e suficiente
  // para dizer "mudou" — não é segurança, é comparação.
  let a = 0x811c9dc5;
  let b = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    a = Math.imul(a ^ payload.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ payload.charCodeAt(payload.length - 1 - i), 0x01000193) >>> 0;
  }
  return `${payload.length.toString(36)}-${a.toString(36)}-${b.toString(36)}`;
}

/** Situação do documento a partir do rascunho e da versão aprovada. */
async function statusOf(doc: ExportDoc): Promise<ExportStatus> {
  if (!doc.approvedVersion || doc.approvedSignature !== signatureOf(doc)) return 'rascunho';
  const files = await db.exportFiles
    .where('docId')
    .equals(doc.id)
    .filter((f) => f.version === doc.approvedVersion)
    .count();
  return files ? 'finalizado' : 'aprovado';
}

/* -------------------------------- leitura ------------------------------- */

export const getExportDoc = (id: string) => db.exportDocs.get(id);

export const listVersions = (docId: string) =>
  db.exportVersions.where('docId').equals(docId).reverse().sortBy('version');

export const listFiles = async (docId: string) =>
  (await db.exportFiles.where('docId').equals(docId).toArray()).sort((a, b) => b.createdAt - a.createdAt);

export async function getPreferredLayout(): Promise<Partial<ExportLayout> | null> {
  const row = await db.settings.get(PREFERRED_KEY);
  return (row?.value as Partial<ExportLayout> | undefined) ?? null;
}

/** Guarda a aparência atual como padrão dos próximos documentos. */
export async function savePreferredLayout(layout: ExportLayout): Promise<void> {
  const clean = normalizeLayout(layout);
  await db.settings.put({
    key: PREFERRED_KEY,
    value: {
      theme: clean.theme,
      pageSize: clean.pageSize,
      margins: clean.margins,
      fontSize: clean.fontSize,
      lineSpacing: clean.lineSpacing,
      accentColor: clean.accentColor,
      author: clean.author,
      institution: clean.institution,
      logo: clean.logo,
      header: clean.header,
      footer: clean.footer,
      pageNumberAlign: clean.pageNumberAlign,
    } satisfies Partial<ExportLayout>,
  });
}

/* -------------------------------- criação ------------------------------- */

export interface NewExportInput {
  category: ExportCategory;
  model: string;
  sourceKind: ExportSourceKind;
  sourceId?: string;
  /** Vários conteúdos num documento só, na ordem em que devem entrar. */
  sources?: Array<{ kind: ExportSourceKind; id: string }>;
  title?: string;
}

const cloneBlocks = (blocks: SermonBlock[]): SermonBlock[] => blocks.map((b) => ({ ...b }));
const emptyStructure = (): ExportStructure => ({ pageBreaks: [], subheadings: [], instructorOnly: [] });

export async function createExportDoc(input: NewExportInput): Promise<ExportDoc> {
  const category = categoryById(input.category).id;
  const modelDef = modelById(category, input.model);
  const model = modelDef.id;
  const compiled = input.sources && input.sources.length > 1 ? await loadCompiled(input.sources, modelDef.compile?.label) : null;
  const loaded = compiled ?? (await loadSource(input.sourceKind, input.sourceId));
  const layout = normalizeLayout(layoutFor(category, model, await getPreferredLayout()));
  // sugestões da própria origem (o tema da mensagem, a data dela); o autor revisa
  if (!layout.subtitle) layout.subtitle = cleanText(loaded.subtitle);
  if (!layout.dateLabel) layout.dateLabel = cleanText(loaded.dateLabel, 80);

  const t = now();
  const doc: ExportDoc = {
    id: uid('exp_'),
    userId: LOCAL_USER,
    title: cleanText(input.title?.trim() || loaded.source.title || 'Novo documento', LIMITS.title),
    category,
    model,
    source: loaded.source,
    status: 'rascunho',
    original: cloneBlocks(loaded.blocks),
    content: cloneBlocks(loaded.blocks),
    structure: { ...emptyStructure(), subheadings: compiled?.subheadings ?? [] },
    originalStructure: { ...emptyStructure(), subheadings: compiled?.subheadings ?? [] },
    layout,
    versionCount: 0,
    formats: [],
    createdAt: t,
    updatedAt: t,
  };
  await db.exportDocs.put(doc);
  return doc;
}

/* ------------------------------- rascunho ------------------------------- */

export type DraftPatch = Partial<Pick<ExportDoc, 'title' | 'content' | 'structure' | 'layout' | 'category' | 'model'>>;

/** Grava o rascunho. A situação é recalculada: editar depois de aprovar volta a rascunho. */
export async function saveDraft(id: string, patch: DraftPatch): Promise<ExportDoc> {
  const current = await db.exportDocs.get(id);
  if (!current) throw new Error('Documento não encontrado.');
  const next: ExportDoc = {
    ...current,
    ...patch,
    title: patch.title !== undefined ? cleanText(patch.title, LIMITS.title) : current.title,
    layout: patch.layout ? normalizeLayout(patch.layout) : current.layout,
    updatedAt: now(),
  };
  // estrutura só guarda ids de blocos que ainda existem
  const ids = new Set(next.content.map((b) => b.id));
  next.structure = {
    pageBreaks: next.structure.pageBreaks.filter((b) => ids.has(b)),
    subheadings: next.structure.subheadings.filter((b) => ids.has(b)),
    instructorOnly: (next.structure.instructorOnly ?? []).filter((b) => ids.has(b)),
  };
  next.status = await statusOf(next);
  await db.exportDocs.put(next);
  return next;
}

/* -------------------------------- versões ------------------------------- */

/** Aprova o rascunho atual como nova versão. É dela que os arquivos sairão. */
export async function approveVersion(id: string): Promise<{ doc: ExportDoc; version: ExportVersion }> {
  return db.transaction('rw', [db.exportDocs, db.exportVersions, db.exportFiles], async () => {
    const doc = await db.exportDocs.get(id);
    if (!doc) throw new Error('Documento não encontrado.');
    const problem = validateForExport(doc);
    if (problem) throw new Error(problem);
    const signature = signatureOf(doc);
    // aprovar duas vezes o mesmo conteúdo não cria versão repetida
    if (doc.approvedVersion && doc.approvedSignature === signature) {
      const existing = await db.exportVersions.where('[docId+version]').equals([id, doc.approvedVersion]).first();
      if (existing) return { doc, version: existing };
    }
    const version: ExportVersion = {
      id: uid('ver_'),
      docId: id,
      userId: doc.userId,
      version: doc.versionCount + 1,
      title: doc.title,
      content: cloneBlocks(doc.content),
      structure: {
        pageBreaks: [...doc.structure.pageBreaks],
        subheadings: [...doc.structure.subheadings],
        instructorOnly: [...(doc.structure.instructorOnly ?? [])],
      },
      layout: { ...doc.layout },
      createdAt: now(),
    };
    await db.exportVersions.put(version);
    const next: ExportDoc = {
      ...doc,
      versionCount: version.version,
      approvedVersion: version.version,
      approvedSignature: signature,
      status: 'aprovado',
      updatedAt: now(),
    };
    await db.exportDocs.put(next);
    return { doc: next, version };
  });
}

export async function getApprovedVersion(doc: ExportDoc): Promise<ExportVersion | undefined> {
  if (!doc.approvedVersion) return undefined;
  return db.exportVersions.where('[docId+version]').equals([doc.id, doc.approvedVersion]).first();
}

/** Traz uma versão aprovada de volta para o rascunho. A versão em si não muda. */
export async function restoreVersion(docId: string, versionId: string): Promise<ExportDoc> {
  const version = await db.exportVersions.get(versionId);
  if (!version || version.docId !== docId) throw new Error('Versão não encontrada.');
  return saveDraft(docId, {
    title: version.title,
    content: cloneBlocks(version.content),
    structure: { ...version.structure },
    layout: { ...version.layout },
  });
}

/** Volta ao texto como veio da origem, sem apagar versões nem arquivos. */
export async function restoreOriginal(docId: string): Promise<ExportDoc> {
  const doc = await db.exportDocs.get(docId);
  if (!doc) throw new Error('Documento não encontrado.');
  return saveDraft(docId, { content: cloneBlocks(doc.original), structure: doc.originalStructure ?? emptyStructure() });
}

/* ------------------------------- arquivos ------------------------------- */

/** Guarda um arquivo gerado e atualiza o documento. */
export async function storeFile(
  doc: ExportDoc,
  version: ExportVersion,
  data: { format: ExportFile['format']; filename: string; mime: string; blob: Blob; pages?: number; edition?: ExportFile['edition'] },
): Promise<{ file: ExportFile; doc: ExportDoc }> {
  const file: ExportFile = {
    id: uid('fil_'),
    docId: doc.id,
    userId: doc.userId,
    versionId: version.id,
    version: version.version,
    format: data.format,
    filename: data.filename,
    mime: data.mime,
    size: data.blob.size,
    pages: data.pages,
    edition: data.edition,
    blob: data.blob,
    createdAt: now(),
  };
  return db.transaction('rw', [db.exportDocs, db.exportFiles], async () => {
    await db.exportFiles.put(file);
    const current = (await db.exportDocs.get(doc.id)) ?? doc;
    const next: ExportDoc = {
      ...current,
      formats: Array.from(new Set([...current.formats, data.format])),
      lastExportAt: file.createdAt,
    };
    next.status = await statusOf(next);
    await db.exportDocs.put(next);
    return { file, doc: next };
  });
}

export async function removeFile(fileId: string): Promise<void> {
  await db.transaction('rw', [db.exportDocs, db.exportFiles], async () => {
    const file = await db.exportFiles.get(fileId);
    if (!file) return;
    await db.exportFiles.delete(fileId);
    const doc = await db.exportDocs.get(file.docId);
    if (!doc) return;
    const remaining = await db.exportFiles.where('docId').equals(doc.id).toArray();
    const next = { ...doc, formats: Array.from(new Set(remaining.map((f) => f.format))) };
    next.status = await statusOf(next);
    await db.exportDocs.put(next);
  });
}

/* ------------------------------ biblioteca ------------------------------ */

export async function duplicateExportDoc(id: string): Promise<ExportDoc> {
  const doc = await db.exportDocs.get(id);
  if (!doc) throw new Error('Documento não encontrado.');
  const t = now();
  const copy: ExportDoc = {
    ...doc,
    id: uid('exp_'),
    title: cleanText(`${doc.title} (cópia)`, LIMITS.title),
    status: 'rascunho',
    original: cloneBlocks(doc.content),
    content: cloneBlocks(doc.content),
    approvedVersion: undefined,
    approvedSignature: undefined,
    versionCount: 0,
    formats: [],
    lastExportAt: undefined,
    createdAt: t,
    updatedAt: t,
  };
  await db.exportDocs.put(copy);
  return copy;
}

/** Remove o documento com todas as versões e arquivos. */
export async function deleteExportDoc(id: string): Promise<void> {
  await db.transaction('rw', [db.exportDocs, db.exportVersions, db.exportFiles], async () => {
    await db.exportFiles.where('docId').equals(id).delete();
    await db.exportVersions.where('docId').equals(id).delete();
    await db.exportDocs.delete(id);
  });
}

export interface LibraryRow {
  doc: ExportDoc;
  files: number;
  bytes: number;
}

export async function loadExportLibrary(): Promise<LibraryRow[]> {
  const [docs, files] = await Promise.all([
    db.exportDocs.where('userId').equals(LOCAL_USER).toArray(),
    // só os metadados interessam aqui; o arquivo em si fica onde está
    db.exportFiles.toArray(),
  ]);
  const byDoc = new Map<string, { files: number; bytes: number }>();
  for (const f of files) {
    const acc = byDoc.get(f.docId) ?? { files: 0, bytes: 0 };
    acc.files++;
    acc.bytes += f.size;
    byDoc.set(f.docId, acc);
  }
  return docs
    .map((doc) => ({ doc, ...(byDoc.get(doc.id) ?? { files: 0, bytes: 0 }) }))
    .sort((a, b) => b.doc.updatedAt - a.doc.updatedAt);
}

export interface LibraryFilter {
  query: string;
  category: ExportCategory | 'todas';
  status: ExportStatus | 'todos';
  /** Dias para trás; 0 = qualquer data. */
  days: number;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterExportLibrary(rows: LibraryRow[], filter: LibraryFilter): LibraryRow[] {
  const q = fold(filter.query.trim());
  const since = filter.days ? Date.now() - filter.days * 24 * 60 * 60 * 1000 : 0;
  return rows.filter(({ doc }) => {
    if (filter.category !== 'todas' && doc.category !== filter.category) return false;
    if (filter.status !== 'todos' && doc.status !== filter.status) return false;
    if (since && doc.updatedAt < since) return false;
    if (q && !fold(`${doc.title} ${doc.source.title}`).includes(q)) return false;
    return true;
  });
}

/* ------------------------- registro operacional ------------------------- */

const LOG_KEY = 'export:log';

export interface ExportLogEntry {
  at: number;
  op: 'gerar' | 'guardar';
  format: string;
  ok: boolean;
  ms: number;
  bytes?: number;
  /** Mensagem técnica do erro — nunca o conteúdo do documento. */
  error?: string;
}

/**
 * Registro das últimas operações, só no aparelho, para diagnosticar falhas.
 * Guarda formato, tempo, tamanho e o erro técnico; nada do texto do documento.
 */
export async function logExport(entry: ExportLogEntry): Promise<void> {
  try {
    const row = await db.settings.get(LOG_KEY);
    const list = ((row?.value as ExportLogEntry[] | undefined) ?? []).slice(-49);
    list.push({ ...entry, error: entry.error?.slice(0, 200) });
    await db.settings.put({ key: LOG_KEY, value: list });
  } catch {
    // o registro nunca pode atrapalhar a geração
  }
}

export async function readExportLog(): Promise<ExportLogEntry[]> {
  const row = await db.settings.get(LOG_KEY);
  return (row?.value as ExportLogEntry[] | undefined) ?? [];
}
