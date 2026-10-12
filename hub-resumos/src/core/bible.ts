import canonJson from './canon.json';

/**
 * Referências bíblicas escritas no meio do texto ("João 15:5", "Rm 8.28",
 * "1 Co 13", "Salmos 23:1-6"). A lista de livros é a mesma do Hub Bible.
 *
 * Para não confundir palavras comuns com abreviações ("At 2" pode ser
 * Atos, "at" nunca é), o nome do livro precisa começar com maiúscula e vir
 * seguido do número do capítulo.
 */

interface CanonBook {
  osis: string;
  order: number;
  name: string;
  abbrev: string;
  testament: 'AT' | 'NT';
  aliases: string[];
}

export const CANON = canonJson as CanonBook[];

export const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const ALIASES = (() => {
  const map = new Map<string, CanonBook>();
  for (const b of CANON) {
    for (const alias of [fold(b.name), fold(b.abbrev), ...b.aliases.map(fold)]) {
      const key = alias.replace(/\s+/g, '');
      if (key && !map.has(key)) map.set(key, b);
    }
  }
  return map;
})();

export interface FoundReference {
  /** Como fica escrito: "João 15:5". */
  label: string;
  osis: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
  /** Posição no texto e o trecho exatamente como foi escrito. */
  index: number;
  raw: string;
}

// [1-3] opcional, nome (letras, pontos), capítulo, versículo e fim opcionais
const REF_RE =
  /(?<![\p{L}\d])([1-3](?:\s?|º\s?)?)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\p{L}]{0,14}\.?)\s{0,2}(\d{1,3})(?:\s?[:.,]\s?(\d{1,3})(?:\s?[-–]\s?(\d{1,3}))?)?(?![\p{L}\d])/gu;

export function findReferences(text: string): FoundReference[] {
  const out: FoundReference[] = [];
  for (const m of text.matchAll(REF_RE)) {
    const prefix = (m[1] ?? '').replace(/[^1-3]/g, '');
    const key = fold(`${prefix}${m[2]}`).replace(/[.\s]/g, '');
    const book = ALIASES.get(key);
    if (!book) continue;
    const chapter = Number(m[3]);
    const verse = m[4] ? Number(m[4]) : undefined;
    const verseEnd = m[5] ? Number(m[5]) : undefined;
    if (!chapter || chapter > 150) continue;
    // abreviação curta sem versículo é ambígua demais ("Os 3 pontos", "Is 2
    // vezes"); vale só com versículo, com número na frente ou com o nome inteiro
    const shortForm = m[2].replace('.', '').length <= 3 && fold(m[2]) !== fold(book.name);
    if (shortForm && !verse && !prefix) continue;
    out.push({
      label: formatRef(book.osis, chapter, verse, verseEnd),
      osis: book.osis,
      chapter,
      verse,
      verseEnd: verseEnd && verse && verseEnd > verse ? verseEnd : undefined,
      index: m.index ?? 0,
      raw: m[0],
    });
  }
  return out;
}

export function bookName(osis: string): string {
  return CANON.find((b) => b.osis === osis)?.name ?? osis;
}

export function formatRef(osis: string, chapter: number, verse?: number, verseEnd?: number): string {
  const name = bookName(osis);
  if (!verse) return `${name} ${chapter}`;
  return `${name} ${chapter}:${verse}${verseEnd && verseEnd > verse ? `-${verseEnd}` : ''}`;
}

/**
 * Link para abrir a referência no Hub Bible, quando o endereço dele estiver
 * configurado. Sem endereço, não há link — o Hub Resumos funciona sem o Hub.
 */
export function hubBibleLink(hubUrl: string, ref: Pick<FoundReference, 'osis' | 'chapter' | 'verse'>): string | null {
  const base = hubUrl.trim().replace(/#.*$/, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) return null;
  const page = /\.html?$/i.test(base) ? base : `${base}/index.html`;
  return `${page}#/biblia/${ref.osis}/${ref.chapter}${ref.verse ? `?v=${ref.verse}` : ''}`;
}
