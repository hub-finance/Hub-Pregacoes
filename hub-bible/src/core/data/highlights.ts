import { db, now, uid } from '../db/db';
import { LOCAL_USER, type Highlight } from '../db/types';

/** Marcações (grifos) por categoria — seção 7 da especificação. */

export const chapterKey = (translation: string, book: string, chapter: number): string =>
  `${translation}:${book}:${chapter}`;

export async function listChapterHighlights(
  translation: string,
  book: string,
  chapter: number,
): Promise<Highlight[]> {
  return db.highlights.where('chapterKey').equals(chapterKey(translation, book, chapter)).toArray();
}

export async function setHighlight(
  translation: string,
  book: string,
  chapter: number,
  verse: number,
  category: string | null,
): Promise<void> {
  const key = chapterKey(translation, book, chapter);
  const existing = await db.highlights.where('[chapterKey+verse]').equals([key, verse]).first();

  if (!category) {
    if (existing) await db.highlights.delete(existing.id);
    return;
  }
  if (existing) {
    await db.highlights.update(existing.id, { category, updatedAt: now() });
    return;
  }
  const timestamp = now();
  const highlight: Highlight = {
    id: uid('hl_'),
    userId: LOCAL_USER,
    translation,
    book,
    chapter,
    verse,
    chapterKey: key,
    category,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.highlights.put(highlight);
}

export async function listHighlights(category?: string): Promise<Highlight[]> {
  const rows = await db.highlights.where('userId').equals(LOCAL_USER).toArray();
  const filtered = category ? rows.filter((h) => h.category === category) : rows;
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export async function countHighlightsByCategory(): Promise<Record<string, number>> {
  const rows = await db.highlights.where('userId').equals(LOCAL_USER).toArray();
  return rows.reduce<Record<string, number>>((acc, h) => {
    acc[h.category] = (acc[h.category] ?? 0) + 1;
    return acc;
  }, {});
}
