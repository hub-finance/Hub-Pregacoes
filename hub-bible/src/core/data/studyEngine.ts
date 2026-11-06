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

import { getChapter, getVerses } from '../bible/repository';
import { formatReference, parseReference, type ParsedReference } from '../bible/reference';
import { bookName, findBook, normalize } from '../bible/canon';
import { findByTransliteration, lookupBuiltinStrong } from '../bible/lexicon';
import { ensureSearchable, searchScripture } from '../bible/search';
import { lookupStrong } from './dictionaries';
import {
  findTypologyForVerse,
  getCrossReferences,
  getDoctrinalGuides,
  getTheologicalDict,
  getTypology,
  type DoctrinalGuide,
  type TheologicalEntry,
  type TypologyPair,
} from '../bible/reference-data';
import { findGuidesForPassage, getDoctrinalPack } from '../bible/doctrinalPack';
import { validateReferences } from '../ai/provider';
import { findRequestReferences, type AssistantDepth, type AssistantMode } from '../ai/assistant';
import type { AssistantGoal } from '../ai/assistantDocument';

export interface EngineInput {
  text: string;
  passage: string;
  translation: string;
  goal: AssistantGoal;
  mode: AssistantMode;
  depth: AssistantDepth;
}

export interface EngineOutput {
  content: string;
  validRefs: string[];
  sources: string[];
}

/* ─────────────────────────────── limites ─────────────────────────────── */

/** Poucos pontos, bem escolhidos — o princípio do Hub Resumos. */
const LIMITS: Record<AssistantDepth, { texts: number; cross: number; terms: number; entries: number }> = {
  objetivo: { texts: 3, cross: 3, terms: 2, entries: 1 },
  auto: { texts: 5, cross: 5, terms: 3, entries: 2 },
  profundo: { texts: 8, cross: 8, terms: 5, entries: 4 },
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
  sources: string[];
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
  const normText = ` ${plain(input.text)} `;
  const entries: TheologicalEntry[] = [];
  for (const e of dict) {
    const variants = e.termo.split(/\s+[—–-]\s+|\s*\/\s*/).map(plain).filter((t) => t.length >= 2);
    if (variants.some((t) => normText.includes(` ${t} `))) entries.push(e);
  }
  if (anchor?.verse) {
    const key = `${anchor.book}.${anchor.chapter}.${anchor.verse}`;
    for (const e of dict) if (e.textos.includes(key) && !entries.includes(e)) entries.push(e);
  }
  const chosen = entries.slice(0, lim.entries);
  if (chosen.length) sources.add('dicionário teológico');

  /* sem passagem citada: os textos vêm do verbete; sem verbete, da busca */
  let searchTerm = '';
  if (!keyTexts.length) {
    for (const e of chosen) {
      for (const k of e.textos) {
        const r = osisToRef(k);
        if (r && !seenRef.has(refKey(r))) { seenRef.add(refKey(r)); keyTexts.push(r); }
      }
    }
  }
  if (!keyTexts.length) {
    // a busca precisa da tradução inteira no aparelho (a Bíblia embutida já vem com o app)
    await ensureSearchable(input.translation).catch(() => undefined);
    // até duas palavras do tema; os versículos das duas entram juntos
    const found: string[] = [];
    for (const word of themeWords(input.text).slice(0, 4)) {
      if (found.length >= 2 || keyTexts.length >= lim.texts) break;
      const res = await searchScripture(word, { translation: input.translation, wholeWord: true, limit: lim.texts })
        .catch(() => null);
      if (!res?.hits.length) continue;
      found.push(word);
      for (const h of res.hits) {
        const r = { book: h.book, chapter: h.chapter, verse: h.verse };
        if (!seenRef.has(refKey(r))) { seenRef.add(refKey(r)); keyTexts.push(r); }
      }
    }
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
  for (const w of themeWords(input.text).slice(0, 12)) {
    for (const entry of await findByTransliteration(w, 1)) addCode(entry.code);
  }
  for (const e of chosen) { addCode(e.hebraico?.strong); addCode(e.grego?.strong); }
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
  return g.entries.map((e) => [
    `**${e.termo}.** ${e.definicao}`,
    e.distincao ? `\n**Distinção:** ${e.distincao}` : '',
    e.relacionados.length ? `\nVerbetes relacionados: ${e.relacionados.join(', ')}.` : '',
  ].join('')).join('\n\n');
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
  const anchor = g.keyTexts.find((r) => r.verse);
  const parts = [
    section('1. O texto', await quotes(t, g.keyTexts)),
    section('2. Contexto', [
      anchor ? await immediateContext(t, anchor) : '',
      g.cross.length ? `Referências cruzadas: ${g.cross.map((r) => `[${formatReference(r)}]`).join(', ')}.` : '',
    ].filter(Boolean).join('\n\n')),
    section('3. Língua original', originalSection(g)),
    section('4. O que o dicionário diz', dictionarySection(g)),
    section('5. Cristo e a Nova Aliança', typologySection(g)),
    section('6. Doutrina — guias', guidesSection(g)),
    section('7. Interpretação e aplicação', [
      '**O texto diz:** ' + WRITE,
      '**A interpretação sugere:** ' + WRITE,
      '**A doutrina conclui:** ' + WRITE,
      '**A aplicação propõe:** ' + WRITE,
    ].join('\n\n')),
  ];
  return parts.filter(Boolean).join('\n\n');
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
    const rest = g.keyTexts.filter((r) => !main || refKey(r) !== refKey(main)).slice(0, 3);
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
    section('Textos-chave', await quotes(t, g.keyTexts.slice(0, 4))),
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
