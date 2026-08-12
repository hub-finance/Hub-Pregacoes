import { bookName, findBook } from './canon';
import type { VerseRef } from '../db/types';

export interface ParsedReference {
  book: string; // OSIS
  chapter: number;
  verse?: number;
  verseEnd?: number;
}

/**
 * Interpreta referências bíblicas escritas por humanos.
 *
 * Aceita: "João 3:16", "jo 3.16", "1co 13", "Salmos 23:1-6", "Gn1:1",
 * "Apocalipse 21 1-4", "2 Tm 3:16,17" (usa o primeiro intervalo).
 */
export function parseReference(input: string): ParsedReference | null {
  const raw = input.trim().replace(/\s+/g, ' ');
  if (!raw) return null;

  const m = raw.match(
    /^([1-3]?\s?[\p{L}][\p{L}\s.]*?)\s*(\d{1,3})?\s*(?:[:.,\s]\s*(\d{1,3}))?\s*(?:\s*[-–a]\s*(\d{1,3}))?$/iu,
  );
  if (!m) return null;

  const book = findBook(m[1]);
  if (!book) return null;

  const chapter = m[2] ? Number(m[2]) : 1;
  const verse = m[3] ? Number(m[3]) : undefined;
  const verseEnd = m[4] ? Number(m[4]) : undefined;

  return {
    book: book.osis,
    chapter: Math.max(1, chapter),
    verse,
    verseEnd: verseEnd && verse && verseEnd > verse ? verseEnd : undefined,
  };
}

/** "João 15:5" / "João 15:5-8" / "João 15" */
export function formatReference(ref: {
  book: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
}): string {
  const name = bookName(ref.book);
  if (!ref.verse) return `${name} ${ref.chapter}`;
  const range = ref.verseEnd && ref.verseEnd > ref.verse ? `-${ref.verseEnd}` : '';
  return `${name} ${ref.chapter}:${ref.verse}${range}`;
}

/** Referência compacta a partir de uma lista de versículos selecionados. */
export function formatSelection(book: string, chapter: number, verses: number[]): string {
  if (!verses.length) return `${bookName(book)} ${chapter}`;
  const sorted = [...verses].sort((a, b) => a - b);
  const groups: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const v = sorted[i];
    if (v !== prev + 1) {
      groups.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = v;
    }
    prev = v;
  }
  return `${bookName(book)} ${chapter}:${groups.join(',')}`;
}

export const toVerseRef = (
  translation: string,
  p: ParsedReference,
  fallbackVerse = 1,
): VerseRef => ({
  translation,
  book: p.book,
  chapter: p.chapter,
  verse: p.verse ?? fallbackVerse,
  verseEnd: p.verseEnd,
});

/** Encontra referências dentro de um texto livre (para links clicáveis). */
const INLINE_RE =
  /\b([1-3]\s?)?([\p{L}]{2,}\.?)\s?(\d{1,3})[:.](\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?/gu;

export interface InlineMatch {
  index: number;
  length: number;
  text: string;
  ref: ParsedReference;
}

export function findInlineReferences(text: string): InlineMatch[] {
  const out: InlineMatch[] = [];
  for (const m of text.matchAll(INLINE_RE)) {
    const parsed = parseReference(m[0]);
    if (parsed && parsed.verse) {
      out.push({ index: m.index ?? 0, length: m[0].length, text: m[0], ref: parsed });
    }
  }
  return out;
}
