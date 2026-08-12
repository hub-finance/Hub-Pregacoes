import { db } from '../db/db';
import { CANON_BY_OSIS } from './canon';
import { installTranslation, type InstallProgress } from './repository';

/**
 * Busca no texto bíblico.
 *
 * Roda inteiramente offline sobre os livros gravados no IndexedDB. Se a
 * tradução ainda não foi baixada por completo, `ensureSearchable` cuida disso
 * mostrando progresso ao usuário.
 */

/**
 * Versão "dobrada" (sem acento, minúscula) preservando o comprimento original,
 * para que os índices de match apontem para o texto exibido.
 */
export function fold(text: string): string {
  let out = '';
  for (const ch of text) {
    const stripped = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += stripped.length === 1 ? stripped : ch.toLowerCase();
  }
  return out;
}

export type SearchScope = 'all' | 'AT' | 'NT' | string;

export interface SearchOptions {
  translation: string;
  scope?: SearchScope;
  /** Frase exata (mantém a ordem das palavras). */
  phrase?: boolean;
  /** Somente palavra inteira. */
  wholeWord?: boolean;
  limit?: number;
  signal?: { aborted: boolean };
}

export interface SearchHit {
  book: string;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  ranges: Array<[number, number]>;
}

export interface SearchOutcome {
  hits: SearchHit[];
  total: number;
  truncated: boolean;
  tookMs: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildMatchers(query: string, opts: SearchOptions): RegExp[] {
  const quoted = query.match(/^"(.+)"$/);
  const phrase = opts.phrase || !!quoted;
  const cleaned = fold((quoted ? quoted[1] : query).trim()).replace(/\s+/g, ' ');
  if (!cleaned) return [];
  const terms = phrase ? [cleaned] : cleaned.split(' ').filter(Boolean);
  const wrap = (t: string) => (opts.wholeWord ? `(?<![\\p{L}\\d])${t}(?![\\p{L}\\d])` : t);
  return terms.map((t) => new RegExp(wrap(escapeRe(t)), 'gu'));
}

function inScope(book: string, scope: SearchScope): boolean {
  if (!scope || scope === 'all') return true;
  if (scope === 'AT' || scope === 'NT') return CANON_BY_OSIS.get(book)?.testament === scope;
  return book === scope;
}

/** Garante que a tradução esteja completa no dispositivo antes de buscar. */
export async function ensureSearchable(
  translation: string,
  onProgress?: (p: InstallProgress) => void,
): Promise<void> {
  const count = await db.books.where('translation').equals(translation).count();
  if (count >= 66) return;
  await installTranslation(translation, onProgress);
}

export async function searchScripture(
  query: string,
  options: SearchOptions,
): Promise<SearchOutcome> {
  const started = performance.now();
  const limit = options.limit ?? 400;
  const matchers = buildMatchers(query, options);
  if (!matchers.length) return { hits: [], total: 0, truncated: false, tookMs: 0 };

  const hits: SearchHit[] = [];
  let total = 0;

  const records = await db.books.where('translation').equals(options.translation).toArray();
  records.sort(
    (a, b) => (CANON_BY_OSIS.get(a.book)?.order ?? 99) - (CANON_BY_OSIS.get(b.book)?.order ?? 99),
  );

  for (const record of records) {
    if (options.signal?.aborted) break;
    if (!inScope(record.book, options.scope ?? 'all')) continue;
    const name = CANON_BY_OSIS.get(record.book)?.name ?? record.book;

    for (let c = 0; c < record.chapters.length; c++) {
      const chapter = record.chapters[c];
      for (let v = 0; v < chapter.length; v++) {
        const text = chapter[v];
        if (!text) continue;
        const folded = fold(text);

        const ranges: Array<[number, number]> = [];
        let all = true;
        for (const re of matchers) {
          re.lastIndex = 0;
          let found = false;
          let m: RegExpExecArray | null;
          while ((m = re.exec(folded))) {
            found = true;
            ranges.push([m.index, m.index + m[0].length]);
            if (m.index === re.lastIndex) re.lastIndex++;
          }
          if (!found) {
            all = false;
            break;
          }
        }
        if (!all) continue;

        total += 1;
        if (hits.length < limit) {
          ranges.sort((a, b) => a[0] - b[0]);
          hits.push({
            book: record.book,
            bookName: name,
            chapter: c + 1,
            verse: v + 1,
            text,
            ranges: mergeRanges(ranges),
          });
        }
      }
    }
  }

  return {
    hits,
    total,
    truncated: total > hits.length,
    tookMs: Math.round(performance.now() - started),
  };
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([...r] as [number, number]);
  }
  return out;
}

/** Divide o texto em segmentos marcados/não marcados para renderização. */
export function splitHighlights(
  text: string,
  ranges: Array<[number, number]>,
): Array<{ text: string; match: boolean }> {
  if (!ranges.length) return [{ text, match: false }];
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}
