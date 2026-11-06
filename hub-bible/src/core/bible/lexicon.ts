/**
 * Léxico de Strong embutido (inglês, domínio público).
 *
 * Carrega sob demanda os arquivos de `public/lexicon/` gerados pelo script
 * `build-lexicon.mjs` a partir do repositório Open Scriptures (CC BY-SA).
 *
 * O léxico aparece como fonte virtual na lista de dicionários e na busca,
 * sem precisar de importação. Quando o usuário também importou um léxico,
 * os dois aparecem lado a lado.
 */

export interface LexiconEntry {
  code: string;
  lemma?: string;
  translit?: string;
  pron?: string;
  derivation?: string;
  definition?: string;
  kjv?: string;
}

interface CompactEntry {
  l?: string;
  t?: string;
  p?: string;
  d?: string;
  s?: string;
  k?: string;
}

type LexiconData = Record<string, CompactEntry>;

const BASE = `${import.meta.env.BASE_URL}lexicon/`;

let greekCache: LexiconData | null = null;
let hebrewCache: LexiconData | null = null;
let available: boolean | null = null;

async function loadFile(name: string): Promise<LexiconData | null> {
  try {
    const res = await fetch(`${BASE}${name}`, { cache: 'default' });
    if (!res.ok) return null;
    return await res.json() as LexiconData;
  } catch {
    return null;
  }
}

async function loadGreek(): Promise<LexiconData> {
  if (!greekCache) greekCache = await loadFile('strongs-grego.json') ?? {};
  return greekCache;
}

async function loadHebrew(): Promise<LexiconData> {
  if (!hebrewCache) hebrewCache = await loadFile('strongs-hebraico.json') ?? {};
  return hebrewCache;
}

function expand(code: string, raw: CompactEntry): LexiconEntry {
  return {
    code,
    lemma: raw.l,
    translit: raw.t,
    pron: raw.p,
    derivation: raw.d,
    definition: raw.s,
    kjv: raw.k,
  };
}

function formatDefinition(entry: LexiconEntry): string {
  const parts: string[] = [];
  if (entry.lemma) parts.push(`<strong>${entry.lemma}</strong>`);
  if (entry.translit) parts.push(`<em>${entry.translit}</em>`);
  if (entry.pron) parts.push(`(${entry.pron})`);
  if (entry.derivation) parts.push(entry.derivation);
  if (entry.definition) parts.push(entry.definition);
  if (entry.kjv) parts.push(`KJV: ${entry.kjv}`);
  return parts.join(' — ');
}

export async function isLexiconAvailable(): Promise<boolean> {
  if (available !== null) return available;
  const res = await fetch(`${BASE}strongs-hebraico.json`, { method: 'HEAD', cache: 'default' }).catch(() => null);
  available = res?.ok ?? false;
  return available;
}

export async function lexiconEntryCount(): Promise<number> {
  if (!await isLexiconAvailable()) return 0;
  const [g, h] = await Promise.all([loadGreek(), loadHebrew()]);
  return Object.keys(g).length + Object.keys(h).length;
}

/**
 * Busca um código Strong no léxico embutido.
 *
 * O código já vem normalizado (H430, G25) — sem zeros à esquerda.
 */
export async function lookupBuiltinStrong(code: string): Promise<LexiconEntry | null> {
  if (!await isLexiconAvailable()) return null;
  const norm = code.replace(/^([HGhg])?0*(\d+)$/, (_, p, n) => `${(p ?? '').toUpperCase()}${n}`);
  const prefix = norm.charAt(0);

  if (prefix === 'G') {
    const data = await loadGreek();
    const raw = data[norm];
    return raw ? expand(norm, raw) : null;
  }
  if (prefix === 'H') {
    const data = await loadHebrew();
    const raw = data[norm];
    return raw ? expand(norm, raw) : null;
  }

  const [g, h] = await Promise.all([loadGreek(), loadHebrew()]);
  const gEntry = g[`G${norm}`];
  if (gEntry) return expand(`G${norm}`, gEntry);
  const hEntry = h[`H${norm}`];
  if (hEntry) return expand(`H${norm}`, hEntry);
  return null;
}

/**
 * Busca por prefixo no léxico embutido — para sugestões e listagens.
 */
