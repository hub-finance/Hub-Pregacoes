import Dexie, { type Table } from 'dexie';
import type {
  CachedBook,
  Devotional,
  Favorite,
  Highlight,
  KeyValue,
  LibraryDoc,
  Note,
  ReadingEvent,
  ReadingPlan,
  Sermon,
  Study,
  UserProfile,
} from './types';

/**
 * Banco local (IndexedDB via Dexie).
 *
 * Regras de schema:
 *  - toda tabela do usuário tem `userId` indexado (preparo p/ multiusuário);
 *  - `updatedAt` indexado permite sincronização incremental futura;
 *  - o texto bíblico fica em tabela separada (`books`) e pode ser limpo sem
 *    afetar dados pessoais.
 */
export class HubBibleDB extends Dexie {
  settings!: Table<KeyValue, string>;
  users!: Table<UserProfile, string>;
  favorites!: Table<Favorite, string>;
  highlights!: Table<Highlight, string>;
  notes!: Table<Note, string>;
  sermons!: Table<Sermon, string>;
  studies!: Table<Study, string>;
  devotionals!: Table<Devotional, string>;
  libraryDocs!: Table<LibraryDoc, string>;
  plans!: Table<ReadingPlan, string>;
  readingEvents!: Table<ReadingEvent, string>;
  books!: Table<CachedBook, string>;

  constructor() {
    super('hub-bible');
    this.version(1).stores({
      settings: 'key',
      users: 'id',
      favorites: 'id, userId, category, createdAt, updatedAt, reference, [userId+category]',
      highlights: 'id, userId, chapterKey, category, updatedAt, [chapterKey+verse]',
      notes: 'id, userId, targetType, parentId, reference, updatedAt, createdAt',
      sermons: 'id, userId, category, date, updatedAt, createdAt, title',
      studies: 'id, userId, category, updatedAt, createdAt, title',
      devotionals: 'id, userId, category, date, updatedAt, createdAt, title',
      libraryDocs: 'id, userId, category, updatedAt, createdAt, title',
      plans: 'id, userId, templateId, updatedAt, archived',
      readingEvents: 'id, userId, day, at, [userId+day]',
      books: 'key, translation, savedAt',
    });
  }
}

export const db = new HubBibleDB();

/** Identificador curto e ordenável no tempo. */
export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export const now = () => Date.now();

/** Data local no formato yyyy-mm-dd (sem deslocamento de fuso). */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Remove todos os dados pessoais (mantém o texto bíblico em cache). */
export async function clearUserData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.favorites,
      db.highlights,
      db.notes,
      db.sermons,
      db.studies,
      db.devotionals,
      db.libraryDocs,
      db.plans,
      db.readingEvents,
    ],
    async () => {
      await Promise.all([
        db.favorites.clear(),
        db.highlights.clear(),
        db.notes.clear(),
        db.sermons.clear(),
        db.studies.clear(),
        db.devotionals.clear(),
        db.libraryDocs.clear(),
        db.plans.clear(),
        db.readingEvents.clear(),
      ]);
    },
  );
}

/** Remove o texto bíblico baixado (libera espaço). */
export async function clearScriptureCache(translation?: string): Promise<void> {
  if (translation) await db.books.where('translation').equals(translation).delete();
  else await db.books.clear();
}
