/**
 * Concordância local para traduções importadas.
 *
 * As traduções embutidas têm concordância pré-gerada em `public/concordance/`.
 * Para traduções importadas pelo usuário (ACF, NVI etc.), o índice é gerado no
 * primeiro acesso a partir dos versículos no IndexedDB e gravado na tabela
 * `settings` para consultas seguintes.
 *
 * O processo leva ~5 s para 31 mil versículos e roda uma vez por tradução.
 */

import { db } from '../db/db';
import { CANON } from '../bible/canon';

type WordEntry = [string, number, [string, number, number][]];

interface ConcordanceIndex {
  _total: number;
  _verses: number;
  [letter: string]: number;
}

const SETTINGS_PREFIX = 'concordance:';
const indexKey = (t: string) => `${SETTINGS_PREFIX}${t}:index`;
const letterKey = (t: string, l: string) => `${SETTINGS_PREFIX}${t}:${l}`;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function extractWords(verse: string): string[] {
  return verse
    .replace(/<[^>]*>/g, '')
    .split(/[\s—–\-,.;:!?""''«»()[\]{}/\\]+/)
    .filter((w) => w.length >= 2);
}

export async function hasLocalConcordance(translation: string): Promise<boolean> {
  const stored = await db.settings.get(indexKey(translation));
  return !!stored;
}

export async function getLocalConcordanceIndex(translation: string): Promise<ConcordanceIndex | null> {
  const stored = await db.settings.get(indexKey(translation));
  return (stored?.value as ConcordanceIndex) ?? null;
}

export async function getLocalConcordanceLetter(
  translation: string,
  letter: string,
): Promise<Record<string, WordEntry>> {
  const stored = await db.settings.get(letterKey(translation, letter));
  return (stored?.value as Record<string, WordEntry>) ?? {};
}

/**
 * Gera a concordância para uma tradução importada.
 *
 * Lê todos os livros do IndexedDB, tokeniza cada versículo e grava o índice
 * na tabela `settings`. Retorna o índice gerado.
 */
export async function buildLocalConcordance(
  translation: string,
  onProgress?: (msg: string) => void,
): Promise<ConcordanceIndex> {
  onProgress?.('Carregando versículos…');

  const books = await db.books
    .where('translation')
    .equals(translation)
    .toArray();

  if (!books.length) {
    throw new Error('Nenhum livro encontrado para esta tradução.');
  }

  const wordMap = new Map<string, { original: string; count: number; refs: [string, number, number][] }>();
  let totalVerses = 0;

  const canonOrder = new Map(CANON.map((b, i) => [b.osis, i]));
  books.sort((a, b) => (canonOrder.get(a.book) ?? 999) - (canonOrder.get(b.book) ?? 999));

  for (const record of books) {
    onProgress?.(`Indexando ${record.book}…`);
    for (let ch = 0; ch < record.chapters.length; ch++) {
      const verses = record.chapters[ch];
      for (let vs = 0; vs < verses.length; vs++) {
        const text = verses[vs];
        if (!text) continue;
        totalVerses++;

        const words = extractWords(text);
        const seen = new Set<string>();

        for (const w of words) {
          const norm = normalize(w);
          if (norm.length < 2) continue;
          if (seen.has(norm)) continue;
          seen.add(norm);

          let entry = wordMap.get(norm);
          if (!entry) {
            entry = { original: w, count: 0, refs: [] };
            wordMap.set(norm, entry);
          }
          entry.count++;
          entry.refs.push([record.book, ch + 1, vs + 1]);
        }
      }
    }
  }

  onProgress?.('Gravando índice…');

  const byLetter = new Map<string, Record<string, WordEntry>>();
  const letterCounts: Record<string, number> = {};

  for (const [norm, entry] of wordMap) {
    const firstChar = norm.charAt(0);
    if (!byLetter.has(firstChar)) {
      byLetter.set(firstChar, {});
    }
    byLetter.get(firstChar)![norm] = [entry.original, entry.count, entry.refs];
    letterCounts[firstChar] = (letterCounts[firstChar] ?? 0) + 1;
  }

  const index: ConcordanceIndex = {
    ...letterCounts,
    _total: wordMap.size,
    _verses: totalVerses,
  };

  await db.transaction('rw', db.settings, async () => {
    await db.settings.put({ key: indexKey(translation), value: index });
    for (const [letter, data] of byLetter) {
      await db.settings.put({ key: letterKey(translation, letter), value: data });
    }
  });

  return index;
}

export async function removeLocalConcordance(translation: string): Promise<void> {
  const keys = await db.settings
    .where('key')
    .startsWith(`${SETTINGS_PREFIX}${translation}:`)
    .primaryKeys();
  if (keys.length) {
    await db.settings.bulkDelete(keys);
  }
}
