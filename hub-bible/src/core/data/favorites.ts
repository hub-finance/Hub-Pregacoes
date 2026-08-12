import { db, now, uid } from '../db/db';
import { LOCAL_USER, type Favorite, type VerseRef } from '../db/types';

/** Favoritos — versículos guardados com categoria e observação. */

export async function listFavorites(): Promise<Favorite[]> {
  const rows = await db.favorites.where('userId').equals(LOCAL_USER).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addFavorite(input: {
  ref: VerseRef;
  reference: string;
  text: string;
  category?: string;
  note?: string;
}): Promise<Favorite> {
  const timestamp = now();
  const favorite: Favorite = {
    id: uid('fav_'),
    userId: LOCAL_USER,
    ref: input.ref,
    reference: input.reference,
    text: input.text,
    category: input.category ?? 'promessas',
    note: input.note,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.favorites.put(favorite);
  return favorite;
}

export async function updateFavorite(id: string, patch: Partial<Favorite>): Promise<void> {
  await db.favorites.update(id, { ...patch, updatedAt: now() });
}

export async function removeFavorite(id: string): Promise<void> {
  await db.favorites.delete(id);
}

/** Favorito existente para um versículo específico (ignora a tradução). */
export async function findFavoriteFor(
  book: string,
  chapter: number,
  verse: number,
): Promise<Favorite | undefined> {
  const rows = await db.favorites.where('userId').equals(LOCAL_USER).toArray();
  return rows.find((f) => f.ref.book === book && f.ref.chapter === chapter && f.ref.verse === verse);
}

export async function toggleFavorite(input: {
  ref: VerseRef;
  reference: string;
  text: string;
  category?: string;
}): Promise<'added' | 'removed'> {
  const existing = await findFavoriteFor(input.ref.book, input.ref.chapter, input.ref.verse);
  if (existing) {
    await removeFavorite(existing.id);
    return 'removed';
  }
  await addFavorite(input);
  return 'added';
}
