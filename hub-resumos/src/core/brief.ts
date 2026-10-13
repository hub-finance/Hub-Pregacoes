import { suggestActions } from './actions';
import { callGemini, withModel } from './ai';
import { findReferences, fold } from './bible';
import { db, now } from './db';
import { extractiveSummary } from './summary';
import { cleanTitle, readMaterial, sectionKeywords, sentences, type MaterialReading, type SectionReading } from './text';
import type { ActionItem, BriefCard, BriefOrigin, Material, StudyBrief } from './types';

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
  const first = raw && !/[.!?:]$/.test(raw) ? `${raw}.` : raw;
  if (wordCount(first) <= max) return first;
  const parts = first.split(/(?<=[;:—–])\s+|,\s+(?=(?:mas|porém|pois|porque|e|que|quando|para|pois)\b)|,\s+/);
  let out = '';
  for (const part of parts) {
    const next = out ? `${out}, ${part}` : part;
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
function contextOf(s: SectionReading, raw: string): string {
  return [...s.paragraphs, ...s.highlights, ...s.listItems].flatMap(sentences).find((x) => x.includes(raw.trim())) ?? '';
}

/** Estrutura montada só com o texto (sem IA). */
export function buildBriefByRules(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): StudyBrief {
  const r = reading ?? readMaterial(material);
  const L = BRIEF_LIMITS;
  const sections = r.sections.filter((s) => s.section.text.trim());
  const first = sections[0];
  const thesis = concise(material.centralIdea.trim() || r.highlights[0]?.text || (first ? keyRaw(first) : ''), 30);
  const summary = extractiveSummary(material, 'curto', r);
  const synthesisParts: string[] = [];
  for (const sentence of summary.flatMap((p) => p.sentences).filter((x) => x !== thesis).map((x) => concise(x))) {
    if (synthesisParts.length && wordCount([...synthesisParts, sentence].join(' ')) > BRIEF_WORDS.synthesis) break;
    synthesisParts.push(sentence);
    if (synthesisParts.length === 3) break;
  }
  const synthesis = synthesisParts.join(' ');

  const steps = sections.slice(0, L.steps).map((s) => ({
    title: shortLabel(cleanTitle(s.section.title), 6),
    question: s.questions[0] ?? '',
    // a explicação não pode repetir a pergunta da etapa
    explanation: answerOf(s, s.questions[0] ?? ''),
    link: '',
    refs: s.references.slice(0, 2).map((x) => x.label),
    section: s.section.title,
    origin: 'texto' as BriefOrigin,
  }));

  const branches = sections.slice(0, L.branches).map((s) => {
    const leaves: StudyBrief['branches'][number]['leaves'] = [];
    const seen = new Set<string>();
    // o resumo do ramo não se repete nas folhas, nem a mesma frase em duas folhas
    const seenDetail = new Set<string>([fold(keyOf(s))]);
    const push = (label: string, detail: string, ref?: string) => {
      const k = fold(label);
      const d = fold(detail);
      if (!label || !detail || seen.has(k) || (seenDetail.has(d) && d !== k) || leaves.length >= L.leaves) return;
      seen.add(k);
      seenDetail.add(d);
      leaves.push({ label, detail, ref });
    };
    for (const d of s.definitions) push(shortLabel(d.term, 3), concise(d.meaning));
    for (const ref of s.references) push(ref.label, concise(contextOf(s, ref.raw)) || ref.label, ref.label);
    for (const h of s.highlights) push(shortLabel(sectionKeywordsOf(h), 3), concise(h));
    for (const q of s.questions) push('Pergunta', q);
    return { label: shortLabel(cleanTitle(s.section.title), 6), summary: keyOf(s), leaves, section: s.section.title };
  });

  const cards: BriefCard[] = [];
  const usedContexts = new Set<string>();
  for (const s of sections) {
    for (const ref of s.references) {
      if (cards.filter((c) => c.kind === 'biblico').length >= L.cardsPerKind) break;
      const ctx = contextOf(s, ref.raw);
      // dois versículos citados na mesma frase não viram dois cartões iguais
      if (!ctx || usedContexts.has(ctx)) continue;
      usedContexts.add(ctx);
      cards.push({ kind: 'biblico', front: ref.label, back: ctx, extra: cleanTitle(s.section.title), ref: ref.label, section: s.section.title, origin: 'texto' });
    }
  }
  for (const h of r.highlights.slice(0, L.cardsPerKind)) {
    const s = sections.find((x) => x.section.id === h.sectionId);
    cards.push({ kind: 'principio', front: h.text, back: s ? (sentences(s.paragraphs[0] ?? '')[0] ?? '') : '', section: s?.section.title ?? '', origin: 'texto' });
  }
  for (const d of r.definitions.slice(0, L.cardsPerKind)) {
    const s = sections.find((x) => x.section.id === d.sectionId);
    cards.push({ kind: 'revisao', front: `O que é ${d.term.toLowerCase()}?`, back: d.meaning, section: s?.section.title ?? '', origin: 'texto' });
  }

  const applicationsAll = [...actions.filter((a) => a.status !== 'feito').map((a) => a.text), ...suggestActions(material).map((a) => a.text)];
  const applications = [...new Set(applicationsAll)].slice(0, L.applications);
  const rows = sections
    .filter((s) => s.highlights.length || s.definitions.length)
    .slice(0, L.dnaRows)
    .map((s, i) => ({
      principle: concise(s.highlights[0] ?? `${s.definitions[0].term}: ${s.definitions[0].meaning}`),
      base: s.references[0]?.label ?? '',
      application: applications[i] ?? '',
      origin: 'texto' as BriefOrigin,
    }));

  return {
    thesis,
    synthesis,
    objective: '',
    baseText: r.references.slice(0, 3).map((x) => x.label),
    truths: (r.highlights.length ? r.highlights.map((h) => ({ text: h.text, id: h.sectionId })) : sections.map((s) => ({ text: keyOf(s), id: s.section.id })))
      .filter((t) => t.text && t.text !== thesis)
      .slice(0, L.truths)
      .map((t) => ({ text: concise(t.text), section: sections.find((s) => s.section.id === t.id)?.section.title ?? '', origin: 'texto' as BriefOrigin })),
    steps,
    branches,
    cards,
    dna: { thesis, convictions: r.highlights.slice(0, 3).map((h) => concise(h.text)), rows, outcome: applications[0] ?? '' },
    applications,
    questions: r.questions.slice(0, L.questions).map((q) => q.text),
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
  required: ['tese', 'sintese', 'objetivo', 'textoBase', 'verdades', 'progressao', 'ramos', 'cartoes', 'dna', 'aplicacoes', 'perguntas'],
};

const MAX_CHARS = 1_500_000;

export function buildBriefPrompt(material: Material): string {
  const L = BRIEF_LIMITS;
  const text = material.sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n').slice(0, MAX_CHARS);
  return [
    `Você é um assistente de estudo para pastores, líderes e membros de igreja. Leia o material “${material.title}”${material.author ? `, de ${material.author}` : ''}, e monte UMA estrutura de estudo, em português do Brasil, que servirá a todos os resumos visuais. O objetivo é qualidade e ganho de tempo: o leitor deve entender e aplicar a mensagem rapidamente, sem repetir o livro.`,
    '',
    'Preencha:',
    '- tese: a mensagem central em uma frase de até 20 palavras;',
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
  return {
    thesis,
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
export function refsNotInText(brief: StudyBrief, material: Material): Set<string> {
  // o livro e o capítulo precisam estar citados no material
  const inText = new Set(readMaterial(material).references.map((r) => `${r.osis}.${r.chapter}`));
  const all = [
    ...brief.baseText,
    ...brief.steps.flatMap((s) => s.refs),
    ...brief.branches.flatMap((b) => b.leaves.map((l) => l.ref ?? '')),
    ...brief.cards.map((c) => c.ref ?? ''),
    ...brief.dna.rows.map((r) => r.base),
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
export function currentBrief(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): StudyBrief {
  return material.brief ?? buildBriefByRules(material, reading, actions);
}
