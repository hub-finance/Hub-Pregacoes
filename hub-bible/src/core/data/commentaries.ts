import { db, now, uid } from '../db/db';
import { sanitizeHtml } from '../sanitizeHtml';
import { SQLiteFile } from '../sqlite/reader';
import { moduleKind, moduleName, readCommentary } from '../bible/mybible';
import type { CommentaryEntry, CommentaryInfo } from '../db/types';

/**
 * Comentários bíblicos importados pelo usuário.
 *
 * O formato é o do MyBible: `*.commentaries.SQLite3`, com uma tabela
 * `commentaries` cujas linhas apontam livro, capítulo e versículo. Cada
 * comentário pertence a um módulo (Bíblia de Estudo NTLH, Genebra, NVT…), e
 * o app mostra todos os módulos instalados para o versículo selecionado.
 */

export async function listCommentaries(): Promise<CommentaryInfo[]> {
  return db.commentaries.orderBy('createdAt').toArray();
}

export async function removeCommentary(id: string): Promise<void> {
  await db.transaction('rw', [db.commentaries, db.commentaryEntries], async () => {
    await db.commentaryEntries.where('commentaryId').equals(id).delete();
    await db.commentaries.delete(id);
  });
}

export interface CommentaryImportResult {
  commentary: CommentaryInfo;
  entries: number;
}

export async function importCommentaryModule(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<CommentaryImportResult> {
  const file = SQLiteFile.open(buffer);
  if (moduleKind(file) !== 'commentary') {
    throw new Error('Este módulo não é um comentário bíblico.');
  }

  const module = readCommentary(file);
  if (!module.entries.length) throw new Error('O comentário está vazio.');

  const base = fileName.replace(/\.SQLite3$/i, '').replace(/\.commentaries$/i, '');
  const isFootnotes = /^(true|1|yes)$/i.test(module.info.is_footnotes ?? '');

  const info: CommentaryInfo = {
    id: uid('com_'),
    name: moduleName(module.info, base || 'Comentário'),
    entries: module.entries.length,
    isFootnotes,
    language: module.info.language,
    createdAt: now(),
  };

  const rows: CommentaryEntry[] = module.entries.map((e) => ({
    id: uid('ce_'),
    commentaryId: info.id,
    book: e.book,
    chapterFrom: e.chapterFrom,
    verseFrom: e.verseFrom,
    chapterTo: e.chapterTo,
    verseTo: e.verseTo,
    chapterKey: `${info.id}:${e.book}:${e.chapterFrom}`,
    text: sanitizeHtml(e.text),
  }));

  await db.transaction('rw', [db.commentaries, db.commentaryEntries], async () => {
    await db.commentaries.put(info);
    await db.commentaryEntries.bulkPut(rows);
  });

  return { commentary: info, entries: rows.length };
}

export interface CommentaryMatch {
  commentaryName: string;
  isFootnotes: boolean;
  text: string;
  verseFrom: number;
  verseTo: number;
}

/**
 * Busca todos os comentários que cobrem um versículo, em todos os módulos
 * instalados. Cada módulo pode ter mais de uma nota para o mesmo versículo
 * (uma nota do versículo e uma do trecho que o contém).
 */
export async function lookupCommentary(
  bookNumber: number,
  chapter: number,
  verse: number,
): Promise<CommentaryMatch[]> {
  const all = await listCommentaries();
  if (!all.length) return [];

  const keys = all.map((c) => `${c.id}:${bookNumber}:${chapter}`);
  const rows = await db.commentaryEntries.where('chapterKey').anyOf(keys).toArray();

  const names = new Map(all.map((c) => [c.id, { name: c.name, foot: c.isFootnotes }]));
  const matches: CommentaryMatch[] = [];

  for (const row of rows) {
    if (verse < row.verseFrom) continue;
    if (row.chapterFrom === row.chapterTo && verse > row.verseTo) continue;
    const meta = names.get(row.commentaryId);
    matches.push({
      commentaryName: meta?.name ?? 'Comentário',
      isFootnotes: meta?.foot ?? false,
      text: row.text,
      verseFrom: row.verseFrom,
      verseTo: row.verseTo,
    });
  }

  return matches;
}

export async function hasAnyCommentary(): Promise<boolean> {
  return (await db.commentaries.count()) > 0;
}
