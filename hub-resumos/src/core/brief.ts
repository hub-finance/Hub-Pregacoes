import { suggestActions } from './actions';
import { callGemini, withModel } from './ai';
import { findReferences, fold } from './bible';
import { db, now } from './db';
import { cleanTitle, readMaterial, referenceSentence, sectionSentences, STOPWORDS, sectionKeywords, sentences, type MaterialReading, type SectionReading } from './text';
import type { ActionItem, BriefCard, BriefChapterTurn, BriefInflection, BriefOrigin, Material, StudyBrief } from './types';

/**
 * A estrutura única do estudo (pedido do usuário, docs/AJUSTES-RESUMOS.md):
 * tudo o que as 4 camadas e o DNA mostram sai daqui, montado uma vez — para
 * não haver repetição nem contradição entre os quadros.
 *
 * - Com a IA: o Gemini lê o material inteiro e devolve a estrutura; cada item
 *   diz de que parte veio e se está dito no texto ou é inferência da IA.
 * - Sem a IA: as regras montam uma versão mais simples, só com trechos do texto.
 * Em ambos os casos o usuário pode editar tudo, e os versículos são conferidos
 * contra o próprio texto.
 */

/** Limites de quantidade: poucos itens, bem escolhidos (qualidade, não quantidade). */
export const BRIEF_LIMITS = { truths: 5, steps: 6, branches: 5, leaves: 4, cardsPerKind: 3, dnaRows: 5, applications: 5, questions: 5 };

export { cleanTitle } from './text';

/**
 * Rótulo curto que não parece cortado: o título inteiro quando cabe; senão as
 * palavras-chave dele (nunca "A pergunta do", sempre algo com sentido).
 */