export async function searchBuiltinLexicon(
  prefix: string,
  limit = 20,
): Promise<Array<{ code: string; definition: string }>> {
  if (!await isLexiconAvailable()) return [];

  const norm = prefix.trim().toUpperCase();
  if (!norm) return [];

  const results: Array<{ code: string; definition: string }> = [];

  const matchesCode = /^[HG]?\d/.test(norm);
  if (!matchesCode) {
    const lower = prefix.trim().toLowerCase();
    const [g, h] = await Promise.all([loadGreek(), loadHebrew()]);
    for (const [code, raw] of Object.entries(h)) {
      if (results.length >= limit) break;
      const entry = expand(code, raw);
      const text = [entry.lemma, entry.translit, entry.definition, entry.kjv]
        .filter(Boolean).join(' ').toLowerCase();
      if (text.includes(lower)) {
        results.push({ code, definition: formatDefinition(entry) });
      }
    }
    for (const [code, raw] of Object.entries(g)) {
      if (results.length >= limit) break;
      const entry = expand(code, raw);
      const text = [entry.lemma, entry.translit, entry.definition, entry.kjv]
        .filter(Boolean).join(' ').toLowerCase();
      if (text.includes(lower)) {
        results.push({ code, definition: formatDefinition(entry) });
      }
    }
    return results;
  }

  const wantH = norm.startsWith('H') || !norm.startsWith('G');
  const wantG = norm.startsWith('G') || !norm.startsWith('H');
  const numPart = norm.replace(/^[HG]/, '');

  if (wantH) {
    const data = await loadHebrew();
    for (const [code, raw] of Object.entries(data)) {
      if (results.length >= limit) break;
      const codeNum = code.replace(/^H/, '');
      if (codeNum.startsWith(numPart) || code.startsWith(norm)) {
        results.push({ code, definition: formatDefinition(expand(code, raw)) });
      }
    }
  }
  if (wantG) {
    const data = await loadGreek();
    for (const [code, raw] of Object.entries(data)) {
      if (results.length >= limit) break;
      const codeNum = code.replace(/^G/, '');
      if (codeNum.startsWith(numPart) || code.startsWith(norm)) {
        results.push({ code, definition: formatDefinition(expand(code, raw)) });
      }
    }
  }

  return results;
}

/**
 * Chave de comparação para transliterações: sem acentos, sem os sinais de
 * aleph/ayin e com as grafias de Strong aproximadas às usuais
 * ("ʼĕmûwnâh" → "emunah", "râphâʼ" → "rapha", "pístis" → "pistis").
 */
export function translitKey(word: string): string {
  return word
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[ʼʻʾʿ'’`]/g, '')
    .replace(/uw/g, 'u')
    .replace(/ow/g, 'o')
    .replace(/[^a-z]/g, '');
}

let translitIndex: Map<string, string[]> | null = null;

async function loadTranslitIndex(): Promise<Map<string, string[]>> {
  if (translitIndex) return translitIndex;
  const [g, h] = await Promise.all([loadGreek(), loadHebrew()]);
  const index = new Map<string, string[]>();
  for (const data of [h, g]) {
    for (const [code, raw] of Object.entries(data)) {
      if (!raw.t) continue;
      const key = translitKey(raw.t);
      if (!key) continue;
      const list = index.get(key);
      if (list) list.push(code);
      else index.set(key, [code]);
    }
  }
  translitIndex = index;
  return index;
}

/**
 * Procura verbetes cuja transliteração coincide com a palavra digitada
 * ("pistis", "emunah", "rhema"). Aceita também a forma sem o "h" final.
 */
export async function findByTransliteration(word: string, limit = 2): Promise<LexiconEntry[]> {
  if (!await isLexiconAvailable()) return [];
  const key = translitKey(word);
  if (key.length < 4) return [];
  const index = await loadTranslitIndex();
  const codes = index.get(key) ?? index.get(`${key}h`) ?? (key.endsWith('h') ? index.get(key.slice(0, -1)) : undefined) ?? [];
  const out: LexiconEntry[] = [];
  for (const code of codes.slice(0, limit)) {
    const entry = await lookupBuiltinStrong(code);
    if (entry) out.push(entry);
  }
  return out;
}

export { formatDefinition };
