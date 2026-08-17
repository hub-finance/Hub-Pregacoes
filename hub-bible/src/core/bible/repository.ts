import { db, now } from '../db/db';
import type { BookMeta, CachedBook, TranslationInfo, TranslationMeta, VerseRef } from '../db/types';
import { CANON, CANON_BY_OSIS, findBook } from './canon';

/**
 * Repositório do texto bíblico.
 *
 * Estratégia em três camadas:
 *   memória (sessão) -> IndexedDB (offline) -> arquivo estático /bible/**.
 *
 * Nada de texto bíblico é embutido no bundle JS: os livros são carregados sob
 * demanda e persistidos localmente, o que mantém o app leve e 100% offline
 * depois da primeira leitura (ou de "Baixar para uso offline").
 */

const BASE = `${import.meta.env.BASE_URL}bible/`;
const META_KEY = (id: string) => `translation:meta:${id}`;

const memBooks = new Map<string, CachedBook>();
const memMeta = new Map<string, TranslationMeta>();
let catalogCache: TranslationInfo[] | null = null;

const bookKey = (translation: string, book: string) => `${translation}:${book}`;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) throw new Error(`Falha ao carregar ${url} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/* -------------------------------- catálogo ------------------------------- */

/** Traduções embutidas + traduções importadas pelo usuário. */
export async function loadCatalog(force = false): Promise<TranslationInfo[]> {
  if (catalogCache && !force) return catalogCache;
  let bundled: TranslationInfo[] = [];
  try {
    bundled = await fetchJson<TranslationInfo[]>(`${BASE}catalog.json`);
  } catch {
    bundled = [];
  }
  const importedRows = await db.settings
    .where('key')
    .startsWith('translation:meta:')
    .toArray()
    .catch(() => []);

  const imported = importedRows.map((r) => {
    const meta = r.value as TranslationMeta;
    const { books: _books, ...info } = meta;
    return { ...info, imported: true, bundled: false } as TranslationInfo;
  });

  const merged = [...bundled];
  for (const imp of imported) {
    const i = merged.findIndex((t) => t.id === imp.id);
    if (i >= 0) merged[i] = { ...merged[i], ...imp, requiresLicense: false };
    else merged.push(imp);
  }
  catalogCache = merged;
  return merged;
}

/** Traduções prontas para leitura (embutidas ou já importadas). */
export async function loadAvailableTranslations(): Promise<TranslationInfo[]> {
  const all = await loadCatalog();
  return all.filter((t) => t.bundled || t.imported);
}

/* --------------------------------- meta ---------------------------------- */

export async function getMeta(translation: string): Promise<TranslationMeta> {
  const cached = memMeta.get(translation);
  if (cached) return cached;

  const stored = await db.settings.get(META_KEY(translation));
  if (stored) {
    const meta = stored.value as TranslationMeta;
    memMeta.set(translation, meta);
    return meta;
  }

  const meta = await fetchJson<TranslationMeta>(`${BASE}${translation}/meta.json`);
  memMeta.set(translation, meta);
  return meta;
}

export async function getBookMeta(translation: string, book: string): Promise<BookMeta | undefined> {
  const meta = await getMeta(translation);
  return meta.books.find((b) => b.osis === book);
}

/* --------------------------------- livros -------------------------------- */

export async function getBook(translation: string, book: string): Promise<CachedBook> {
  const key = bookKey(translation, book);
  const inMemory = memBooks.get(key);
  if (inMemory) return inMemory;

  const stored = await db.books.get(key);
  if (stored) {
    memBooks.set(key, stored);
    return stored;
  }

  const payload = await fetchJson<{ chapters: string[][] }>(`${BASE}${translation}/${book}.json`);
  const record: CachedBook = {
    key,
    translation,
    book,
    chapters: payload.chapters,
    savedAt: now(),
  };
  memBooks.set(key, record);
  // gravação assíncrona: a leitura não espera o IndexedDB
  db.books.put(record).catch(() => undefined);
  return record;
}

export async function getChapter(
  translation: string,
  book: string,
  chapter: number,
): Promise<string[]> {
  const record = await getBook(translation, book);
  return record.chapters[chapter - 1] ?? [];
}

export interface VerseRow {
  verse: number;
  text: string;
}

export async function getVerses(ref: VerseRef): Promise<VerseRow[]> {
  const chapter = await getChapter(ref.translation, ref.book, ref.chapter);
  const from = ref.verse;
  const to = ref.verseEnd && ref.verseEnd >= from ? ref.verseEnd : from;
  const rows: VerseRow[] = [];
  for (let v = from; v <= to; v++) {
    const text = chapter[v - 1];
    if (text) rows.push({ verse: v, text });
  }
  return rows;
}

/** Texto corrido de um intervalo — usado em compartilhamento e favoritos. */
export async function getPassageText(ref: VerseRef): Promise<string> {
  const rows = await getVerses(ref);
  if (rows.length <= 1) return rows[0]?.text ?? '';
  return rows.map((r) => `${r.verse} ${r.text}`).join(' ');
}

/* ------------------------------ uso offline ------------------------------ */

export async function installedBookCount(translation: string): Promise<number> {
  return db.books.where('translation').equals(translation).count();
}

export interface InstallProgress {
  done: number;
  total: number;
  book: string;
}

/** Baixa todos os livros de uma tradução para uso offline e busca. */
export async function installTranslation(
  translation: string,
  onProgress?: (p: InstallProgress) => void,
): Promise<void> {
  const meta = await getMeta(translation);
  const books = meta.books.length ? meta.books.map((b) => b.osis) : CANON.map((b) => b.osis);
  const existing = new Set(
    (await db.books.where('translation').equals(translation).primaryKeys()) as string[],
  );

  let done = 0;
  const queue = [...books];
  const CONCURRENCY = 6;

  const worker = async () => {
    for (;;) {
      const osis = queue.shift();
      if (!osis) return;
      if (!existing.has(bookKey(translation, osis))) {
        await getBook(translation, osis);
      }
      done += 1;
      onProgress?.({ done, total: books.length, book: osis });
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

export function forgetMemoryCache(): void {
  memBooks.clear();
  memMeta.clear();
  catalogCache = null;
}

/* --------------------------- importação licenciada ------------------------ */

export interface ImportResult {
  translation: TranslationMeta;
  books: number;
  verses: number;
}

type BookMap = Record<string, string[][]>;

/**
 * Normaliza formatos comuns de arquivos bíblicos para `{ OSIS: string[][] }`.
 *
 * Suporta:
 *  - Hub Bible: `{ translation: {...}, books: { GEN: [[...]] } }`
 *  - Lista por livro na ordem canônica: `[{ abbrev, chapters: [[...]] }, ...]`
 *  - bibleapi: `{ resultset: { row: [{ field: [id, livro, cap, ver, texto] }] } }`
 */
export function normalizeImportedBible(data: unknown): { books: BookMap; meta?: Partial<TranslationMeta> } {
  // formato nativo
  if (data && typeof data === 'object' && 'books' in (data as Record<string, unknown>)) {
    const obj = data as { books: BookMap; translation?: Partial<TranslationMeta> };
    return { books: obj.books, meta: obj.translation };
  }

  // bibleapi
  if (data && typeof data === 'object' && 'resultset' in (data as Record<string, unknown>)) {
    const rows = (data as { resultset: { row: Array<{ field: [number, number, number, number, string] }> } })
      .resultset.row;
    const books: BookMap = {};
    for (const r of rows) {
      const [, bookNum, chapter, verse, text] = r.field;
      const meta = CANON[bookNum - 1];
      if (!meta) continue;
      const b = (books[meta.osis] ||= []);
      const c = (b[chapter - 1] ||= []);
      c[verse - 1] = String(text ?? '').trim();
    }
    return { books: fill(books) };
  }

  // lista de livros na ordem canônica
  if (Array.isArray(data)) {
    const books: BookMap = {};
    data.forEach((entry, index) => {
      const chapters = (entry?.chapters ?? entry?.capitulos) as string[][] | undefined;
      if (!chapters) return;
      /* A sigla do próprio arquivo manda mais que a posição: se ela for
         reconhecida, um livro faltando no meio da lista não desloca todos os
         seguintes. Sem sigla reconhecível, vale a ordem canônica. */
      const osis = osisFromLabel(entry?.abbrev ?? entry?.sigla ?? entry?.name) ?? CANON[index]?.osis;
      if (!osis) return;
      books[osis] = chapters.map((c) => c.map((v) => String(v ?? '').trim()));
    });
    return { books: fill(books) };
  }

  throw new Error('Formato de arquivo não reconhecido.');
}

/** Sigla ou nome de livro, em qualquer grafia usual, -> código OSIS. */
function osisFromLabel(label: unknown): string | undefined {
  if (typeof label !== 'string' || !label.trim()) return undefined;
  return findBook(label)?.osis;
}

function fill(books: BookMap): BookMap {
  for (const osis of Object.keys(books)) {
    books[osis] = books[osis].map((c) => (c || []).map((v) => v || ''));
  }
  return books;
}

/** Grava uma tradução fornecida pelo usuário (cópia licenciada) no dispositivo. */
export async function importTranslation(
  info: TranslationInfo,
  data: unknown,
): Promise<ImportResult> {
  const { books, meta: incomingMeta } = normalizeImportedBible(data);
  const osisList = Object.keys(books).filter((k) => CANON_BY_OSIS.has(k));
  if (!osisList.length) throw new Error('Nenhum livro reconhecido no arquivo.');

  const bookMetas: BookMeta[] = [];
  let verses = 0;
  const records: CachedBook[] = [];

  for (const canon of CANON) {
    const chapters = books[canon.osis];
    if (!chapters?.length) continue;
    records.push({
      key: bookKey(info.id, canon.osis),
      translation: info.id,
      book: canon.osis,
      chapters,
      savedAt: now(),
    });
    const verseCounts = chapters.map((c) => c.length);
    verses += verseCounts.reduce((a, b) => a + b, 0);
    bookMetas.push({
      osis: canon.osis,
      order: canon.order,
      name: canon.name,
      abbrev: canon.abbrev,
      testament: canon.testament,
      chapters: chapters.length,
      verseCounts,
    });
  }

  const meta: TranslationMeta = {
    ...info,
    ...incomingMeta,
    id: info.id,
    bundled: false,
    imported: true,
    requiresLicense: false,
    books: bookMetas,
    stats: {
      books: bookMetas.length,
      chapters: bookMetas.reduce((a, b) => a + b.chapters, 0),
      verses,
    },
  };

  await db.transaction('rw', [db.books, db.settings], async () => {
    await db.books.where('translation').equals(info.id).delete();
    await db.books.bulkPut(records);
    await db.settings.put({ key: META_KEY(info.id), value: meta });
  });

  memMeta.set(info.id, meta);
  catalogCache = null;
  return { translation: meta, books: bookMetas.length, verses };
}

/** Remove uma tradução importada (texto + metadados). */
export async function removeImportedTranslation(id: string): Promise<void> {
  await db.transaction('rw', [db.books, db.settings], async () => {
    await db.books.where('translation').equals(id).delete();
    await db.settings.delete(META_KEY(id));
  });
  memMeta.delete(id);
  for (const key of [...memBooks.keys()]) {
    if (key.startsWith(`${id}:`)) memBooks.delete(key);
  }
  catalogCache = null;
}
