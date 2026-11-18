/**
 * Consulta ao léxico grego e hebraico, feita para o Assistente bíblico.
 *
 * Aceita o que o pregador tiver à mão: a palavra em português ("paz",
 * "graça"), a transliteração ("shalom", "agape"), o número de Strong
 * ("H7965", "G26") ou a palavra escrita no original ("שלום", "ἀγάπη").
 *
 * O que está em português vem primeiro: o dicionário teológico, os grupos de
 * sentido e os dicionários importados. O léxico de Strong embutido entra por
 * último e é marcado como em inglês.
 */
import { normalize } from '../bible/canon';
import {
  bareLemma,
  findByLemma,
  findByTransliteration,
  formatDefinition,
  lookupBuiltinStrong,
  translitKey,
} from '../bible/lexicon';
import { findGroupForStrong, getSemanticGroups, getTheologicalDict, type SemanticGroup, type TheologicalEntry } from '../bible/reference-data';
import { findVersesWithStrong, getBook, type StrongOccurrence } from '../bible/repository';
import { lookupStrong } from './dictionaries';

export interface LexiconHit {
  code: string;
  language: 'hebraico' | 'grego';
  /** A palavra no original. */
  word?: string;
  translit?: string;
  pron?: string;
  /** Verbetes do dicionário teológico que usam esta palavra (em português). */
  doctrines: Array<{ termo: string; definicao: string }>;
  /** O grupo de palavras parecidas e o sentido de cada uma (em português). */
  group: SemanticGroup | null;
  /** Dicionários que o pregador importou. */
  imported: Array<{ dictionary: string; topic?: string; definition: string }>;
  /** O Strong embutido — em inglês, por isso fica à parte. */
  builtin?: string;
  /** Versículos com este número na tradução em uso (só nas que trazem Strong). */
  occurrences: StrongOccurrence[];
}

const CODE_RE = /^\s*([HGhg])\s*0*(\d{1,5})\s*$/;
const BUILTIN_NAME = 'Léxico Strong (embutido)';

const plainPt = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, ' ').trim();
const isOriginalScript = (s: string) => /[֐-׿Ͱ-Ͽἀ-῿]/.test(s);