function shortLabel(text: string, max = 4): string {
  const words = text.replace(/[“”"]/g, '').split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(' ');
  // antes de uma pausa natural (vírgula, dois-pontos) cabe inteiro?
  const clause = text.split(/[,:;—–]/)[0].trim().split(/\s+/);
  if (clause.length >= 2 && clause.length <= max) return clause.join(' ');
  const keys = sectionKeywords({ id: '', title: '', text }, Math.min(max, 3));
  const label = keys.map((k, i) => (i === 0 ? k[0].toUpperCase() + k.slice(1) : k)).join(' · ');
  if (label) return label;
  // último recurso: não termina em palavra solta como "de", "do", "que"
  const head = words.slice(0, max);
  while (head.length > 1 && /^(a|o|as|os|de|do|da|dos|das|que|e|em|no|na|um|uma|para|por|com)$/i.test(head[head.length - 1])) head.pop();
  return head.join(' ');
}

/** Limites de leitura: os textos fora dos cartões devem ser lidos de relance. */
export const BRIEF_WORDS = { synthesis: 45, sentence: 24 };

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Uma frase enxuta: a primeira frase do trecho; se for longa, a oração
 * principal (até a vírgula ou ponto e vírgula), terminada com ponto. Nunca
 * reticências — quando não há onde parar com sentido, fica a frase inteira.
 */
export function concise(text: string, max = BRIEF_WORDS.sentence): string {
  const raw = sentences(text)[0] ?? text.trim();
  // trechos sem ponto final (títulos, itens de lista) ganham o ponto, para não emendarem na frase seguinte
  const first = raw && !/[.!?:]$/.test(raw) ? `${raw.replace(/[,;—–\s]+$/, '')}.` : raw;
  if (wordCount(first) <= max) return first;
  // cada pedaço leva a sua pontuação original ("escrito:", "pecado,"): nada de ":," inventado
  const parts = first.split(/(?<=[,;:—–])\s+/);
  let out = '';
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (wordCount(next) > max) break;
    out = next;
  }
  if (wordCount(out) < 6) return first;
  return out.replace(/[,;:—–\s]+$/, '') + '.';
}

function keyOf(s: SectionReading): string {
  return concise(keyRaw(s));
}

function keyRaw(s: SectionReading): string {
  return s.highlights[0] ?? (s.definitions[0] && `${s.definitions[0].term}: ${s.definitions[0].meaning}`) ?? sentences(s.paragraphs[0] ?? '')[0] ?? s.listItems[0] ?? '';
}

/** A frase-chave da parte que não seja a própria pergunta da etapa. */
function answerOf(s: SectionReading, question: string): string {
  const q = fold(question);
  const candidates = [keyRaw(s), ...s.highlights, ...s.paragraphs.flatMap(sentences), ...s.listItems];
  return concise(candidates.find((c) => c && fold(c) !== q && !c.trim().endsWith('?')) ?? '');
}

/** A frase do texto em que a referência aparece. */
function contextOf(s: SectionReading, ref: { label: string; raw: string }): string {
  return referenceSentence(s, ref);
}

/* --------------------------- ponto de inflexão --------------------------- */

/** Palavras que costumam marcar a virada de uma mensagem. */
const TURN_MARK = /\b(mas|por[eé]m|contudo|todavia|entretanto|no entanto|at[eé] que|ent[aã]o|caindo em si|de repente|a partir da[ií]|a partir de ent[aã]o|foi quando|em vez de|ao inv[eé]s de|e sim)\b/i;
const FAITH = /\b(deus|senhor|jesus|cristo|esp[ií]rito|f[eé]|gra[cç]a|palavra|promessa|alian[cç]a)\b/i;

interface TurnCandidate {
  sentence: string;
  before: string;
  after: string;
  score: number;
}

/**
 * Sem IA: a frase mais provável de ser a virada de uma parte. Só uma
 * sugestão (marcada assim na tela), para o usuário confirmar ou trocar.
 */
function turnOf(s: SectionReading): TurnCandidate | undefined {
  const body = [...s.paragraphs, ...s.listItems].flatMap(sentences);
  // os destaques do autor também concorrem (podem estar fora dos parágrafos)
  const list = [...body, ...s.highlights.filter((h) => !body.some((x) => x.includes(h)))];
  const isHighlight = (x: string) => s.highlights.some((h) => x.includes(h) || h.includes(x));
  let best: TurnCandidate | undefined;
  list.forEach((sentence, i) => {
    const words = sentence.split(/\s+/).length;
    if (sentence.endsWith('?') || words < 6 || words > 45) return;
    const marked = TURN_MARK.test(sentence);
    const high = isHighlight(sentence);
    if (!marked && !high) return;
    const score = (marked ? 3 : 0) + (high ? 2 : 0) + (findReferences(sentence).length ? 1 : 0) + (FAITH.test(sentence) ? 0.5 : 0);
    if (!best || score > best.score) {
      const near = (j: number) => (list[j] && !list[j].endsWith('?') ? concise(list[j]) : '');
      best = { sentence, before: near(i - 1), after: near(i + 1), score };
    }
  });
  return best;
}

/** As viradas por capítulo e a virada geral, pelas regras (sugestões). */
export function findTurnsByRules(r: MaterialReading): { inflection?: BriefInflection; chapterTurns: BriefChapterTurn[] } {
  const found = r.sections
    .filter((s) => s.section.text.trim())
    .map((s) => ({ s, c: turnOf(s) }))
    .filter((x): x is { s: SectionReading; c: TurnCandidate } => !!x.c);
  const refOf = (text: string) => findReferences(text)[0]?.label;
  const chapterTurns = found.map(({ s, c }) => ({ section: s.section.title, turn: concise(c.sentence, 30), ref: refOf(c.sentence), origin: 'texto' as BriefOrigin, guess: true }));
  const top = [...found].sort((a, b) => b.c.score - a.c.score)[0];
  const inflection = top && {
    before: top.c.before,
    turn: concise(top.c.sentence, 30),
    after: top.c.after,
    ref: refOf(top.c.sentence) ?? top.s.references[0]?.label,
    section: top.s.section.title,
    origin: 'texto' as BriefOrigin,
    guess: true,
  };
  return { inflection, chapterTurns };
}

/**
 * A virada de uma parte para o Passo a passo: a da estrutura salva (IA ou
 * revisada pelo usuário) ou, sem ela, a sugestão das regras.
 */
export function turnForSection(material: Material, section: Material['sections'][number]): BriefChapterTurn | undefined {
  const saved = material.brief?.chapterTurns?.find((t) => t.section === section.title);
  if (saved || material.brief?.chapterTurns?.length) return saved;
  return findTurnsByRules(readMaterial({ ...material, sections: [section] })).chapterTurns[0];
}

/** Estrutura montada só com o texto (sem IA). */
/* ------------- seleção inteligente: o livro inteiro, não só o começo ------------- */

/** Divide em até `n` blocos seguidos e equilibrados (12 capítulos em 6 → 2 em cada). */
export function groupsOf<T>(items: T[], n: number): T[][] {
  const k = Math.min(n, items.length);
  return Array.from({ length: k }, (_, i) => items.slice(Math.floor((i * items.length) / k), Math.floor(((i + 1) * items.length) / k)));
}

/** Frases que dependem da anterior para fazer sentido ("Isso…", "Ele…") não servem sozinhas. */
const DEPENDENT = /^(isso|isto|aquilo|esse|essa|esses|essas|este|esta|estes|estas|ele|ela|eles|elas|assim|também|além disso|por isso|portanto|então|e|mas|ou|aqui|ali|nesse|nessa|neste|nesta|dessa|desse|disso|porque|pois|porquanto|ora|porém|logo|daí|dessa forma|desta forma)\b/i;
const GREETING = /\b(sa[uú]da[mi]?|sa[uú]dem|seja convosco|sejam convosco|com todos v[oó]s|am[eé]m\.?$|um abra[cç]o|obrigad[oa] pela|bem-vindos?)\b/i;

/**
 * Nota de uma frase para um resumo: fala do assunto do livro (palavras-chave),
 * tem tamanho de frase que se lê de uma vez, se sustenta sozinha e, quando o
 * autor destacou, vale mais. Perguntas e frases soltas ficam de fora.
 */
function sentenceScore(x: string, keys: Set<string>, highlight: boolean): number {
  const words = x.split(/\s+/).length;
  if (x.endsWith('?') || x.endsWith(':') || words < 7 || words > 40) return -1;
  const hits = (x.match(/[\p{L}]{4,}/gu) ?? []).filter((w) => keys.has(fold(w.toLowerCase()))).length;
  let score = hits / Math.sqrt(words) + (highlight ? 2 : 0) + (FAITH.test(x) ? 0.4 : 0) + (findReferences(x).length ? 0.3 : 0);
  if (DEPENDENT.test(x)) score -= 1.2;
  // pedaço de frase (começa em minúscula ou parêntese) não se lê sozinho
  if (/^[\p{Ll}(\[]/u.test(x)) score -= 1.5;
  // saudações e despedidas não são a mensagem
  if (GREETING.test(x)) score -= 1.5;
  if (/\d{3,}|https?:|www\./.test(x)) score -= 1;
  // frases muito curtas dizem pouco; as de 12 a 30 palavras explicam melhor
  if (words < 10) score -= 0.4;
  return score;
}

interface Picked {
  text: string;
  s: SectionReading;
  score: number;
}

/** A nota de cada frase de uma parte, calculada uma vez (por leitura e palavras-chave). */
const RANK_CACHE = new WeakMap<SectionReading, { keys: Set<string>; list: Picked[] }>();

function rankSection(s: SectionReading, keys: Set<string>): Picked[] {
  const hit = RANK_CACHE.get(s);
  if (hit && hit.keys === keys) return hit.list;
  const list: Picked[] = [];
  for (const text of sectionSentences(s)) {
    const score = sentenceScore(text, keys, s.highlights.some((h) => text.includes(h)));
    if (score > 0) list.push({ text, s, score });
  }
  RANK_CACHE.set(s, { keys, list });
  return list;
}

/** As melhores frases de um bloco de capítulos, da melhor para a pior. */
function rankSentences(group: SectionReading[], keys: Set<string>): Picked[] {
  return group.flatMap((s) => rankSection(s, keys)).sort((a, b) => b.score - a.score);
}

/** O capítulo que melhor representa o bloco: o de mais destaques, versículos e frases fortes. */
function representative(group: SectionReading[], ranked: Picked[]): SectionReading {
  const weight = (s: SectionReading) => s.highlights.length * 2 + Math.min(s.references.length, 6) * 0.5 + (ranked.find((p) => p.s === s)?.score ?? 0);
  return [...group].sort((a, b) => weight(b) - weight(a))[0];
}

/** Os versículos mais citados de um bloco. */
function topRefs(group: SectionReading[], n: number): string[] {
  const count = new Map<string, number>();
  for (const s of group) for (const r of s.references) count.set(r.label, (count.get(r.label) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label]) => label);
}

/** "Capítulo 2", "Parte 3": título que não diz o assunto. */
const GENERIC_TITLE = /^(cap[ií]tulo|parte|li[cç][aã]o|m[oó]dulo|aula|unidade|se[cç][aã]o|sess[aã]o|t[oó]pico|livro)?\s*[\divxlc]+\.?$/i;

/** "jesus" → "Jesus" quando o texto sempre escreve com maiúscula (nome próprio). */
function displayWord(word: string, group: SectionReading[]): string {
  const cap = word[0].toUpperCase() + word.slice(1);
  const text = group.map((s) => s.section.text).join(' ');
  const upper = (text.match(new RegExp(`\\b${cap}\\b`, 'g')) ?? []).length;
  const lower = (text.match(new RegExp(`\\b${word}\\b`, 'g')) ?? []).length;
  return upper > lower * 2 ? cap : word;
}

const VERB_FORM = /(am|ai|ei|ou|ndo|mos|ste|sse|ssem|riam|vam|avam|ava|ara|aram|eram|iram|aste|este|iste|ais|eis)$/;

/** Em quantas partes cada palavra aparece (calculado uma vez por leitura). */
const DOC_FREQ = new WeakMap<MaterialReading, Map<string, number>>();
const wordsOf = (text: string) => (text.match(/[\p{L}]{5,}/gu) ?? []).map((w) => w.toLowerCase()).filter((w) => !STOPWORDS.has(w));

function docFreq(r: MaterialReading): Map<string, number> {
  let df = DOC_FREQ.get(r);
  if (!df) {
    df = new Map();
    for (const s of r.sections) for (const w of new Set(wordsOf(s.section.text).map((x) => fold(x)))) df.set(w, (df.get(w) ?? 0) + 1);
    DOC_FREQ.set(r, df);
  }
  return df;
}

/**
 * Os temas próprios de um bloco ("Lei, pecado e carne"): palavras que aparecem
 * muito ali e pouco no resto do livro. Palavras do livro inteiro ("Senhor",
 * "Cristo") não distinguem um trecho do outro e ficam de fora.
 */
function themeOf(group: SectionReading[], r: MaterialReading, n = 3): string {
  const df = docFreq(r);
  const total = r.sections.length;
  const counts = new Map<string, { n: number; form: string }>();
  for (const s of group)
    for (const w of wordsOf(s.section.text)) {
      const k = fold(w);
      const e = counts.get(k) ?? { n: 0, form: w };
      e.n++;
      counts.set(k, e);
    }
  const words = [...counts.entries()]
    // formas de verbo ("praticam", "saudai", "falando") não nomeiam um tema
    .filter(([k, e]) => e.n >= 2 && !VERB_FORM.test(k))
    .map(([k, e]) => ({ form: e.form, score: e.n * Math.log(1 + total / (df.get(k) ?? 1)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => displayWord(x.form, group));
  if (!words.length) return '';
  const cap = words[0][0].toUpperCase() + words[0].slice(1);
  return words.length === 1 ? cap : `${[cap, ...words.slice(1, -1)].join(', ')} e ${words[words.length - 1]}`;
}

/** O nome de um bloco: o título do capítulo quando diz o assunto; senão, os temas dele. */
function groupName(group: SectionReading[], rep: SectionReading, r: MaterialReading): string {
  const title = cleanTitle(rep.section.title).trim();
  return !title || GENERIC_TITLE.test(title) ? themeOf(group, r) || title || 'Parte' : shortLabel(title, 6);
}

/** Rótulo curto de uma frase: as palavras-chave do livro que ela contém. */
function leafLabel(text: string, keys: Set<string>): string {
  const found: string[] = [];
  for (const w of text.match(/[\p{L}]{4,}/gu) ?? []) {
    const k = fold(w.toLowerCase());
    if (keys.has(k) && !found.some((f) => fold(f.toLowerCase()) === k)) found.push(w.toLowerCase());
    if (found.length === 2) break;
  }
  if (!found.length) return shortLabel(sectionKeywordsOf(text), 3);
  const label = found.join(' e ');
  return label[0].toUpperCase() + label.slice(1);
}

/** "cap. 3–4" quando o bloco junta capítulos. */
function rangeLabel(group: SectionReading[], all: SectionReading[]): string {
  if (group.length < 2) return '';
  const a = all.indexOf(group[0]) + 1;
  const b = all.indexOf(group[group.length - 1]) + 1;
  return ` (${a}–${b})`;
}

const KEYS = new WeakMap<MaterialReading, Set<string>>();
function keySetOf(r: MaterialReading): Set<string> {
  let k = KEYS.get(r);
  if (!k) KEYS.set(r, (k = new Set(r.keywords.map((x) => fold(x.word.toLowerCase())))));
  return k;
}

/** Estrutura montada só com o texto (sem IA), escolhendo do livro inteiro. */
export function buildBriefByRules(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): StudyBrief {
  const r = reading ?? readMaterial(material);
  const L = BRIEF_LIMITS;
  const sections = r.sections.filter((s) => s.section.text.trim());
  const keys = keySetOf(r);
  const used = new Set<string>();
  const take = (p?: Picked) => {
    if (p) used.add(fold(p.text));
    return p;
  };
  const fresh = (list: Picked[]) => list.find((p) => !used.has(fold(p.text)));

  // a tese: a ideia central do autor; senão, a frase mais forte do livro inteiro
  const allRanked = rankSentences(sections, keys);
  const thesisPick = material.centralIdea.trim() ? undefined : take(allRanked.find((p) => p.s.highlights.length && p.score >= 2) ?? allRanked[0]);
  const thesis = concise(material.centralIdea.trim() || thesisPick?.text || '', 30);
  used.add(fold(thesis));

  // a síntese: começo, meio e fim do livro, uma frase de cada
  const synthesisParts: string[] = [];
  for (const g of groupsOf(sections, 3)) {
    const p = take(fresh(rankSentences(g, keys)));
    if (!p) continue;
    const sentence = concise(p.text);
    if (synthesisParts.length && wordCount([...synthesisParts, sentence].join(' ')) > BRIEF_WORDS.synthesis) break;
    synthesisParts.push(sentence);
  }
  const synthesis = synthesisParts.join(' ');

  // a progressão: o livro inteiro em até 6 etapas (capítulos agrupados em ordem)
  const steps = groupsOf(sections, L.steps).map((g) => {
    const ranked = rankSentences(g, keys);
    const rep = representative(g, ranked);
    const question = g.flatMap((s) => s.questions)[0] ?? '';
    const best = take(fresh(ranked.filter((p) => fold(p.text) !== fold(question))));
    return {
      title: groupName(g, rep, r) + rangeLabel(g, sections),
      question,
      explanation: best ? concise(best.text) : answerOf(rep, question),
      link: '',
      refs: topRefs(g, 2),
      section: (best?.s ?? rep).section.title,
      origin: 'texto' as BriefOrigin,
    };
  });

  // o mapa: até 5 ramos cobrindo o livro todo; as folhas são o melhor de cada bloco
  const branches = groupsOf(sections, L.branches).map((g) => {
    const ranked = rankSentences(g, keys);
    const rep = representative(g, ranked);
    const summaryPick = ranked[0];
    const leaves: StudyBrief['branches'][number]['leaves'] = [];
    const seen = new Set<string>();
    const seenDetail = new Set<string>(summaryPick ? [fold(concise(summaryPick.text))] : []);
    const push = (label: string, detail: string, ref?: string) => {
      const k = fold(label);
      const d = fold(detail);
      if (!label || !detail || seen.has(k) || seenDetail.has(d) || leaves.length >= L.leaves) return;
      seen.add(k);
      seenDetail.add(d);
      leaves.push({ label, detail, ref });
    };
    // definições que falam do assunto do livro primeiro
    const defScore = (d: { term: string; meaning: string }) => sentenceScore(`${d.term} é ${d.meaning}`, keys, false);
    const defs = g.flatMap((s) => s.definitions).sort((a, b) => defScore(b) - defScore(a));
    for (const d of defs.slice(0, 2)) push(shortLabel(d.term, 3), concise(d.meaning));
    for (const label of topRefs(g, 2)) {
      const s = g.find((x) => x.references.some((ref) => ref.label === label))!;
      const ref = s.references.find((x) => x.label === label)!;
      push(label, concise(contextOf(s, ref)) || label, label);
    }
    for (const p of ranked.slice(1, 8)) push(leafLabel(p.text, keys), concise(p.text));
    return { label: groupName(g, rep, r), summary: summaryPick ? concise(summaryPick.text) : keyOf(rep), leaves, section: rep.section.title };
  });

  // as verdades: a melhor de cada trecho do livro (do começo ao fim)
  const truths = groupsOf(sections, L.truths)
    .map((g) => take(fresh(rankSentences(g, keys))))
    .filter((p): p is Picked => !!p)
    .map((p) => ({ text: concise(p.text), section: p.s.section.title, origin: 'texto' as BriefOrigin }));

  // cartões bíblicos: os versículos mais citados do livro, cada um com a sua frase
  const cards: BriefCard[] = [];
  const usedContexts = new Set<string>();
  for (const ref of r.references) {
    if (cards.length >= L.cardsPerKind) break;
    const s = sections.find((x) => x.references.some((y) => y.label === ref.label));
    if (!s) continue;
    const ctx = contextOf(s, ref);
    // dois versículos citados na mesma frase não viram dois cartões iguais
    if (!ctx || usedContexts.has(ctx)) continue;
    usedContexts.add(ctx);
    cards.push({ kind: 'biblico', front: ref.label, back: concise(ctx, 35), extra: cleanTitle(s.section.title), ref: ref.label, section: s.section.title, origin: 'texto' });
  }
  // princípios: destaques do autor espalhados pelo livro (os que ainda não apareceram)
  for (const g of groupsOf(sections, L.cardsPerKind)) {
    const p = take(fresh(rankSentences(g, keys).filter((x) => x.s.highlights.some((h) => x.text.includes(h)))) ?? fresh(rankSentences(g, keys)));
    if (!p) continue;
    const list = sectionSentences(p.s);
    const next = list[list.indexOf(p.text) + 1];
    cards.push({ kind: 'principio', front: concise(p.text), back: next && !next.endsWith('?') ? concise(next) : '', section: p.s.section.title, origin: 'texto' });
  }
  // revisão: uma definição de cada trecho do livro
  for (const g of groupsOf(sections.filter((s) => s.definitions.length), L.cardsPerKind)) {
    const d = g.flatMap((s) => s.definitions)[0];
    const s = g.find((x) => x.definitions.includes(d));
    if (d) cards.push({ kind: 'revisao', front: `O que é ${d.term.toLowerCase()}?`, back: concise(d.meaning), section: s?.section.title ?? '', origin: 'texto' });
  }

  // aplicações: as do plano primeiro; depois, as do texto espalhadas pelo livro
  const drafts = suggestActions(material);
  const bySection = groupsOf(sections, L.applications).map((g) => drafts.filter((a) => g.some((s) => s.section.id === a.sectionId)));
  const spread: string[] = [];
  for (let i = 0; spread.length < L.applications * 2 && bySection.some((b) => b[i]); i++) for (const b of bySection) if (b[i]) spread.push(b[i].text);
  const applications = [...new Set([...actions.filter((a) => a.status !== 'feito').map((a) => a.text), ...spread])].slice(0, L.applications);

  // DNA: um princípio de cada trecho, com o versículo mais citado dele
  const rows = groupsOf(sections, L.dnaRows)
    .map((g, i) => {
      const ranked = rankSentences(g, keys);
      const p = fresh(ranked.filter((x) => x.s.highlights.some((h) => x.text.includes(h)))) ?? fresh(ranked);
      const d = g.flatMap((s) => s.definitions)[0];
      const principle = p ? concise(p.text) : d ? concise(`${d.term}: ${d.meaning}`) : '';
      if (p) take(p);
      return { principle, base: topRefs(g, 1)[0] ?? '', application: applications[i] ?? '', origin: 'texto' as BriefOrigin };
    })
    .filter((row) => row.principle);

  // convicções: o que o autor mais afirma, do começo ao fim, sem repetir o que já apareceu
  const convictions = groupsOf(sections, 3)
    .map((g) => take(fresh(rankSentences(g, keys).filter((x) => x.score >= 0.6))))
    .filter((p): p is Picked => !!p)
    .map((p) => concise(p.text));

  // perguntas: uma de cada trecho do livro
  const questions = groupsOf(sections.filter((s) => s.questions.length), L.questions).map((g) => g.flatMap((s) => s.questions)[0]);

  return {
    thesis,
    ...findTurnsByRules(r),
    synthesis,
    objective: '',
    baseText: r.references.slice(0, 3).map((x) => x.label),
    truths,
    steps,
    branches,
    cards,
    dna: { thesis, convictions, rows, outcome: applications[0] ?? '' },
    applications,
    questions,
    source: 'regras',
    createdAt: now(),
  };
}

/** A palavra-chave principal de uma frase (para rótulos curtos do mapa). */
function sectionKeywordsOf(text: string): string {
  return sectionKeywords({ id: '', title: '', text }, 2).join(' ') || text;
}

/* ---------------------------------- IA ---------------------------------- */

const ORIGIN = { type: 'STRING', enum: ['texto', 'ia'] };
const BRIEF_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tese: { type: 'STRING' },
    pontoDeInflexao: {
      type: 'OBJECT',
      properties: { antes: { type: 'STRING' }, virada: { type: 'STRING' }, depois: { type: 'STRING' }, referencia: { type: 'STRING' }, secao: { type: 'STRING' }, origem: ORIGIN },
      required: ['antes', 'virada', 'depois', 'secao', 'origem'],
    },
    viradas: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { secao: { type: 'STRING' }, virada: { type: 'STRING' }, referencia: { type: 'STRING' }, origem: ORIGIN }, required: ['secao', 'virada', 'origem'] },
    },
    sintese: { type: 'STRING' },
    objetivo: { type: 'STRING' },
    textoBase: { type: 'ARRAY', items: { type: 'STRING' } },
    verdades: { type: 'ARRAY', items: { type: 'OBJECT', properties: { texto: { type: 'STRING' }, secao: { type: 'STRING' }, origem: ORIGIN }, required: ['texto', 'secao', 'origem'] } },
    progressao: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          etapa: { type: 'STRING' },
          pergunta: { type: 'STRING' },
          explicacao: { type: 'STRING' },
          ligacao: { type: 'STRING' },
          referencias: { type: 'ARRAY', items: { type: 'STRING' } },
          secao: { type: 'STRING' },
          origem: ORIGIN,
        },
        required: ['etapa', 'pergunta', 'explicacao', 'ligacao', 'referencias', 'secao', 'origem'],
      },
    },
    ramos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          rotulo: { type: 'STRING' },
          resumo: { type: 'STRING' },
          secao: { type: 'STRING' },
          folhas: { type: 'ARRAY', items: { type: 'OBJECT', properties: { rotulo: { type: 'STRING' }, detalhe: { type: 'STRING' }, referencia: { type: 'STRING' } }, required: ['rotulo', 'detalhe'] } },
        },
        required: ['rotulo', 'resumo', 'secao', 'folhas'],
      },
    },
    cartoes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tipo: { type: 'STRING', enum: ['biblico', 'principio', 'conexao', 'revisao'] },
          frente: { type: 'STRING' },
          verso: { type: 'STRING' },
          extra: { type: 'STRING' },
          referencia: { type: 'STRING' },
          secao: { type: 'STRING' },
          origem: ORIGIN,
        },
        required: ['tipo', 'frente', 'verso', 'secao', 'origem'],
      },
    },
    dna: {
      type: 'OBJECT',
      properties: {
        tese: { type: 'STRING' },
        conviccoes: { type: 'ARRAY', items: { type: 'STRING' } },
        matriz: { type: 'ARRAY', items: { type: 'OBJECT', properties: { principio: { type: 'STRING' }, base: { type: 'STRING' }, aplicacao: { type: 'STRING' }, origem: ORIGIN }, required: ['principio', 'base', 'aplicacao', 'origem'] } },
        resultado: { type: 'STRING' },
      },
      required: ['tese', 'conviccoes', 'matriz', 'resultado'],
    },
    aplicacoes: { type: 'ARRAY', items: { type: 'STRING' } },
    perguntas: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['tese', 'pontoDeInflexao', 'viradas', 'sintese', 'objetivo', 'textoBase', 'verdades', 'progressao', 'ramos', 'cartoes', 'dna', 'aplicacoes', 'perguntas'],
};

