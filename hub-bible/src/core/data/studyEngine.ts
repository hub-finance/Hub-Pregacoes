/**
 * Motor de estudo sem IA — o assistente bíblico produzindo como o Hub Resumos.
 *
 * Princípio de autoria (o mesmo do Hub Resumos): sem a IA, nada é inventado.
 * Tudo o que aparece está literalmente nas fontes do aparelho — o texto da
 * Bíblia em uso, o dicionário teológico, o léxico de Strong (embutido ou
 * importado), a tipologia, as referências cruzadas, os guias e a base
 * doutrinária do pregador. A interpretação e a aplicação ficam para ele,
 * em espaços marcados.
 *
 * A ordem segue a hierarquia do Prompt Mestre: texto → contexto → língua
 * original → teologia bíblica → Cristo e Nova Aliança → doutrina → aplicação.
 */

import { findVersesWithStrong, getChapter, getVerses, loadAvailableTranslations } from '../bible/repository';
import { formatReference, parseReference, type ParsedReference } from '../bible/reference';
import { bookName, CANON_BY_OSIS, findBook, normalize } from '../bible/canon';
import { OSIS_TO_MYBIBLE_NUMBER } from '../bible/mybible';
import { lookupCommentary } from './commentaries';
import { findByTransliteration, lookupBuiltinStrong } from '../bible/lexicon';
import { ensureSearchable, searchScripture } from '../bible/search';
import { lookupStrong, lookupTopic } from './dictionaries';
import {
  findGroupForStrong,
  findTypologyForVerse,
  getCrossReferences,
  getDoctrinalGuides,
  getTheologicalDict,
  getTypology,
  type DoctrinalGuide,
  type SemanticGroup,
  type TheologicalEntry,
  type TypologyPair,
} from '../bible/reference-data';
import { findGuidesForPassage, getDoctrinalPack } from '../bible/doctrinalPack';
import { validateReferences } from '../ai/provider';
import { findRequestReferences, type AssistantDepth, type AssistantMode } from '../ai/assistant';
import type { AssistantGoal } from '../ai/assistantDocument';
import { keySentences, readMaterialTheology, sentencesAbout, sentencesCiting, type AssistantMaterial, type CitedRef, type MaterialReading, type PartReading } from './assistantMaterials';

export interface EngineInput {
  text: string;
  passage: string;
  translation: string;
  goal: AssistantGoal;
  mode: AssistantMode;
  depth: AssistantDepth;
  /** Livro, apostila, estudo ou mensagem importado: o estudo parte dele. */
  material?: AssistantMaterial | null;
  /** Um segundo material, lido junto com o primeiro. */
  material2?: AssistantMaterial | null;
}

export interface EngineOutput {
  content: string;
  validRefs: string[];
  sources: string[];
}

/* ─────────────────────────────── limites ─────────────────────────────── */

/** Poucos pontos, bem escolhidos — o princípio do Hub Resumos. */
const LIMITS: Record<AssistantDepth, { texts: number; cross: number; terms: number; entries: number }> = {
  objetivo: { texts: 4, cross: 3, terms: 2, entries: 1 },
  auto: { texts: 6, cross: 5, terms: 3, entries: 2 },
  profundo: { texts: 10, cross: 8, terms: 5, entries: 4 },
};

const WRITE = '*Para você escrever.*';

/** Palavras do pedido que não são tema ("estude", "sobre", "faça"…). */
const STOP = new Set([
  'para', 'pela', 'pelo', 'como', 'sobre', 'entre', 'mais', 'onde', 'qual', 'quais', 'quem', 'essa', 'esse',
  'esta', 'este', 'isso', 'isto', 'minha', 'meu', 'tema', 'texto', 'textos', 'mesmo', 'pode', 'cada', 'toda',
  'todo', 'tudo', 'nada', 'aqui', 'agora', 'antes', 'depois', 'sem', 'com', 'que', 'uma', 'umas', 'uns', 'dos',
  'das', 'nos', 'nas', 'mostre', 'faca', 'faça', 'estude', 'estudo', 'analise', 'compare', 'explique',
  'prepare', 'encontre', 'confira', 'pregacao', 'pregação', 'mensagem', 'doutrina', 'palavra', 'significado',
  'significa', 'relacao', 'relação', 'biblia', 'bíblia', 'profundamente', 'sistematico', 'sistemático',
  'resumo', 'resuma', 'quero', 'gostaria', 'fale', 'falar', 'dizer', 'diz', 'deus', 'senhor', 'jesus',
  'cristo', 'livro', 'capitulo', 'capítulo', 'versiculo', 'versículo', 'exegese', 'estudar', 'interpretacao',
  'interpretação', 'correta', 'correto', 'minha', 'favor', 'fala', 'falam', 'ensina', 'ensinam', 'mostra',
  'mostram', 'existe', 'existem', 'vida', 'cristã', 'cristão', 'cristao', 'crista', 'escritura', 'escrituras',
  'tudo', 'ainda', 'muito', 'muita', 'sempre', 'nunca', 'então', 'entao', 'porque', 'quando', 'também', 'tambem',
]);

/* ─────────────────────────────── utilidades ─────────────────────────────── */

const plain = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, ' ').trim();

function osisToRef(key: string): ParsedReference | null {
  const [book, chapter, verse] = key.split('.');
  if (!book || !chapter) return null;
  return { book, chapter: Number(chapter), verse: verse ? Number(verse) : undefined };
}

const refKey = (r: ParsedReference) => `${r.book}.${r.chapter}.${r.verse ?? ''}.${r.verseEnd ?? ''}`;

async function verseText(translation: string, ref: ParsedReference): Promise<string> {
  if (!ref.verse) return '';
  const rows = await getVerses({
    translation, book: ref.book, chapter: ref.chapter, verse: ref.verse, verseEnd: ref.verseEnd,
  }).catch(() => []);
  if (!rows.length) return '';
  return rows.length === 1 ? rows[0].text : rows.map((r) => `${r.verse} ${r.text}`).join(' ');
}

