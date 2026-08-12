/**
 * Modelo de dados do Hub Bible.
 *
 * Todos os registros do usuário carregam `userId` (hoje sempre "local") para que
 * a futura sincronização multi-dispositivo/multi-conta não exija migração de
 * schema, e `updatedAt` para resolução de conflitos por "last write wins".
 */

export type ID = string;

/** Identificador do usuário local enquanto não há conta/sincronização. */
export const LOCAL_USER: ID = 'local';

export interface UserProfile {
  id: ID;
  name: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------ referências ------------------------------ */

/** Referência canônica a um trecho bíblico. `verseEnd` inclusivo. */
export interface VerseRef {
  translation: string;
  book: string; // OSIS: GEN, JHN, REV...
  chapter: number;
  verse: number;
  verseEnd?: number;
}

/* -------------------------------- registros ------------------------------ */

export interface Favorite {
  id: ID;
  userId: ID;
  ref: VerseRef;
  reference: string; // "João 15:5" — desnormalizado para busca/lista
  text: string;
  category: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Highlight {
  id: ID;
  userId: ID;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  /** Chave composta `${translation}:${book}:${chapter}` para leitura do capítulo. */
  chapterKey: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export type NoteTarget = 'verse' | 'chapter' | 'book' | 'sermon' | 'study' | 'devotional' | 'free';

export interface Note {
  id: ID;
  userId: ID;
  targetType: NoteTarget;
  /** Referência textual ("João 15:5", "Sermão: A videira") — sempre preenchida. */
  reference: string;
  ref?: VerseRef;
  /** Vínculo com outro documento (sermão/estudo/devocional). */
  parentId?: ID;
  title?: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** Bloco de um sermão/estudo (ponto, tópico). */
export interface OutlineBlock {
  id: ID;
  title: string;
  scripture: string;
  scriptureText?: string;
  comment: string;
  application: string;
}

export interface Sermon {
  id: ID;
  userId: ID;
  title: string;
  theme: string;
  mainText: string;
  mainTextContent?: string;
  date: string; // ISO yyyy-mm-dd
  category: string;
  introduction: string;
  blocks: OutlineBlock[];
  conclusion: string;
  appeal: string;
  notes: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Study {
  id: ID;
  userId: ID;
  title: string;
  theme: string;
  mainText: string;
  category: string;
  introduction: string;
  development: string;
  relatedVerses: string[];
  comments: string;
  application: string;
  conclusion: string;
  notes: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Devotional {
  id: ID;
  userId: ID;
  title: string;
  date: string;
  category: string;
  scripture: string;
  scriptureText?: string;
  reflection: string;
  application: string;
  prayer: string;
  notes: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Documento livre da Biblioteca Ministerial (liderança, GC, discipulado…). */
export interface LibraryDoc {
  id: ID;
  userId: ID;
  title: string;
  category: string;
  summary: string;
  content: string;
  tags: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* --------------------------- planos de leitura --------------------------- */

/** Uma leitura diária: lista de trechos "GEN 1-3". */
export interface PlanDay {
  day: number;
  /** Lista de intervalos: [livro OSIS, capítulo inicial, capítulo final]. */
  ranges: Array<[string, number, number]>;
}

export interface ReadingPlan {
  id: ID;
  userId: ID;
  templateId: string;
  name: string;
  description: string;
  totalDays: number;
  days: PlanDay[];
  /** Índices (1-based) dos dias concluídos. */
  completedDays: number[];
  startedAt: number;
  lastReadAt?: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* -------------------------- histórico e progresso ------------------------ */

export interface ReadingEvent {
  id: ID;
  userId: ID;
  translation: string;
  book: string;
  chapter: number;
  /** Data local yyyy-mm-dd — usada para sequência de dias consecutivos. */
  day: string;
  at: number;
}

export interface KeyValue<T = unknown> {
  key: string;
  value: T;
}

/** Texto bíblico armazenado localmente (offline). */
export interface CachedBook {
  key: string; // `${translation}:${book}`
  translation: string;
  book: string;
  chapters: string[][];
  savedAt: number;
}

/* -------------------------------- catálogo ------------------------------- */

export interface TranslationInfo {
  id: string;
  name: string;
  shortName: string;
  abbrev: string;
  language: string;
  languageLabel: string;
  year?: number;
  license: string;
  licenseUrl?: string;
  publisher?: string;
  sourceUrl?: string;
  bundled: boolean;
  default?: boolean;
  requiresLicense?: boolean;
  stats?: { books: number; chapters: number; verses: number };
  /** Preenchido em runtime: tradução importada pelo usuário. */
  imported?: boolean;
}

export interface BookMeta {
  osis: string;
  order: number;
  name: string;
  abbrev: string;
  testament: 'AT' | 'NT';
  chapters: number;
  verseCounts: number[];
}

export interface TranslationMeta extends TranslationInfo {
  books: BookMeta[];
}