const MAX_CHARS = 1_500_000;
/** Viradas por capítulo: um livro grande tem dezenas de capítulos. */
const MAX_TURNS = 40;

export function buildBriefPrompt(material: Material): string {
  const L = BRIEF_LIMITS;
  const text = material.sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n').slice(0, MAX_CHARS);
  return [
    `Você é um assistente de estudo para pastores, líderes e membros de igreja. Leia o material “${material.title}”${material.author ? `, de ${material.author}` : ''}, e monte UMA estrutura de estudo, em português do Brasil, que servirá a todos os resumos visuais. O objetivo é qualidade e ganho de tempo: o leitor deve entender e aplicar a mensagem rapidamente, sem repetir o livro.`,
    '',
    'Preencha:',
    '- tese: a mensagem central em uma frase de até 20 palavras;',
    '- pontoDeInflexao: a VIRADA da mensagem, o insight supremo — o momento em que a direção muda (do problema para a resposta, da visão antiga para a nova). "antes": como era, em uma frase; "virada": o que muda e por quê, em uma frase de até 25 palavras; "depois": o novo posicionamento, em uma frase; "referencia": o versículo em que a virada acontece, se houver no material;',
    `- viradas: a virada de CADA parte do material (cada "##"), na ordem, uma frase de até 20 palavras cada (até ${MAX_TURNS}); "secao" com o título exato da parte;`,
    `- sintese: no máximo 2 frases curtas (até ${BRIEF_WORDS.synthesis} palavras ao todo), para entender a mensagem em 20 segundos;`,
    '- objetivo: o que o material quer produzir no leitor, em uma frase;',
    '- textoBase: as referências bíblicas principais do material;',
    `- verdades: as ${L.truths} principais verdades, no máximo, cada uma em uma frase de até 18 palavras;`,
    `- progressao: de 3 a ${L.steps} etapas que mostram a LINHA DE RACIOCÍNIO do material (causa e efeito, não um índice de capítulos). Cada etapa: "etapa" com 2 a 5 palavras, a "pergunta" que ela responde, a "explicacao" em uma frase de até 20 palavras (sem repetir a pergunta) e a "ligacao" com a próxima etapa (um verbo ou expressão curta, como "alimenta", "gera", "permite", "resulta em"; vazio na última);`,
    `- ramos: de 3 a ${L.branches} ramos do mapa mental, do conflito ou problema à solução. "rotulo" com 1 a 3 palavras; "resumo" em uma frase de até 15 palavras; até ${L.leaves} "folhas" com rótulo de 1 a 3 palavras e "detalhe" em uma frase de até 20 palavras;`,
    `- cartoes: até ${L.cardsPerKind} de cada tipo, sem repetir o que já está nas etapas: "biblico" (frente = referência, verso = a verdade central do texto, extra = relação com a mensagem); "principio" (frente = o princípio, verso = explicação breve, extra = implicação); "conexao" (frente = "conceito ou texto A → conceito ou texto B", verso = a explicação da relação); "revisao" (frente = pergunta objetiva, verso = resposta curta, referencia quando houver);`,
    `- dna: tese, até 3 convicções, uma matriz de até ${L.dnaRows} linhas (principio = o quê; base = a referência bíblica, onde; aplicacao = como) e o resultado esperado;`,
    `- aplicacoes: até ${L.applications} aplicações práticas; perguntas: até ${L.questions} perguntas para reflexão ou grupo.`,
    '',
    'Regras:',
    '- Use o material inteiro como fonte; preserve a tese, os argumentos, os versículos e as conexões bíblicas.',
    '- "origem": "texto" quando o item está dito no material; "ia" quando é uma inferência sua. Seja honesto nessa marcação.',
    '- "secao": o título exato da parte do material de onde o item vem (como aparece depois de "##").',
    '- Referências bíblicas: use SOMENTE as que aparecem no material, escritas como "Livro capítulo:versículo". Não invente citações, autores nem fontes.',
    '- Enxuto: o leitor deve ler cada quadro de relance. Selecione o essencial; não resuma tudo. Frases completas, curtas e claras. Nunca use reticências nem corte frases. Não repita o mesmo conteúdo em lugares diferentes.',
    '',
    'MATERIAL:',
    text,
  ].join('\n');
}

