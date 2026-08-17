import canonJson from './canon.json';

export interface CanonBook {
  osis: string;
  order: number;
  name: string;
  abbrev: string;
  testament: 'AT' | 'NT';
  aliases: string[];
}

/** Lista canônica dos 66 livros — fonte única de nomes, ordem e apelidos. */
export const CANON = canonJson as CanonBook[];

export const CANON_BY_OSIS = new Map(CANON.map((b) => [b.osis, b]));

/** Remove acentos e coloca em minúsculas (para busca tolerante). */
export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const ALIAS_INDEX = (() => {
  const map = new Map<string, CanonBook>();
  for (const b of CANON) {
    // o código OSIS entra por último para nunca sobrescrever um apelido em português
    for (const alias of [normalize(b.name), normalize(b.abbrev), ...b.aliases, b.osis.toLowerCase()]) {
      if (!map.has(alias)) map.set(alias, b);
    }
  }
  return map;
})();

/** Índice sensível a acento (resolve "jó" x "jo"). */
const EXACT_INDEX = (() => {
  const map = new Map<string, CanonBook>();
  for (const b of CANON) {
    map.set(b.name.toLowerCase(), b);
    map.set(b.abbrev.toLowerCase(), b);
  }
  return map;
})();

/**
 * Resolve o nome de um livro. Aceita nome completo, abreviação, com/sem acento,
 * com/sem espaço no ordinal ("1co", "1 Coríntios", "primeira aos corintios").
 */
export function findBook(input: string): CanonBook | undefined {
  const raw = input.trim().toLowerCase();
  if (!raw) return undefined;
  const exact = EXACT_INDEX.get(raw);
  if (exact) return exact;

  const key = normalize(raw).replace(/\.$/, '');
  const direct = ALIAS_INDEX.get(key) ?? ALIAS_INDEX.get(key.replace(/\s+/g, ''));
  if (direct) return direct;

  // ordinal escrito por extenso ou em romano
  const ordinals: Record<string, string> = {
    primeiro: '1', primeira: '1', i: '1',
    segundo: '2', segunda: '2', ii: '2',
    terceiro: '3', terceira: '3', iii: '3',
  };
  const parts = key.split(/\s+/);
  if (parts.length > 1 && ordinals[parts[0]]) {
    const rebuilt = ordinals[parts[0]] + parts.slice(1).join(' ').replace(/^(aos?|as?|de|do|da)\s+/, '');
    const hit = ALIAS_INDEX.get(rebuilt) ?? ALIAS_INDEX.get(rebuilt.replace(/\s+/g, ''));
    if (hit) return hit;
  }

  // prefixo único (ex.: "coloss")
  if (key.length >= 3) {
    const matches = CANON.filter((b) => normalize(b.name).replace(/\s+/g, '').startsWith(key.replace(/\s+/g, '')));
    if (matches.length === 1) return matches[0];
  }

  /* Nome estendido: "Lamentações de Jeremias", "Apocalipse de João" — comuns em
     arquivos de Bíblia. O nome canônico é o começo do que veio, e o que sobra
     tem de ser palavra: assim "Jó" não engole "Jo 3", cujo resto é número.
     Ganha o nome mais longo, para "Cântico dos Cânticos" não perder para
     um começo mais curto. */
  const spaced = key.replace(/\s+/g, ' ');
  let best: { book: CanonBook; length: number } | undefined;
  for (const b of CANON) {
    // apelidos curtos ("jo", "ex") fora: engoliriam qualquer frase que comece assim
    for (const label of [normalize(b.name), ...b.aliases].filter((l) => l.length >= 4)) {
      if (!spaced.startsWith(`${label} `)) continue;
      if (!/[a-z]/.test(spaced.slice(label.length + 1))) continue;
      if (!best || label.length > best.length) best = { book: b, length: label.length };
    }
  }
  if (best) return best.book;

  return undefined;
}

export const bookName = (osis: string): string => CANON_BY_OSIS.get(osis)?.name ?? osis;
export const bookAbbrev = (osis: string): string => CANON_BY_OSIS.get(osis)?.abbrev ?? osis;

export const OLD_TESTAMENT = CANON.filter((b) => b.testament === 'AT');
export const NEW_TESTAMENT = CANON.filter((b) => b.testament === 'NT');
