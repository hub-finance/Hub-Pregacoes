import { db, now } from '../db/db';
import type {
  BookMeta,
  CachedBook,
  Pericope,
  StrongTag,
  TranslationInfo,
  TranslationMeta,
  VerseRef,
} from '../db/types';
import { CANON, CANON_BY_OSIS, bookName, findBook } from './canon';
import { normalizeCodes, parseVerse } from './mybible';

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

/** Metadados de uma tradução importada, sem tocar na rede. */
async function storedMeta(translation: string): Promise<TranslationMeta | undefined> {
  const cached = memMeta.get(translation);
  if (cached?.imported) return cached;
  const stored = await db.settings.get(META_KEY(translation)).catch(() => undefined);
  return stored?.value as TranslationMeta | undefined;
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

  /* Tradução importada não tem cópia no servidor: o que não foi gravado no
     aparelho simplesmente não existe. Buscar na rede daria um 404 cru na cara
     de quem só queria ler — a resposta certa é dizer que aquela tradução não
     traz aquele livro. Módulos só do Novo Testamento são comuns. */
  const local = await storedMeta(translation);
  if (local) {
    throw new Error(`${local.shortName} não traz o livro de ${bookName(book)}.`);
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
type StrongMap = Record<string, StrongTag[][][]>;

interface NormalizedBible {
  books: BookMap;
  meta?: Partial<TranslationMeta>;
  /** Números Strong, quando o arquivo os trazia. */
  strongs?: StrongMap;
}

/**
 * Extrai os números Strong escritos no meio do texto.
 *
 * Arquivos JSON exportados de programas de estudo costumam guardar o código
 * dentro do próprio versículo — `criou<S>1254</S> Deus<S>430</S>`. É a mesma
 * marcação dos módulos do MyBible, então quem lê é o mesmo `parseVerse`: o
 * texto sai limpo e cada código fica amarrado à palavra a que pertence.
 *
 * A varredura preliminar existe para não pagar o preço à toa: a esmagadora
 * maioria dos arquivos não tem marcação nenhuma, e aí não se toca no texto.
 */
function extractStrongs(books: BookMap): StrongMap | undefined {
  const marked = Object.values(books).some((chapters) =>
    chapters.some((verses) => verses.some((v) => v.includes('<S>'))),
  );
  if (!marked) return undefined;

  const strongs: StrongMap = {};
  for (const [osis, chapters] of Object.entries(books)) {
    chapters.forEach((verses, c) => {
      verses.forEach((verse, v) => {
        const parsed = parseVerse(verse);
        normalizeCodes(parsed.strongs, osis);
        chapters[c][v] = parsed.text;
        if (!parsed.strongs.length) return;
        const sChapters = (strongs[osis] ||= []);
        const sVerses = (sChapters[c] ||= []);
        sVerses[v] = parsed.strongs;
      });
    });
  }
  return Object.keys(strongs).length ? strongs : undefined;
}

/**
 * Normaliza formatos comuns de arquivos bíblicos para `{ OSIS: string[][] }`.
 *
 * Suporta:
 *  - Hub Bible: `{ translation: {...}, books: { GEN: [[...]] } }`
 *  - Lista por livro na ordem canônica: `[{ abbrev, chapters: [[...]] }, ...]`
 *  - bibleapi: `{ resultset: { row: [{ field: [id, livro, cap, ver, texto] }] } }`
 *
 * Em qualquer um deles, números Strong escritos no texto (`<S>430</S>`) são
 * reconhecidos e separados — ver `extractStrongs`. O formato nativo aceita
 * ainda um campo `strongs` já pronto, para quem gera o arquivo por conta.
 */
export function normalizeImportedBible(data: unknown): NormalizedBible {
  // formato nativo
  if (data && typeof data === 'object' && 'books' in (data as Record<string, unknown>)) {
    const obj = data as {
      books: BookMap;
      translation?: Partial<TranslationMeta>;
      strongs?: StrongMap;
    };
    const books = fill(obj.books);
    return {
      books,
      meta: obj.translation,
      // o campo explícito manda: quem o escreveu sabe o que quis dizer
      strongs: obj.strongs ?? extractStrongs(books),
    };
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
    const filled = fill(books);
    return { books: filled, strongs: extractStrongs(filled) };
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
    const filled = fill(books);
    return { books: filled, strongs: extractStrongs(filled) };
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
  const { books, meta, strongs } = normalizeImportedBible(data);
  // `hasStrong` é o que faz a ação "No original" aparecer na barra do versículo
  return storeTranslation({ ...info, hasStrong: !!strongs }, books, { meta, strongs });
}

interface StoreOptions {
  meta?: Partial<TranslationMeta>;
  /** Números Strong por livro, quando a origem os traz. */
  strongs?: Record<string, StrongTag[][][]>;
  /** Títulos de perícope por livro. */
  pericopes?: Record<string, Pericope[]>;
}

/**
 * Grava no aparelho o texto já normalizado, venha ele de JSON ou de um módulo
 * do MyBible. É aqui que a tradução deixa de ser arquivo e passa a existir para
 * o app: livros, metadados e — quando houver — os números Strong ao lado.
 */
export async function storeTranslation(
  info: TranslationInfo,
  books: BookMap,
  { meta: incomingMeta, strongs, pericopes }: StoreOptions = {},
): Promise<ImportResult> {
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
      strongs: strongs?.[canon.osis],
      pericopes: pericopes?.[canon.osis],
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

/**
 * Títulos de perícope do capítulo, indexados pelo versículo em que entram.
 *
 * Devolve um mapa vazio quando a tradução não os traz — que é o caso de todas
 * as embutidas. A tela não precisa saber a diferença.
 */
export async function getChapterPericopes(
  translation: string,
  book: string,
  chapter: number,
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const record = await getBook(translation, book);
    for (const p of record.pericopes ?? []) {
      if (p.chapter === chapter) map.set(p.verse, p.title);
    }
  } catch {
    // sem livro não há título: o erro de leitura já é tratado por quem lê o texto
  }
  return map;
}