const str = (v: unknown) => String(v ?? '').replace(/…|\.{3,}/g, '').trim();
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const origin = (v: unknown): BriefOrigin => (v === 'texto' ? 'texto' : 'ia');
const objs = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/** Converte a resposta da IA (chaves em português) na estrutura do app, com os limites. */
export function parseBriefAnswer(raw: string): Omit<StudyBrief, 'source' | 'createdAt' | 'model'> {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
  } catch {
    throw new Error('A IA respondeu num formato inesperado. Tente de novo.');
  }
  const L = BRIEF_LIMITS;
  const thesis = str(d.tese);
  if (!thesis) throw new Error('A IA não devolveu a tese do estudo. Tente de novo.');
  const dna = (d.dna ?? {}) as Record<string, unknown>;
  const kinds = ['biblico', 'principio', 'conexao', 'revisao'] as const;
  const cards: BriefCard[] = [];
  for (const k of kinds)
    cards.push(
      ...objs(d.cartoes)
        .filter((c) => c.tipo === k)
        .slice(0, L.cardsPerKind)
        .map((c) => ({ kind: k, front: str(c.frente), back: str(c.verso), extra: str(c.extra) || undefined, ref: str(c.referencia) || undefined, section: str(c.secao), origin: origin(c.origem) }))
        .filter((c) => c.front && c.back),
    );
  const pi = (d.pontoDeInflexao ?? {}) as Record<string, unknown>;
  const inflection = str(pi.virada)
    ? { before: str(pi.antes), turn: str(pi.virada), after: str(pi.depois), ref: str(pi.referencia) || undefined, section: str(pi.secao), origin: origin(pi.origem) }
    : undefined;
  return {
    thesis,
    inflection,
    chapterTurns: objs(d.viradas)
      .slice(0, MAX_TURNS)
      .map((v) => ({ section: str(v.secao), turn: str(v.virada), ref: str(v.referencia) || undefined, origin: origin(v.origem) }))
      .filter((v) => v.turn),
    synthesis: str(d.sintese),
    objective: str(d.objetivo),
    baseText: arr(d.textoBase),
    truths: objs(d.verdades).slice(0, L.truths).map((t) => ({ text: str(t.texto), section: str(t.secao), origin: origin(t.origem) })).filter((t) => t.text),
    steps: objs(d.progressao)
      .slice(0, L.steps)
      .map((p) => ({ title: str(p.etapa), question: str(p.pergunta), explanation: str(p.explicacao), link: str(p.ligacao), refs: arr(p.referencias), section: str(p.secao), origin: origin(p.origem) }))
      .filter((p) => p.title),
    branches: objs(d.ramos)
      .slice(0, L.branches)
      .map((b) => ({
        label: str(b.rotulo),
        summary: str(b.resumo),
        section: str(b.secao),
        leaves: objs(b.folhas)
          .slice(0, L.leaves)
          .map((f) => ({ label: str(f.rotulo), detail: str(f.detalhe), ref: str(f.referencia) || undefined }))
          .filter((f) => f.label),
      }))
      .filter((b) => b.label),
    cards,
    dna: {
      thesis: str(dna.tese) || thesis,
      convictions: arr(dna.conviccoes).slice(0, 3),
      rows: objs(dna.matriz).slice(0, L.dnaRows).map((m) => ({ principle: str(m.principio), base: str(m.base), application: str(m.aplicacao), origin: origin(m.origem) })).filter((m) => m.principle),
      outcome: str(dna.resultado),
    },
    applications: arr(d.aplicacoes).slice(0, L.applications),
    questions: arr(d.perguntas).slice(0, L.questions),
  };
}