function codesOf(e: TheologicalEntry): string[] {
  return [e.hebraico?.strong, e.grego?.strong]
    .flatMap((c) => (c ?? '').split('+'))
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

/** Os números de Strong que respondem à consulta, do mais seguro ao menos. */
export async function resolveLexiconQuery(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const code = q.match(CODE_RE);
  if (code) return [`${code[1].toUpperCase()}${code[2]}`];

  const out: string[] = [];
  const add = (c?: string) => { const n = c?.trim().toUpperCase(); if (n && !out.includes(n)) out.push(n); };

  if (isOriginalScript(q)) {
    const key = bareLemma(q);
    const dict = await getTheologicalDict();
    for (const e of dict) {
      for (const o of [e.hebraico, e.grego]) if (o && bareLemma(o.palavra) === key) o.strong?.split('+').forEach(add);
    }
    for (const e of await findByLemma(q, 4)) add(e.code);
    return out.slice(0, 6);
  }

  const pt = plainPt(q);
  const tkey = translitKey(q);
  const dict = await getTheologicalDict();
  // 1) o termo em português do dicionário teológico ("graça", "fé", "paz")
  for (const e of dict) {
    const termos = e.termo.split(/\s*[/—–-]\s*/).map(plainPt);
    if (termos.includes(pt)) codesOf(e).forEach(add);
  }
  // 2) a transliteração, no dicionário teológico e nos grupos
  for (const e of dict) {
    for (const o of [e.hebraico, e.grego]) if (o && tkey.length >= 3 && translitKey(o.translit) === tkey) o.strong?.split('+').forEach(add);
  }
  const groups = await getSemanticGroups().catch(() => [] as SemanticGroup[]);
  for (const g of groups) {
    for (const t of g.termos) if (tkey.length >= 3 && translitKey(t.translit) === tkey) add(t.strong);
  }
  for (const e of await findByTransliteration(q, 3)) add(e.code);
  // 3) o sentido em português nos grupos ("amor" acha agapē e phileō)
  if (!out.length && pt.length >= 3) {
    for (const g of groups) {
      const inName = plainPt(g.nome).split(' ').includes(pt);
      for (const t of g.termos) if (inName || ` ${plainPt(t.sentido)} `.includes(` ${pt} `)) add(t.strong);
    }
  }
  // 4) o termo que só começa igual ("santo" → "Santidade")
  if (!out.length && pt.length >= 4) {
    for (const e of dict) if (plainPt(e.termo).split(' ').some((w) => w.startsWith(pt.slice(0, 5)))) codesOf(e).forEach(add);
  }
  return out.slice(0, 6);
}

/** Tudo o que o aparelho sabe sobre um número de Strong. */
export async function lexiconHit(code: string, translation: string): Promise<LexiconHit> {
  const norm = code.toUpperCase().replace(/^([HG])0*/, '$1');
  const [builtin, defs, group, dict, occurrences] = await Promise.all([
    lookupBuiltinStrong(norm).catch(() => null),
    lookupStrong(norm).catch(() => []),
    findGroupForStrong(norm).catch(() => null),
    getTheologicalDict(),
    findVersesWithStrong(translation, norm, 8).catch(() => [] as StrongOccurrence[]),
  ]);
  const doctrines = dict
    .filter((e) => codesOf(e).includes(norm))
    .map((e) => ({ termo: e.termo, definicao: e.definicao }));
  const fromDict = dict.flatMap((e) => [e.hebraico, e.grego]).find((o) => o?.strong?.split('+').map((c) => c.trim()).includes(norm));
  const fromGroup = group?.termos.find((t) => t.strong === norm);
  return {
    code: norm,
    language: norm.startsWith('H') ? 'hebraico' : 'grego',
    word: fromDict?.palavra ?? builtin?.lemma ?? fromGroup?.lemma,
    translit: fromDict?.translit ?? fromGroup?.translit ?? builtin?.translit,
    pron: builtin?.pron,
    doctrines,
    group,
    imported: defs.filter((d) => d.dictionary !== BUILTIN_NAME),
    builtin: builtin ? formatDefinition(builtin) : undefined,
    occurrences,
  };
}

/** A consulta inteira: os números encontrados e o verbete de cada um. */
export async function lookupLexicon(query: string, translation: string): Promise<LexiconHit[]> {
  const codes = await resolveLexiconQuery(query);
  return Promise.all(codes.map((c) => lexiconHit(c, translation)));
}

export interface PassageWord {
  code: string;
  word?: string;
  translit?: string;
}

/**
 * As palavras do original que o aparelho conhece numa passagem: os números de
 * Strong da tradução (quando ela os traz) e as palavras do dicionário
 * teológico ligadas a esses versículos. Para o léxico abaixo do versículo.
 */
export async function passageWords(
  translation: string,
  target: { book: string; chapter: number; verse: number; verseEnd?: number },
  limit = 14,
): Promise<PassageWord[]> {
  const from = target.verse;
  const to = target.verseEnd && target.verseEnd > from ? target.verseEnd : from;
  const codes: string[] = [];
  const add = (c?: string) => { const n = c?.trim().toUpperCase().replace(/^([HG])0*/, '$1'); if (n && /^[HG]\d+$/.test(n) && !codes.includes(n)) codes.push(n); };

  // primeiro o dicionário teológico: palavras com peso doutrinário
  const dict = await getTheologicalDict();
  for (let v = from; v <= to; v++) {
    const key = `${target.book}.${target.chapter}.${v}`;
    for (const e of dict) if (e.textos.includes(key)) codesOf(e).forEach(add);
  }
  // depois o que a tradução marca palavra por palavra
  const record = await getBook(translation, target.book).catch(() => null);
  for (let v = from; v <= to; v++) {
    for (const [, code] of record?.strongs?.[target.chapter - 1]?.[v - 1] ?? []) add(code);
  }

  const out: PassageWord[] = [];
  for (const code of codes.slice(0, limit)) {
    const fromDict = dict.flatMap((e) => [e.hebraico, e.grego]).find((o) => o?.strong?.split('+').map((c) => c.trim()).includes(code));
    const builtin = fromDict ? null : await lookupBuiltinStrong(code).catch(() => null);
    out.push({ code, word: fromDict?.palavra ?? builtin?.lemma, translit: fromDict?.translit ?? builtin?.translit });
  }
  return out;
}