/** Citação com a referência tocável — o texto é o da Bíblia em uso, nunca outro. */
async function quote(translation: string, ref: ParsedReference): Promise<string> {
  const text = await verseText(translation, ref);
  return text ? `> ${text} — [${formatReference(ref)}]` : '';
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* ───────────────────────────── a coleta ───────────────────────────── */

interface Gathered {
  title: string;
  main: ParsedReference | null;
  keyTexts: ParsedReference[];
  entries: TheologicalEntry[];
  lexicon: Array<{ code: string; source: string; text: string }>;
  cross: ParsedReference[];
  types: TypologyPair[];
  guides: Array<{ guide: DoctrinalGuide; steps: DoctrinalGuide['passos'] }>;
  pack: Array<{ titulo: string; conceito: string; resumo: string; explicacao: string; aplicacao?: string; textos: string[] }>;
  searchTerm: string;
  /** Família de palavras do original (sentido em português). */
  families: SemanticGroup[];
  /** Onde a Bíblia usa cada palavra do original (por Strong). */
  concord: Array<{ translit: string; code: string; total: number; refs: ParsedReference[] }>;
  /** Verbetes do dicionário bíblico que o pregador importou. */
  topics: Array<{ dictionary: string; topic: string; text: string }>;
  /** Comentários importados sobre o versículo principal. */
  comments: Array<{ name: string; ref: ParsedReference; text: string }>;
  sources: string[];
}

const testament = (r: ParsedReference) => CANON_BY_OSIS.get(r.book)?.testament ?? 'AT';

/**
 * Escolhe `n` versículos espalhados: os dois Testamentos (metade de cada, o que
 * faltar num vem do outro) e, dentro de cada um, um livro de cada vez antes de
 * repetir livro. A busca devolve na ordem da Bíblia — sem isso, um tema como
 * "santidade" ficava só em Êxodo e Levítico.
 */
function balance(refs: ParsedReference[], n: number): ParsedReference[] {
  const spread = (list: ParsedReference[]) => {
    const byBook = new Map<string, ParsedReference[]>();
    for (const r of list) byBook.set(r.book, [...(byBook.get(r.book) ?? []), r]);
    const out: ParsedReference[] = [];
    for (let round = 0; out.length < list.length; round++) {
      let added = false;
      for (const items of byBook.values()) if (items[round]) { out.push(items[round]); added = true; }
      if (!added) break;
    }
    return out;
  };
  const at = spread(refs.filter((r) => testament(r) === 'AT'));
  const nt = spread(refs.filter((r) => testament(r) === 'NT'));
  let wantNt = Math.min(nt.length, Math.ceil(n / 2));
  const wantAt = Math.min(at.length, n - wantNt);
  wantNt = Math.min(nt.length, n - wantAt);
  const chosen = [...at.slice(0, wantAt), ...nt.slice(0, wantNt)];
  const order = (r: ParsedReference) => (CANON_BY_OSIS.get(r.book)?.order ?? 99) * 1e6 + r.chapter * 1e3 + (r.verse ?? 0);
  return chosen.sort((a, b) => order(a) - order(b));
}

const variantsOf = (e: TheologicalEntry) => e.termo.split(/\s+[—–-]\s+|\s*\/\s*/).map(plain).filter((t) => t.length >= 2);

/**
 * Verbetes do dicionário ligados ao tema, do mais ao menos direto: o nome
 * escrito no pedido; o verbete que começa pela palavra ("santidade" →
 * "Santidade de Deus"); e a mesma raiz ("santidade" → "Santificação").
 */
function matchEntries(dict: TheologicalEntry[], text: string, words: string[]): TheologicalEntry[] {
  const normText = ` ${plain(text)} `;
  const keys = words.map(plain).filter((w) => w.length >= 4);
  const exact: TheologicalEntry[] = [];
  const starts: TheologicalEntry[] = [];
  const root: TheologicalEntry[] = [];
  for (const e of dict) {
    const vs = variantsOf(e);
    if (vs.some((v) => normText.includes(` ${v} `))) { exact.push(e); continue; }
    const firsts = vs.map((v) => v.split(' ')[0]);
    if (keys.some((k) => firsts.includes(k) || plain(e.id.replace(/-/g, ' ')) === k)) { starts.push(e); continue; }
    if (keys.some((k) => k.length >= 6 && firsts.some((f) => f.length >= 6 && f.slice(0, 5) === k.slice(0, 5)))) root.push(e);
  }
  return [...exact, ...starts, ...root];
}

/**
 * Palavras do tema, da mais provável para a menos: o que vem depois de
 * "sobre" / "a respeito de" primeiro, e as palavras mais longas antes das
 * curtas ("ansiedade" antes de "fala").
 */
function themeWords(text: string): string[] {
  const words = (t: string) => [...new Set(
    (t.match(/[\p{L}-]{4,}/gu) ?? [])
      .filter((w) => !STOP.has(w.toLowerCase()) && !STOP.has(normalize(w)))
      .filter((w) => !findBook(w)),
  )];
  const after = /\b(?:sobre|a respeito d[eoa]s?|acerca d[eoa]s?)\s+(.+)$/iu.exec(text);
  const focus = after ? words(after[1]) : [];
  const rest = words(text).filter((w) => !focus.includes(w)).sort((a, b) => b.length - a.length);
  return [...focus.sort((a, b) => b.length - a.length), ...rest];
}

async function gather(input: EngineInput): Promise<Gathered> {
  const lim = LIMITS[input.depth];
  const sources = new Set<string>();

  /* passagens: a informada vem primeiro */
  const main = input.passage.trim() ? parseReference(input.passage) : null;
  const refs = [...(main ? [main] : []), ...findRequestReferences(input.text)];
  const seenRef = new Set<string>();
  const keyTexts = refs.filter((r) => !seenRef.has(refKey(r)) && !!seenRef.add(refKey(r)));
  const anchor = keyTexts.find((r) => r.verse) ?? null;

  /* verbetes do dicionário: pelo tema escrito e pelo versículo */
  const dict = await getTheologicalDict();
  const words = themeWords(input.text);
  const entries: TheologicalEntry[] = matchEntries(dict, input.text, words);
  if (anchor?.verse) {
    const key = `${anchor.book}.${anchor.chapter}.${anchor.verse}`;
    for (const e of dict) if (e.textos.includes(key) && !entries.includes(e)) entries.push(e);
  }
  const chosen = entries.slice(0, lim.entries);
  if (chosen.length) sources.add('dicionário teológico');

  /* sem passagem citada: os textos vêm do verbete; sem verbete, da busca */
  let searchTerm = '';
  if (!keyTexts.length) {
    const pool: ParsedReference[] = [];
    for (const e of chosen) {
      for (const k of e.textos) {
        const r = osisToRef(k);
        if (r && !seenRef.has(refKey(r))) { seenRef.add(refKey(r)); pool.push(r); }
      }
    }
    keyTexts.push(...balance(pool, lim.texts));
  }
  if (!keyTexts.length) {
    // a busca precisa da tradução inteira no aparelho (a Bíblia embutida já vem com o app)
    await ensureSearchable(input.translation).catch(() => undefined);
    // até duas palavras do tema; os versículos das duas entram juntos
    const found: string[] = [];
    const pool: ParsedReference[] = [];
    for (const word of words.slice(0, 4)) {
      if (found.length >= 2) break;
      // a Bíblia inteira, para depois escolher espalhado pelos dois Testamentos
      const res = await searchScripture(word, { translation: input.translation, wholeWord: true, limit: 400 })
        .catch(() => null);
      if (!res?.hits.length) continue;
      found.push(word);
      for (const h of res.hits) {
        const r = { book: h.book, chapter: h.chapter, verse: h.verse };
        if (!seenRef.has(refKey(r))) { seenRef.add(refKey(r)); pool.push(r); }
      }
    }
    keyTexts.push(...balance(pool, lim.texts));
    if (found.length) {
      searchTerm = found[0];
      sources.add(`busca na Bíblia por ${found.map((w) => `"${w}"`).join(' e ')}`);
    }
  }
  const texts = keyTexts.slice(0, Math.max(lim.texts, main ? 1 : 0));
  if (texts.length) sources.add('texto da Bíblia em uso');

  /* língua original: códigos, transliterações e os termos dos verbetes */
  const codes: string[] = [];
  const addCode = (c?: string) => { if (c && !codes.includes(c.toUpperCase())) codes.push(c.toUpperCase()); };
  (input.text.match(/\b[HG]\d{1,5}\b/gi) ?? []).forEach(addCode);
  for (const w of words.slice(0, 12)) {
    for (const entry of await findByTransliteration(w, 1)) addCode(entry.code);
  }
  // "G4151+G40" (Espírito Santo) vira dois códigos
  for (const e of chosen) {
    for (const c of [e.hebraico?.strong, e.grego?.strong]) c?.split('+').forEach((x) => addCode(x.trim()));
  }
  const lexicon: Gathered['lexicon'] = [];
  for (const code of codes.slice(0, lim.terms)) {
    const defs = await lookupStrong(code).catch(() => []);
    // o léxico importado (em geral em português) vale; o embutido é em inglês
    // e, por isso, entra só com a palavra e a transliteração
    const imported = defs.find((d) => d.dictionary !== 'Léxico Strong (embutido)');
    if (imported) {
      lexicon.push({ code, source: imported.dictionary, text: stripTags(imported.definition).slice(0, 700) });
      continue;
    }
    // a palavra já aparece pelo dicionário teológico: a linha em inglês só repetiria
    const covered = chosen.some((e) => [e.hebraico?.strong, e.grego?.strong].some((x) => x?.split('+').includes(code)));
    if (covered) continue;
    const builtin = await lookupBuiltinStrong(code).catch(() => null);
    if (builtin) {
      lexicon.push({
        code,
        source: 'léxico embutido',
        text: `${builtin.translit ?? ''}${builtin.lemma ? ` (${builtin.lemma})` : ''}. Definição só em inglês no léxico embutido; importe um léxico em português em Configurações › Traduções para ver aqui.`,
      });
    }
  }
  if (lexicon.length) sources.add(`léxico (${lexicon.map((l) => l.code).join(', ')})`);

  /* família de palavras e concordância no original */
  const families: SemanticGroup[] = [];
  for (const code of codes.slice(0, 4)) {
    const f = await findGroupForStrong(code).catch(() => null);
    if (f && !families.some((x) => x.id === f.id)) families.push(f);
  }
  const concord: Gathered['concord'] = [];
  const strongBible = await (async () => {
    const list = await loadAvailableTranslations().catch(() => []);
    return list.find((x) => x.id === input.translation && x.hasStrong) ?? list.find((x) => x.hasStrong) ?? null;
  })();
  if (strongBible) {
    // uma palavra do hebraico e uma do grego: as dos verbetes escolhidos
    const pick = [codes.find((c) => c.startsWith('H')), codes.find((c) => c.startsWith('G'))].filter(Boolean) as string[];
    for (const code of pick) {
      const hits = await findVersesWithStrong(strongBible.id, code, 300).catch(() => []);
      if (!hits.length) continue;
      const refsOf = hits.map((h) => ({ book: h.book, chapter: h.chapter, verse: h.verse }));
      const entry = chosen.find((e) => [e.hebraico?.strong, e.grego?.strong].some((x) => x?.split('+').includes(code)));
      const o = code.startsWith('H') ? entry?.hebraico : entry?.grego;
      concord.push({ translit: o?.translit ?? code, code, total: hits.length, refs: balance(refsOf, lim.cross + 3) });
    }
    if (concord.length) sources.add(`concordância no original (${strongBible.shortName ?? strongBible.id})`);
  }
  if (families.length) sources.add('famílias de palavras');

  /* o dicionário bíblico do pregador (importado) */
  const topics: Gathered['topics'] = [];
  const topicWords = [...new Set([...chosen.map((e) => plain(e.termo).split(' ')[0]), ...words.slice(0, 2).map((w) => w.toLowerCase())])];
  for (const w of topicWords) {
    if (topics.length >= 2) break;
    const defs = await lookupTopic(w).catch(() => []);
    for (const d of defs) {
      if (topics.length >= 2 || d.dictionary === 'Léxico Strong (embutido)' || /^[HG]\d+$/i.test(d.topic)) continue;
      if (topics.some((x) => x.dictionary === d.dictionary && x.topic === d.topic)) continue;
      topics.push({ dictionary: d.dictionary, topic: d.topic, text: stripTags(d.definition).slice(0, 900) });
    }
  }
  if (topics.length) sources.add('seu dicionário bíblico');

  /* comentários importados, no versículo principal */
  const comments: Gathered['comments'] = [];
  const commentRef = anchor ?? keyTexts.find((r) => r.verse) ?? null;
  const bookNumber = commentRef ? OSIS_TO_MYBIBLE_NUMBER.get(commentRef.book) : undefined;
  if (commentRef?.verse && bookNumber) {
    for (const c of (await lookupCommentary(bookNumber, commentRef.chapter, commentRef.verse).catch(() => [])).slice(0, 2)) {
      const text = stripTags(c.text);
      if (text) comments.push({ name: c.commentaryName, ref: commentRef, text: text.length > 700 ? `${text.slice(0, 697)}…` : text });
    }
    if (comments.length) sources.add('seus comentários');
  }

  /* contexto canônico: referências cruzadas e tipologia */
  const cross: ParsedReference[] = [];
  if (anchor?.verse) {
    for (const k of (await getCrossReferences(anchor.book, anchor.chapter, anchor.verse)).slice(0, lim.cross)) {
      const r = osisToRef(k);
      if (r) cross.push(r);
    }
    if (cross.length) sources.add('referências cruzadas');
  }
  const typeSet = new Map<string, TypologyPair>();
  for (const r of texts.filter((t) => t.verse)) {
    for (const t of await findTypologyForVerse(r.book, r.chapter, r.verse!)) typeSet.set(t.id, t);
  }
  if (!typeSet.size && chosen.length) {
    const terms = chosen.map((e) => plain(e.termo));
    for (const t of await getTypology()) {
      const hay = plain(`${t.titulo} ${t.explicacao}`);
      if (terms.some((term) => term.length > 3 && hay.includes(term))) typeSet.set(t.id, t);
    }
  }
  const types = [...typeSet.values()].slice(0, 2);
  if (types.length) sources.add('tipologia');

  /* guias: os do aplicativo e a base do pregador */
  const guides: Gathered['guides'] = [];
  const verseKeys = new Set(texts.filter((t) => t.verse).map((t) => `${t.book}.${t.chapter}.${t.verse}`));
  const entryIds = new Set(chosen.map((e) => e.id));
  for (const g of await getDoctrinalGuides()) {
    const steps = g.passos.filter((s) => entryIds.has(s.verbete) || s.textos.some((k) => verseKeys.has(k)));
    if (steps.length) guides.push({ guide: g, steps });
  }
  if (guides.length) sources.add('guias doutrinários');

  const pack: Gathered['pack'] = [];
  const packAnchor = anchor ?? texts[0];
  if (packAnchor) {
    const p = await getDoctrinalPack().catch(() => null);
    if (p) {
      for (const m of findGuidesForPassage(p, packAnchor, !packAnchor.verse, 2)) {
        for (const s of m.steps.slice(0, 2)) {
          pack.push({ titulo: m.guide.titulo, conceito: s.conceito, resumo: s.resumo, explicacao: s.explicacao, aplicacao: s.aplicacao, textos: s.textos });
        }
      }
      if (pack.length) sources.add('sua base doutrinária');
    }
  }

  const cited = findRequestReferences(input.text)[0] ?? null;
  const title = main ? formatReference(main)
    : chosen[0] ? chosen[0].termo
      : cited ? formatReference(cited)
        : searchTerm ? searchTerm[0].toUpperCase() + searchTerm.slice(1)
          : input.text.trim().slice(0, 60);
  return {
    title,
    main: main ?? cited,
    keyTexts: texts,
    entries: chosen,
    lexicon,
    cross,
    types,
    guides,
    pack,
    searchTerm,
    families,
    concord,
    topics,
    comments,
    sources: [...sources],
  };
}

/* ───────────────────────────── as seções ───────────────────────────── */

async function quotes(translation: string, refs: ParsedReference[]): Promise<string> {
  return (await Promise.all(refs.map((r) => quote(translation, r)))).filter(Boolean).join('\n\n');
}

async function immediateContext(translation: string, ref: ParsedReference): Promise<string> {
  if (!ref.verse) return '';
  const verses = await getChapter(translation, ref.book, ref.chapter).catch(() => [] as string[]);
  if (!verses.length) return '';
  const from = Math.max(1, ref.verse - 2);
  const to = Math.min(verses.length, (ref.verseEnd ?? ref.verse) + 2);
  const lines: string[] = [];
  for (let v = from; v <= to; v++) {
    const inside = v >= ref.verse && v <= (ref.verseEnd ?? ref.verse);
    lines.push(`- ${inside ? '**' : ''}${v}${inside ? '**' : ''} ${verses[v - 1]}`);
  }
  return `${bookName(ref.book)} ${ref.chapter}:${from}-${to}:\n${lines.join('\n')}`;
}

/** Os textos separados por Testamento, quando há dos dois. */
async function quotesByTestament(translation: string, refs: ParsedReference[]): Promise<string> {
  const at = refs.filter((r) => testament(r) === 'AT');
  const nt = refs.filter((r) => testament(r) === 'NT');
  if (!at.length || !nt.length) return quotes(translation, refs);
  return `### No Antigo Testamento\n${await quotes(translation, at)}\n\n### No Novo Testamento\n${await quotes(translation, nt)}`;
}

function familySection(g: Gathered): string {
  const out: string[] = [];
  for (const f of g.families.slice(0, 2)) {
    out.push(`**${f.nome}** — ${f.descricao}`);
    for (const t of f.termos.slice(0, 6)) out.push(`- **${t.translit}** ${t.lemma} (${t.strong}): ${t.sentido}`);
  }
  for (const c of g.concord) {
    out.push(`**Onde a Bíblia usa ${c.translit} (${c.code})** — ${c.total} ${c.total === 1 ? 'versículo' : 'versículos'}; alguns: ${c.refs.map((r) => `[${formatReference(r)}]`).join(', ')}.`);
  }
  return out.join('\n');
}

function originalSection(g: Gathered): string {
  const lines: string[] = [];
  for (const e of g.entries) {
    if (e.hebraico) lines.push(`- **${e.hebraico.translit}** ${e.hebraico.palavra}${e.hebraico.strong ? ` (${e.hebraico.strong})` : ''} — hebraico de "${e.termo}"`);
    if (e.grego) lines.push(`- **${e.grego.translit}** ${e.grego.palavra}${e.grego.strong ? ` (${e.grego.strong})` : ''} — grego de "${e.termo}"`);
  }
  for (const l of g.lexicon) lines.push(`- **${l.code}** (${l.source}): ${l.text}`);
  return lines.join('\n');
}

function dictionarySection(g: Gathered): string {
  const own = g.entries.map((e) => [
    `**${e.termo}.** ${e.definicao}`,
    e.distincao ? `\n**Distinção:** ${e.distincao}` : '',
    e.relacionados.length ? `\nVerbetes relacionados: ${e.relacionados.join(', ')}.` : '',
  ].join(''));
  const imported = (g.topics ?? []).map((t) => `**${t.topic}** (${t.dictionary}): ${t.text}`);
  return [...own, ...imported].join('\n\n');
}

function commentsSection(g: Gathered): string {
  return (g.comments ?? []).map((c) => `**${c.name}**, sobre [${formatReference(c.ref)}]: ${c.text}`).join('\n\n');
}

function typologySection(g: Gathered): string {
  return g.types.map((t) => {
    const at = t.at.textos.slice(0, 2).map((k) => osisToRef(k)).filter(Boolean).map((r) => `[${formatReference(r!)}]`).join(', ');
    const nt = t.nt.textos.slice(0, 2).map((k) => osisToRef(k)).filter(Boolean).map((r) => `[${formatReference(r!)}]`).join(', ');
    return `**${t.titulo}.** ${t.at.nome} (${at}) → ${t.nt.nome} (${nt}). ${t.explicacao}`;
  }).join('\n\n');
}

function guidesSection(g: Gathered): string {
  const lines: string[] = [];
  for (const { guide, steps } of g.guides.slice(0, 2)) {
    lines.push(`**${guide.titulo}** — ${guide.descricao}`);
    for (const s of steps.slice(0, 3)) {
      const refs = s.textos.slice(0, 3).map(osisToRef).filter(Boolean).map((r) => `[${formatReference(r!)}]`).join(', ');
      lines.push(`- **${s.conceito}:** ${s.resumo}${refs ? ` (${refs})` : ''}`);
    }
  }
  for (const p of g.pack) {
    lines.push(`- **${p.conceito}** (da sua base doutrinária): ${p.resumo} ${p.explicacao}${p.aplicacao ? ` Aplicação: ${p.aplicacao}` : ''}`);
  }
  return lines.join('\n');
}

const section = (title: string, body: string) => (body.trim() ? `## ${title}\n${body.trim()}` : '');

/* ───────────────────────────── os formatos ───────────────────────────── */

async function studyText(g: Gathered, input: EngineInput): Promise<string> {
  const t = input.translation;
  const anchor = g.main?.verse ? g.main : g.keyTexts.find((r) => r.verse);
  const blocks: Array<[string, string]> = [
    ['O texto', await quotesByTestament(t, g.keyTexts)],
    ['Contexto', [
      anchor ? await immediateContext(t, anchor) : '',
      g.cross.length ? `Referências cruzadas: ${g.cross.map((r) => `[${formatReference(r)}]`).join(', ')}.` : '',
    ].filter(Boolean).join('\n\n')],
    ['Língua original', [originalSection(g), familySection(g)].filter(Boolean).join('\n\n')],
    ['O que o dicionário diz', dictionarySection(g)],
    ['Comentários', commentsSection(g)],
    ['Cristo e a Nova Aliança', typologySection(g)],
    ['Doutrina — guias', guidesSection(g)],
  ];
  // numeradas só as que existem: sem comentários importados, não fica um buraco
  return blocks.filter(([, body]) => body.trim()).map(([title, body], i) => section(`${i + 1}. ${title}`, body)).join('\n\n');
}

async function messageText(g: Gathered, input: EngineInput): Promise<string> {
  const t = input.translation;
  const main = g.main ?? g.keyTexts[0];
  const points: string[] = [];
  const steps = g.guides.flatMap((x) => x.steps).slice(0, 3);
  if (steps.length) {
    for (const [i, s] of steps.entries()) {
      const refs = s.textos.slice(0, 2).map(osisToRef).filter(Boolean) as ParsedReference[];
      points.push(`### Ponto ${i + 1} — ${s.conceito}\n${s.resumo}\n\n${await quotes(t, refs)}\n\n**Explicação e aplicação:** ${WRITE}`);
    }
  } else {
    const rest = balance(g.keyTexts.filter((r) => !main || refKey(r) !== refKey(main)), 3);
    for (const [i, r] of rest.entries()) {
      points.push(`### Ponto ${i + 1} — ${formatReference(r)}\n${await quote(t, r)}\n\n**Explicação e aplicação:** ${WRITE}`);
    }
  }
  const parts = [
    section('Texto principal', main ? await quote(t, main) : ''),
    section('Introdução', [
      g.entries[0] ? `Ponto de partida (dicionário): ${g.entries[0].definicao}` : '',
      WRITE,
    ].filter(Boolean).join('\n\n')),
    section('Desenvolvimento', points.join('\n\n')),
    section('Cristo e a Nova Aliança', typologySection(g)),
    section('Aplicação', WRITE),
    section('Conclusão e apelo', WRITE),
    section('Material de apoio', [originalSection(g), g.entries.map((e) => e.distincao ? `**${e.termo} — distinção:** ${e.distincao}` : '').filter(Boolean).join('\n\n')].filter(Boolean).join('\n\n')),
  ];
  return parts.filter(Boolean).join('\n\n');
}

async function summaryText(g: Gathered, input: EngineInput): Promise<string> {
  const t = input.translation;
  const first = g.entries[0];
  const parts = [
    section('Em poucas palavras', first ? first.definicao : ''),
    section('Textos-chave', await quotes(t, balance(g.keyTexts, 4))),
    section('No original', originalSection({ ...g, lexicon: g.lexicon.slice(0, 2) })),
    section('Distinção', first?.distincao ?? ''),
  ];
  return parts.filter(Boolean).join('\n\n');
}

const AUDIT_CHECKS = [
  'Alguma palavra foi tirada do contexto?',
  'A tradução usada sustenta a afirmação? Compare com outras traduções.',
  'O sentido dado à palavra hebraica ou grega está no léxico — e neste contexto?',
  'O número de Strong foi usado como prova, no lugar da exegese?',
  'A conclusão depende só da etimologia da palavra?',
  'Há erro de gramática (tempo, voz, modo) na leitura?',
  'Há anacronismo — ideia de hoje lida no texto antigo?',
  'É prova de texto: versículo isolado para sustentar uma ideia pronta?',
  'O contexto imediato e o do livro foram considerados?',
  'Significado e aplicação foram confundidos?',
  'Antigo e Novo Testamento foram confundidos (lei e graça, antiga e Nova Aliança)?',
  'Uma aplicação está sendo apresentada como interpretação?',
  'A doutrina afirmada é sustentada pelo texto?',
];

async function auditText(g: Gathered, input: EngineInput): Promise<string> {
  const t = input.translation;
  const excerpt = input.text.trim().replace(/\s+/g, ' ');
  const parts = [
    section('O que você escreveu', `> ${excerpt.length > 600 ? `${excerpt.slice(0, 597)}…` : excerpt}`),
    section('Os textos, na sua Bíblia', await quotes(t, g.keyTexts)),
    section('Contexto imediato', g.keyTexts.find((r) => r.verse) ? await immediateContext(t, g.keyTexts.find((r) => r.verse)!) : ''),
    section('Palavras no original', originalSection(g)),
    section('O que o dicionário diz', dictionarySection(g)),
    section('Roteiro de conferência', AUDIT_CHECKS.map((c) => `- ${c}`).join('\n')),
    section('Sua conclusão', [
      '**O que está correto:** ' + WRITE,
      '**O que precisa ser ajustado:** ' + WRITE,
      '**Por quê:** ' + WRITE,
      '**A leitura mais bem sustentada pelo texto:** ' + WRITE,
    ].join('\n\n')),
  ];
  return parts.filter(Boolean).join('\n\n');
}

/* ───────────────────────────── a entrada ───────────────────────────── */

const NOTHING =
  'Não encontrei no aparelho material sobre isso. Cite uma passagem (ex.: Romanos 5:1), uma palavra do original ' +
  '(ex.: pistis, emunah) ou um tema do dicionário (ex.: justificação, graça, cura) e eu monto de novo.';

export async function buildStudyWithoutAi(input: EngineInput): Promise<EngineOutput> {
  if (input.material && input.material2) return buildFromTwoMaterials(input, input.material, input.material2);
  if (input.material) return buildFromMaterial(input, input.material);
  const g = await gather(input);
  const empty = !g.keyTexts.length && !g.entries.length && !g.lexicon.length;
  if (empty) return { content: NOTHING, validRefs: [], sources: [] };

  const body = input.mode === 'auditoria'
    ? await auditText(g, input)
    : input.goal === 'mensagem'
      ? await messageText(g, input)
      : input.goal === 'resumo'
        ? await summaryText(g, input)
        : await studyText(g, input);

  const note = '*Montado com os dados do seu aparelho, sem IA: os textos, o léxico e o dicionário como estão nas fontes. A interpretação e a aplicação são suas.*';
  const title = input.mode === 'auditoria' ? 'Material para conferir' : g.title;
  const content = `# ${title}\n\n${note}\n\n${body}`;
  const cited = [...content.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const validRefs = await validateReferences(input.translation, [...new Set(cited)]).catch(() => []);
  return { content, validRefs, sources: g.sources };
}

/* ─────────────────────── estudo a partir de um material ─────────────────────── */

const PARTS_LIMIT: Record<AssistantDepth, number> = { objetivo: 4, auto: 8, profundo: 20 };

/** "parte 3", "capítulo 2", "lição 4" — ou as palavras do título de uma parte. */
function focusPart(text: string, reading: MaterialReading): number | null {
  const n = /\b(?:parte|cap[ií]tulo|li[cç][aã]o|m[oó]dulo|aula|se[cç][aã]o)\s+(\d{1,3})\b/i.exec(text);
  if (n) {
    const i = Number(n[1]) - 1;
    if (i >= 0 && i < reading.parts.length) return i;
  }
  const words = plain(text).split(' ').filter((w) => w.length >= 4 && !STOP.has(w));
  let best: { i: number; hits: number } | null = null;
  reading.parts.forEach((p, i) => {
    const title = ` ${plain(p.title)} `;
    const hits = words.filter((w) => title.includes(` ${w} `)).length;
    if (hits >= 2 && (!best || hits > best.hits)) best = { i, hits };
  });
  return (best as { i: number } | null)?.i ?? null;
}

const authorQuote = (s: string) => `- “${s.replace(/\[|\]/g, '')}”`;

function partBlock(p: PartReading, n: number): string {
  const lines = [`### ${n}. ${p.title}`];
  lines.push(...p.central.map(authorQuote));
  if (p.refs.length) lines.push(`Versículos citados: ${p.refs.slice(0, 6).map((r) => `[${r.label}]`).join(', ')}.`);
  if (p.terms.length) lines.push(`Doutrinas: ${p.terms.slice(0, 4).map((t) => t.entry.termo).join(', ')}.`);
  return lines.length > 1 ? lines.join('\n') : '';
}

async function topQuotes(translation: string, refs: MaterialReading['refs'], limit: number): Promise<string> {
  const out: string[] = [];
  for (const r of refs.slice(0, limit)) {
    const q = await quote(translation, r.ref);
    if (q) out.push(r.count > 1 ? `${q} (citado ${r.count} vezes)` : q);
  }
  return out.join('\n\n');
}

function doctrineBlock(terms: MaterialReading['terms'], limit: number): string {
  return terms.slice(0, limit).map(({ entry: e, count }) => [
    `**${e.termo}** (aparece ${count} ${count === 1 ? 'vez' : 'vezes'}). ${e.definicao}`,
    e.distincao ? `\n**Distinção:** ${e.distincao}` : '',
  ].join('')).join('\n\n');
}

function originalsBlock(r: MaterialReading): string {
  const lines = r.originals.map((o) => `- **${o.translit}** ${o.word}${o.strong ? ` (${o.strong})` : ''} — "${o.term}"`);
  if (r.strongCodes.length) lines.push(`- Números de Strong citados: ${r.strongCodes.join(', ')}.`);
  return lines.join('\n');
}

async function typologyFor(refs: MaterialReading['refs']): Promise<string> {
  const found = new Map<string, TypologyPair>();
  for (const r of refs.slice(0, 12)) {
    if (!r.ref.verse) continue;
    for (const t of await findTypologyForVerse(r.ref.book, r.ref.chapter, r.ref.verse)) found.set(t.id, t);
    if (found.size >= 2) break;
  }
  return typologySection({ types: [...found.values()] } as Gathered);
}

async function buildFromMaterial(input: EngineInput, material: AssistantMaterial): Promise<EngineOutput> {
  const t = input.translation;
  const lim = LIMITS[input.depth];
  const full = await readMaterialTheology(material, input.depth === 'objetivo' ? 1 : input.depth === 'profundo' ? 4 : 2);
  const focus = focusPart(input.text, full);
  // foco numa parte: a leitura inteira passa a ser só dela
  const reading: MaterialReading = focus === null ? full : (() => {
    const p = full.parts[focus];
    return { ...full, parts: [p], refs: p.refs, terms: p.terms };
  })();
  const parts = reading.parts.slice(0, PARTS_LIMIT[input.depth]);
  const firstNumber = focus === null ? 1 : focus + 1;
  const partBlocks = parts.map((p, i) => partBlock(p, firstNumber + i)).filter(Boolean).join('\n\n');

  if (!reading.refs.length && !reading.terms.length && !partBlocks) {
    return {
      content: 'Li o material, mas não encontrei versículos citados, doutrinas do dicionário nem frases centrais para montar o estudo. Confira se o arquivo tem texto (PDF escaneado como imagem não tem).',
      validRefs: [], sources: [],
    };
  }

  const theme = reading.terms[0]?.entry.termo ?? (reading.refs[0] ? reading.refs[0].label : '');
  const label = focus === null ? 'estudo do material' : `parte ${focus + 1} do material`;
  let title = theme ? `${theme} — ${label}` : label[0].toUpperCase() + label.slice(1);
  const outline = focus === null && reading.parts.length > 1
    ? reading.parts.slice(0, 30).map((p, i) => `${i + 1}. ${p.title}`).join('\n')
    : '';

  let body: string;
  if (input.mode === 'auditoria') {
    title = focus === null ? 'Material para conferir' : `Material para conferir — parte ${focus + 1}`;
    const claims: string[] = [];
    for (const [i, p] of parts.entries()) {
      if (!p.central.length && !p.refs.length) continue;
      const qs = await quotes(t, p.refs.slice(0, 2).map((r) => r.ref));
      claims.push([`### ${firstNumber + i}. ${p.title}`, ...p.central.map(authorQuote), qs ? `Os textos que o autor usa, na sua Bíblia:\n\n${qs}` : ''].filter(Boolean).join('\n'));
    }
    body = [
      section('O que o autor afirma, e os textos que usa', claims.join('\n\n')),
      section('Doutrinas em jogo', doctrineBlock(reading.terms, lim.entries)),
      section('Roteiro de conferência', AUDIT_CHECKS.map((c) => `- ${c}`).join('\n')),
      section('Sua conclusão', [
        '**O que está correto:** ' + WRITE,
        '**O que precisa ser ajustado:** ' + WRITE,
        '**Por quê:** ' + WRITE,
        '**A leitura mais bem sustentada pelo texto:** ' + WRITE,
      ].join('\n\n')),
    ].filter(Boolean).join('\n\n');
  } else if (input.goal === 'mensagem') {
    const ranked = [...parts].map((p, i) => ({ p, i })).sort((a, b) => (b.p.refs.length + b.p.terms.length) - (a.p.refs.length + a.p.terms.length)).slice(0, 4).sort((a, b) => a.i - b.i);
    const points: string[] = [];
    for (const [n, { p }] of ranked.entries()) {
      points.push([
        `### Ponto ${n + 1} — ${p.title}`,
        p.central[0] ? authorQuote(p.central[0]) : '',
        await quotes(t, p.refs.slice(0, 2).map((r) => r.ref)),
        `**Explicação e aplicação:** ${WRITE}`,
      ].filter(Boolean).join('\n\n'));
    }
    const first = parts.find((p) => p.central.length)?.central[0];
    body = [
      section('Texto principal', reading.refs[0] ? await quote(t, reading.refs[0].ref) : ''),
      section('Introdução', [first ? `O material parte daqui:\n${authorQuote(first)}` : '', WRITE].filter(Boolean).join('\n\n')),
      section('Desenvolvimento', points.join('\n\n')),
      section('Aplicação', WRITE),
      section('Conclusão e apelo', WRITE),
      section('Material de apoio', [doctrineBlock(reading.terms, lim.entries), originalsBlock(reading)].filter(Boolean).join('\n\n')),
    ].filter(Boolean).join('\n\n');
  } else if (input.goal === 'resumo') {
    const essentials = parts.filter((p) => p.central.length).map((p) => `- **${firstNumber + reading.parts.indexOf(p)}. ${p.title}:** “${p.central[0].replace(/\[|\]/g, '')}”`);
    body = [
      section('O essencial, nas palavras do autor', essentials.join('\n')),
      section('Textos-chave', await topQuotes(t, reading.refs, Math.min(4, lim.texts))),
      section('Doutrinas', reading.terms.slice(0, 5).map((x) => x.entry.termo).join(', ')),
    ].filter(Boolean).join('\n\n');
  } else {
    body = [
      section('O caminho do material', outline),
      section('Parte a parte', partBlocks),
      section('Os versículos mais citados', await topQuotes(t, reading.refs, lim.texts)),
      section('As doutrinas do material', doctrineBlock(reading.terms, lim.entries)),
      section('No original', originalsBlock(reading)),
      section('Cristo e a Nova Aliança', await typologyFor(reading.refs)),
    ].filter(Boolean).join('\n\n');
  }

  const note = '*Montado com o material que você importou e os dados do aparelho, sem IA: as frases entre aspas são do autor, os versículos são da sua Bíblia. A interpretação e a aplicação são suas.*';
  const content = `# ${title}\n\n${note}\n\n${body}`;
  const cited = [...content.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const validRefs = await validateReferences(t, [...new Set(cited)]).catch(() => []);
  const sources = ['material importado', 'texto da Bíblia em uso'];
  if (reading.terms.length) sources.push('dicionário teológico');
  if (reading.originals.length) sources.push('termos do original');
  return { content, validRefs, sources };
}

/* ─────────────────────── dois materiais, um estudo ─────────────────────── */

const M1 = 'Material 1';
const M2 = 'Material 2';
const keyOf = (r: ParsedReference) => `${r.book}.${r.chapter}.${r.verse ?? ''}`;
const quoteFrom = (label: string, s: string) => `- **${label}:** “${s.replace(/\[|\]/g, '')}”`;

/**
 * Lê os dois materiais juntos, sem IA: o que os dois citam (a base mais
 * firme), o mesmo texto lido por cada um, e o que só um traz. Os nomes dos
 * arquivos não aparecem — "Material 1" e "Material 2".
 */
async function buildFromTwoMaterials(input: EngineInput, a: AssistantMaterial, b: AssistantMaterial): Promise<EngineOutput> {
  const t = input.translation;
  const lim = LIMITS[input.depth];
  const per = input.depth === 'objetivo' ? 1 : input.depth === 'profundo' ? 3 : 2;
  const [ra, rb] = await Promise.all([readMaterialTheology(a, per), readMaterialTheology(b, per)]);
  // cada frase do autor aparece uma vez só no estudo inteiro
  const used = new Set<string>();

  // "o mesmo texto": quem cita Sl 23:1-4 e quem cita Sl 23:3 falam do mesmo trecho
  const span = (r: ParsedReference) => [r.verse ?? 1, r.verse ? (r.verseEnd ?? r.verse) : 999] as const;
  const overlaps = (x: ParsedReference, y: ParsedReference) => {
    if (x.book !== y.book || x.chapter !== y.chapter) return false;
    const [x1, x2] = span(x); const [y1, y2] = span(y);
    return x1 <= y2 && y1 <= x2;
  };
  const commonA = ra.refs.filter((r) => rb.refs.some((o) => overlaps(r.ref, o.ref)));
  const commonB = rb.refs.filter((r) => ra.refs.some((o) => overlaps(r.ref, o.ref)));
  const onlyA = ra.refs.filter((r) => !commonA.includes(r));
  const onlyB = rb.refs.filter((r) => !commonB.includes(r));

  // as passagens em comum, por capítulo, com o peso das citações dos dois
  const passages = new Map<string, { book: string; chapter: number; from: number; to: number; weight: number; refs: CitedRef[] }>();
  for (const r of [...commonA, ...commonB]) {
    const k = `${r.ref.book}.${r.ref.chapter}`;
    const [v1, v2] = span(r.ref);
    const p = passages.get(k) ?? { book: r.ref.book, chapter: r.ref.chapter, from: v1, to: v2, weight: 0, refs: [] };
    p.from = Math.min(p.from, v1); p.to = Math.max(p.to, v2); p.weight += r.count; p.refs.push(r);
    passages.set(k, p);
  }
  const passageList = [...passages.values()].sort((x, y) => y.weight - x.weight);
  const totalWeight = passageList.reduce((n, p) => n + p.weight, 0);

  // os versículos em comum, um por vez, sem repetir (Sl 23:1 citado pelos dois conta uma vez)
  const commonRefs: CitedRef[] = [];
  for (const r of [...commonA, ...commonB].sort((x, y) => y.count - x.count)) {
    if (!commonRefs.some((c) => keyOf(c.ref) === keyOf(r.ref) && c.ref.verseEnd === r.ref.verseEnd)) commonRefs.push(r);
  }

  const bTerms = new Map(rb.terms.map((x) => [x.entry.id, x.count]));
  const commonTerms = ra.terms.filter((x) => bTerms.has(x.entry.id))
    .map((x) => ({ entry: x.entry, count: x.count + (bTerms.get(x.entry.id) ?? 0) }))
    .sort((x, y) => y.count - x.count);
  const commonTermIds = new Set(commonTerms.map((x) => x.entry.id));
  const onlyTermsA = ra.terms.filter((x) => !commonTermIds.has(x.entry.id));
  const onlyTermsB = rb.terms.filter((x) => !commonTermIds.has(x.entry.id));

  if (!commonRefs.length && !commonTerms.length && !ra.refs.length && !rb.refs.length) {
    return {
      content: 'Li os dois materiais, mas não encontrei versículos citados nem doutrinas do dicionário para cruzar. Confira se os arquivos têm texto (PDF escaneado como imagem não tem).',
      validRefs: [], sources: [],
    };
  }

  /** O texto em comum, citado uma vez: a passagem inteira se for curta; senão, os versículos mais citados. */
  const passageRefs = (p: (typeof passageList)[number]): ParsedReference[] => {
    if (p.to !== 999 && p.to - p.from <= 5) return [{ book: p.book, chapter: p.chapter, verse: p.from, verseEnd: p.to > p.from ? p.to : undefined }];
    return [...p.refs].sort((x, y) => y.count - x.count)
      .filter((r, i, all) => all.findIndex((o) => keyOf(o.ref) === keyOf(r.ref)) === i)
      .slice(0, 2).map((r) => r.ref);
  };
  const commonQuotes = async (n: number) => {
    const out: string[] = [];
    for (const p of passageList) {
      for (const ref of passageRefs(p)) {
        if (out.length >= n) break;
        const q = await quote(t, ref);
        if (q) out.push(`${q} (citado nos dois materiais)`);
      }
    }
    return out.join('\n\n');
  };

  /* o mesmo texto, lido por cada um: só entra quando os dois dizem algo sobre ele */
  const pairs: string[] = [];
  const pairLimit = input.depth === 'objetivo' ? 2 : 4;
  for (const r of commonRefs) {
    if (pairs.length >= pairLimit) break;
    const sa = sentencesCiting(a, r.ref, 1, new Set(used))[0];
    const sb = sentencesCiting(b, r.ref, 1, new Set(used))[0];
    if (!sa || !sb) continue;
    used.add(sa); used.add(sb);
    pairs.push([`### [${r.label}]`, await quote(t, r.ref), quoteFrom(M1, sa), quoteFrom(M2, sb)].filter(Boolean).join('\n\n'));
  }

  /* cada doutrina em comum, com uma frase de cada material */
  const doctrinePairs = commonTerms.slice(0, lim.entries + 1).map(({ entry }) => {
    const sa = sentencesAbout(a, entry, 1, used)[0];
    const sb = sentencesAbout(b, entry, 1, used)[0];
    return [`**${entry.termo}.** ${entry.definicao}`, sa ? quoteFrom(M1, sa) : '', sb ? quoteFrom(M2, sb) : ''].filter(Boolean).join('\n');
  });

  const adds = (label: string, m: AssistantMaterial, only: CitedRef[], terms: MaterialReading['terms']) => {
    const lines: string[] = [];
    lines.push(...keySentences(m, input.depth === 'profundo' ? 4 : 2, used).map((s) => quoteFrom(label, s)));
    if (only.length) lines.push(`Textos que só o ${label} usa: ${only.slice(0, lim.cross).map((x) => `[${x.label}]`).join(', ')}.`);
    if (terms.length) lines.push(`Doutrinas que só o ${label} trata: ${terms.slice(0, 4).map((x) => x.entry.termo).join(', ')}.`);
    return lines.join('\n');
  };

  const originals = [...new Map([...ra.originals, ...rb.originals].map((o) => [o.translit, o])).values()];
  const originalLines = originals.map((o) => `- **${o.translit}** ${o.word}${o.strong ? ` (${o.strong})` : ''} — "${o.term}"`).join('\n');

  // quando os dois giram em torno do mesmo texto, ele dá o nome ao estudo
  const top = passageList[0];
  const theme = top && top.weight * 2 >= totalWeight && top.weight >= 3
    ? formatReference({ book: top.book, chapter: top.chapter })
    : commonTerms[0]?.entry.termo ?? commonRefs[0]?.label ?? ra.terms[0]?.entry.termo ?? '';
  let title = theme ? `${theme} — dois materiais` : 'Dois materiais';
  let body: string;

  if (input.mode === 'auditoria') {
    title = 'Material para conferir — dois materiais';
    body = [
      section('O mesmo texto, duas leituras', pairs.join('\n\n')),
      section('As doutrinas em comum', doctrinePairs.join('\n\n')),
      section('Roteiro de conferência', AUDIT_CHECKS.map((c) => `- ${c}`).join('\n')),
      section('Sua conclusão', [
        '**Onde os dois concordam com o texto:** ' + WRITE,
        '**Onde um deles vai além do texto:** ' + WRITE,
        '**Por quê:** ' + WRITE,
        '**A leitura mais bem sustentada pelo texto:** ' + WRITE,
      ].join('\n\n')),
    ].filter(Boolean).join('\n\n');
  } else if (input.goal === 'mensagem') {
    const main = top ? passageRefs(top)[0] : ra.refs[0]?.ref ?? rb.refs[0]?.ref;
    const points: string[] = [];
    for (const [i, { entry }] of commonTerms.slice(0, 3).entries()) {
      const sa = sentencesAbout(a, entry, 1, used)[0];
      const sb = sentencesAbout(b, entry, 1, used)[0];
      const refs = commonRefs.filter((r) => entry.textos.includes(keyOf(r.ref).replace(/\.$/, ''))).slice(0, 2).map((r) => r.ref);
      points.push([
        `### Ponto ${i + 1} — ${entry.termo}`,
        sa ? quoteFrom(M1, sa) : '', sb ? quoteFrom(M2, sb) : '',
        refs.length ? await quotes(t, refs) : '',
        `**Explicação e aplicação:** ${WRITE}`,
      ].filter(Boolean).join('\n\n'));
    }
    if (!points.length) {
      for (const [i, r] of commonRefs.slice(0, 3).entries()) {
        points.push([`### Ponto ${i + 1} — ${r.label}`, await quote(t, r.ref), `**Explicação e aplicação:** ${WRITE}`].join('\n\n'));
      }
    }
    body = [
      section('Texto principal', main ? await quote(t, main) : ''),
      section('Introdução', WRITE),
      section('Desenvolvimento', points.join('\n\n')),
      section('Aplicação', WRITE),
      section('Conclusão e apelo', WRITE),
      section('Material de apoio', originalLines),
    ].filter(Boolean).join('\n\n');
  } else if (input.goal === 'resumo') {
    const one = (m: AssistantMaterial) => keySentences(m, 1, used)[0];
    const oneA = one(a);
    const oneB = one(b);
    body = [
      section('Em comum', [
        commonTerms.length ? `Doutrinas: ${commonTerms.slice(0, 5).map((x) => x.entry.termo).join(', ')}.` : '',
        passageList.length ? `Textos: ${passageList.slice(0, 4).flatMap(passageRefs).map((r) => `[${formatReference(r)}]`).join(', ')}.` : '',
      ].filter(Boolean).join('\n\n')),
      section(`${M1}, em uma frase`, oneA ? `“${oneA.replace(/\[|\]/g, '')}”` : ''),
      section(`${M2}, em uma frase`, oneB ? `“${oneB.replace(/\[|\]/g, '')}”` : ''),
      section('Textos-chave', await commonQuotes(Math.min(4, lim.texts))),
    ].filter(Boolean).join('\n\n');
  } else {
    body = [
      section('O que os dois têm em comum', [await commonQuotes(lim.texts), doctrinePairs.join('\n\n')].filter(Boolean).join('\n\n')),
      section('O mesmo texto, duas leituras', pairs.join('\n\n')),
      section(`O que o ${M1} acrescenta`, adds(M1, a, onlyA, onlyTermsA)),
      section(`O que o ${M2} acrescenta`, adds(M2, b, onlyB, onlyTermsB)),
      section('No original', originalLines),
      section('Cristo e a Nova Aliança', await typologyFor(commonRefs.length ? commonRefs : ra.refs)),
    ].filter(Boolean).join('\n\n');
  }

  const note = '*Montado com os dois materiais que você escolheu e os dados do aparelho, sem IA: as frases entre aspas são dos autores (Material 1 e Material 2), os versículos são da sua Bíblia. Os textos citados pelos dois vêm primeiro.*';
  const content = `# ${title}\n\n${note}\n\n${body}`;
  const cited = [...content.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const validRefs = await validateReferences(t, [...new Set(cited)]).catch(() => []);
  const sources = ['dois materiais importados', 'texto da Bíblia em uso'];
  if (commonTerms.length || ra.terms.length) sources.push('dicionário teológico');
  return { content, validRefs, sources };
}