/** A IA monta a estrutura do material inteiro (uma chamada). */
export async function buildBriefWithAi(material: Material, opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<StudyBrief> {
  if (!material.sections.some((s) => s.text.trim())) throw new Error('Não há texto para estudar.');
  const prompt = buildBriefPrompt(material);
  let model = '';
  const answer = await withModel(opts, (config) => {
    model = config.model;
    return callGemini(prompt, config, BRIEF_SCHEMA, opts).then(parseBriefAnswer);
  });
  return { ...answer, source: 'ia', model, createdAt: now() };
}

/* ------------------------------ conferências ----------------------------- */

/**
 * Referências da estrutura que NÃO aparecem no texto do material (a IA pode
 * errar): o app mostra um aviso nelas.
 */
export function refsNotInText(brief: StudyBrief, material: Material, reading?: MaterialReading): Set<string> {
  // o livro e o capítulo precisam estar citados no material
  const inText = new Set((reading ?? readMaterial(material)).references.map((r) => `${r.osis}.${r.chapter}`));
  const all = [
    ...brief.baseText,
    ...brief.steps.flatMap((s) => s.refs),
    ...brief.branches.flatMap((b) => b.leaves.map((l) => l.ref ?? '')),
    ...brief.cards.map((c) => c.ref ?? ''),
    ...brief.dna.rows.map((r) => r.base),
    brief.inflection?.ref ?? '',
    ...(brief.chapterTurns ?? []).map((t) => t.ref ?? ''),
  ].filter(Boolean);
  const bad = new Set<string>();
  for (const ref of all) {
    const found = findReferences(ref);
    // não é referência reconhecível (ex.: "Números 13 e 14"): não há o que conferir
    if (found.length && !found.every((f) => inText.has(`${f.osis}.${f.chapter}`))) bad.add(ref);
  }
  return bad;
}

/** O id da parte pelo título (para "ver no texto"). */
export function sectionIdByTitle(material: Material, title: string): string | undefined {
  if (!title) return undefined;
  const k = fold(cleanTitle(title));
  return material.sections.find((s) => fold(s.title) === fold(title) || fold(cleanTitle(s.title)) === k)?.id;
}

export async function saveBrief(materialId: string, brief: StudyBrief | undefined): Promise<void> {
  const m = await db.materials.get(materialId);
  if (m) await db.materials.put({ ...m, brief });
}

/** A estrutura salva, ou a das regras quando ainda não há nenhuma. */
/** A estrutura das regras, guardada por leitura: trocar de aba não refaz o trabalho. */
const RULES_CACHE = new WeakMap<MaterialReading, { key: string; brief: StudyBrief }>();

export function currentBrief(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): StudyBrief {
  if (material.brief) return material.brief;
  if (!reading) return buildBriefByRules(material, reading, actions);
  const key = [material.title, material.centralIdea, ...actions.map((a) => `${a.id}:${a.status}:${a.text}`)].join('\u0001');
  const hit = RULES_CACHE.get(reading);
  if (hit && hit.key === key) return hit.brief;
  const brief = buildBriefByRules(material, reading, actions);
  RULES_CACHE.set(reading, { key, brief });
  return brief;
}
