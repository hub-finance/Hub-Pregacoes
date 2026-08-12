import { db, now, uid } from '../db/db';
import { LOCAL_USER, type Note, type NoteTarget, type VerseRef } from '../db/types';
import { normalize } from '../bible/canon';

/** Anotações vinculadas a versículo, capítulo, livro, sermão, estudo ou devocional. */

export async function listNotes(): Promise<Note[]> {
  const rows = await db.notes.where('userId').equals(LOCAL_USER).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listNotesFor(parentId: string): Promise<Note[]> {
  const rows = await db.notes.where('parentId').equals(parentId).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listChapterNotes(book: string, chapter: number): Promise<Note[]> {
  const rows = await db.notes.where('userId').equals(LOCAL_USER).toArray();
  return rows.filter((n) => n.ref?.book === book && n.ref?.chapter === chapter);
}

export async function createNote(input: {
  targetType: NoteTarget;
  reference: string;
  content: string;
  ref?: VerseRef;
  parentId?: string;
  title?: string;
  tags?: string[];
}): Promise<Note> {
  const timestamp = now();
  const note: Note = {
    id: uid('note_'),
    userId: LOCAL_USER,
    targetType: input.targetType,
    reference: input.reference,
    ref: input.ref,
    parentId: input.parentId,
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.notes.put(note);
  return note;
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: now() });
}

export async function removeNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = normalize(query);
  if (!q) return notes;
  return notes.filter(
    (n) =>
      normalize(n.content).includes(q) ||
      normalize(n.reference).includes(q) ||
      normalize(n.title ?? '').includes(q) ||
      n.tags.some((t) => normalize(t).includes(q)),
  );
}
