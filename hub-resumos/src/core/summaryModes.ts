import { suggestActions } from './actions';
import { callGemini, withModel } from './ai';
import { concise, currentBrief, DEPENDENT, keySetOf, rankSentences } from './brief';
import { db, now } from './db';
import { humanize, ORIGIN_RULE, voicePrompt } from './voice';
import { cleanTitle, readMaterial, sameIdea, sectionSentences, type MaterialReading, type SectionReading } from './text';
import type { ActionItem, Material, ModeBlock, ModeSummary, StudyKind, SummaryDepth, SummaryMode } from './types';

/**
 * As modalidades de resumo do Prompt Mestre (item 2): executivo, essencial,
 * aprofundado, analítico e por capítulo, cada uma com a sua estrutura e uma
 * profundidade escolhida. Sem IA, são montadas com frases do próprio livro
 * (nada reescrito); com IA, cada modalidade tem o seu pedido próprio e o
 * resultado fica guardado no material.
 */
export const MODE_LABEL: Record<SummaryMode, string> = {
  estudo: 'Estudo completo',
  executivo: 'Executivo',
  essencial: 'Essencial',
  aprofundado: 'Aprofundado',
  analitico: 'Analítico',
  capitulos: 'Por capítulo',
};

export const MODE_HINT: Record<SummaryMode, string> = {
  estudo: 'A estrutura preferida: ideia central, contexto, desenvolvimento, princípios, conexões, aplicações e síntese final.',
  executivo: 'Tema, objetivo do autor, ideias principais, conclusão e aplicação — para entender em 2 minutos.',
  essencial: 'Só o indispensável: a ideia central, os conceitos que não podem faltar e uma frase por parte.',
  aprofundado: 'Cada parte explicada: ideias, argumentos, exemplos, conceitos e como as ideias se ligam.',
  analitico: 'Tese, estrutura do argumento, fundamentos, implicações, pontos fortes e limitações.',
  capitulos: 'Respeita a ordem do livro: em cada capítulo, ideia central, conceitos, argumentos, exemplos, aplicações e conclusão.',
};

export const KIND_LABEL: Record<StudyKind, string> = {
  biblico: 'Bíblico e teológico',
  didatico: 'Didático',
  academico: 'Acadêmico',
  profissional: 'Profissional',
  treinamento: 'Formação e treinamento',
  pessoal: 'Desenvolvimento pessoal',
  tecnico: 'Técnico',
};

export const DEPTH_LABEL: Record<SummaryDepth, string> = { breve: 'Breve', normal: 'Normal', completo: 'Completo' };

/** Quantos itens por lista em cada profundidade: poucos e bons no breve. */
const N: Record<SummaryDepth, number> = { breve: 3, normal: 5, completo: 8 };

export const ORIGIN_NAME = { texto: 'do autor', ia: 'análise da IA', fe: 'aplicação da fé' } as const;

export const summaryKey = (mode: SummaryMode, kind: StudyKind, depth: SummaryDepth) => `${mode}|${kind}|${depth}`;

const EXAMPLE = /\b(por exemplo|como quando|imagine|certa vez|ilustra|é como|assim como|um homem|uma mulher|conta-se|aconteceu)\b/i;
const CONCLUSION = /\b(portanto|por isso|assim|concluindo|em suma|finalmente|enfim|logo|dessa forma|desta forma)\b/i;

/** Frases boas de uma parte: se sustentam sozinhas e falam do assunto do livro. */
function goodSentences(s: SectionReading, keys: Set<string>) {
  return rankSentences([s], keys).filter((p) => /^\p{Lu}/u.test(p.text) && !DEPENDENT.test(p.text));
}

/** Lista sem a mesma ideia duas vezes, limitada a `n`. */
function distinct(list: string[], n: number, seen: string[] = []): string[] {
  const out: string[] = [];
  for (const x of list) {
    if (out.length >= n) break;
    if (!x || seen.some((y) => sameIdea(x, y)) || out.some((y) => sameIdea(x, y))) continue;
    out.push(x);
  }
  return out;
}

/**
 * Cada ideia num lugar só dentro do resumo (como no estudo): na ordem dos
 * blocos, o que já apareceu sai das listas seguintes; bloco vazio some.
 */
export function dedupeBlocks(blocks: ModeBlock[]): ModeBlock[] {
  const seen: string[] = [];
  const fresh = (t: string) => {
    if (seen.some((x) => sameIdea(x, t))) return false;
    seen.push(t);
    return true;
  };
  const walk = (b: ModeBlock): ModeBlock | null => {
    const text = b.text && fresh(b.text) ? b.text : undefined;
    const items = b.items?.filter((x) => fresh(x));
    const parts = b.parts?.map(walk).filter((x): x is ModeBlock => !!x);
    return text || items?.length || parts?.length ? { ...b, text, items: items?.length ? items : undefined, parts: parts?.length ? parts : undefined } : null;
  };
  return blocks.map(walk).filter((x): x is ModeBlock => !!x);
}

/** O resumo de uma modalidade montado só com o texto (sem IA). */
export function buildModeByRules(material: Material, mode: SummaryMode, depth: SummaryDepth, reading?: MaterialReading, actions: ActionItem[] = []): ModeSummary {
  const r = reading ?? readMaterial(material);
  const brief = currentBrief(material, r, actions);
  const keys = keySetOf(r);
  const n = N[depth];
  const sections = r.sections.filter((s) => s.section.text.trim());
  const applications = distinct([...brief.applications, ...suggestActions(material).map((a) => a.text)].map((x) => concise(x)), n);
  const definitions = (list: SectionReading[], k: number) => distinct(list.flatMap((s) => s.definitions.map((d) => `${d.term}: ${concise(d.meaning)}`)), k);
  const lastStrong = (s: SectionReading) => {
    const good = goodSentences(s, keys);
    const list = sectionSentences(s).filter((x) => good.some((p) => p.text === x));
    return list.reverse().find((x) => CONCLUSION.test(x)) ?? list[0];
  };
  const blocks: ModeBlock[] = [];
  const push = (b: ModeBlock) => {
    if (b.text || b.items?.length || b.parts?.length) blocks.push(b);
  };

  if (mode === 'estudo') {
    // a estrutura preferencial da Instrução Mestra (item 8)
    push({ heading: 'Ideia central', text: brief.thesis });
    push({ heading: 'Contextualização', text: brief.objective || brief.synthesis });
    push({ heading: 'Desenvolvimento', items: brief.steps.filter((st) => st.explanation).map((st) => `${st.title}: ${st.explanation}`) });
    push({ heading: 'Princípios fundamentais', items: distinct([...brief.dna.rows.map((x) => x.principle), ...brief.truths.map((t) => t.text)], n) });
    push({
      heading: 'Conexões e aprofundamentos',
      items: distinct([...(brief.chapterTurns ?? []).map((t) => `${cleanTitle(t.section)}: ${t.turn}`), ...r.references.slice(0, 3).map((x) => `${x.label}, o texto mais citado do material`)], n),
    });
    push({ heading: 'Aplicações práticas', items: applications });
    push({ heading: 'Síntese final', text: brief.dna.outcome && !applications.some((a) => sameIdea(a, brief.dna.outcome)) ? brief.dna.outcome : brief.synthesis });
  }

  if (mode === 'executivo') {
    push({ heading: 'Tema central', text: brief.thesis });
    push({ heading: 'Objetivo do autor', text: brief.objective });
    // frase que pede ação vai para a aplicação, não para as ideias
    push({ heading: 'Ideias principais', items: distinct([...brief.truths.map((t) => t.text), ...brief.steps.map((st) => st.explanation)].filter((t) => t && !applications.some((a) => sameIdea(a, t))), n, [brief.thesis]) });
    const last = sections[sections.length - 1];
    const end = last && lastStrong(last);
    const endText = end && !applications.some((a) => sameIdea(a, end)) ? concise(end, 35) : '';
    push({ heading: 'Conclusão', text: endText, section: last?.section.title });
    push({ heading: 'Aplicação prática', items: applications.slice(0, Math.min(n, 3)) });
  }

  if (mode === 'essencial') {
    push({ heading: 'Ideia central', text: brief.thesis });
    push({ heading: 'Conceitos indispensáveis', items: definitions(sections, n) });
    push({
      heading: 'Uma frase por parte',
      items: brief.steps.filter((st) => st.explanation).map((st) => `${st.title}: ${st.explanation}`),
    });
  }

  if (mode === 'aprofundado') {
    push({ heading: 'Tese', text: brief.thesis });
    for (const s of sections) {
      const ranked = goodSentences(s, keys).map((p) => concise(p.text, 35));
      const ideas = distinct(ranked, depth === 'breve' ? 2 : depth === 'normal' ? 3 : 5);
      const examples = distinct(sectionSentences(s).filter((x) => EXAMPLE.test(x)).map((x) => concise(x, 35)), depth === 'completo' ? 2 : 1, ideas);
      const turn = brief.chapterTurns?.find((t) => t.section === s.section.title);
      push({
        heading: cleanTitle(s.section.title) || 'Parte',
        section: s.section.title,
        parts: [
          { heading: 'Explicação', items: ideas },
          { heading: 'Conceitos', items: definitions([s], depth === 'completo' ? 4 : 2) },
          { heading: 'Exemplos', items: examples },
          { heading: 'Versículos', items: s.references.slice(0, depth === 'completo' ? 4 : 2).map((x) => x.label) },
          { heading: 'Como se liga ao todo', text: turn && !ideas.some((x) => sameIdea(x, turn.turn)) ? turn.turn : '' },
        ].filter((b) => b.text || b.items?.length),
      });
    }
    push({ heading: 'Conclusão', items: applications.slice(0, 3) });
  }

  if (mode === 'analitico') {
    push({ heading: 'Tese principal', text: brief.thesis });
    push({ heading: 'Estrutura argumentativa', items: brief.steps.map((st, i) => `${i + 1}. ${st.title}${st.explanation ? ` — ${st.explanation}` : ''}`).slice(0, depth === 'breve' ? 6 : 40) });
    push({
      heading: 'Fundamentos (versículos mais citados)',
      items: r.references.slice(0, n).map((x) => `${x.label}${x.count > 1 ? ` (citado ${x.count} vezes)` : ''}`),
    });
    push({ heading: 'Pressupostos e conceitos', items: definitions(sections, n) });
    push({ heading: 'Implicações', items: applications });
    push({
      heading: 'Pontos fortes e limitações',
      text: 'A avaliação crítica (pontos fortes, limitações e questões em aberto) precisa de interpretação: toque em “Gerar com IA”.',
    });
  }

  if (mode === 'capitulos') {
    const drafts = suggestActions(material);
    for (const s of sections) {
      const good = goodSentences(s, keys);
      const central = good[0]?.text;
      const args = distinct(good.slice(1).map((p) => concise(p.text, 35)), depth === 'breve' ? 1 : depth === 'normal' ? 3 : 5, central ? [central] : []);
      const examples = distinct(sectionSentences(s).filter((x) => EXAMPLE.test(x)).map((x) => concise(x, 35)), depth === 'completo' ? 2 : 1, args);
      const apps = distinct(drafts.filter((a) => a.sectionId === s.section.id).map((a) => concise(a.text)), depth === 'breve' ? 1 : 3);
      const end = lastStrong(s);
      push({
        heading: cleanTitle(s.section.title) || 'Parte',
        section: s.section.title,
        parts: [
          { heading: 'Ideia central', text: central ? concise(central, 35) : '' },
          { heading: 'Conceitos', items: definitions([s], depth === 'breve' ? 2 : 4) },
          { heading: 'Argumentos', items: args },
          { heading: 'Exemplos', items: examples },
          { heading: 'Aplicações', items: apps },
          { heading: 'Conclusão', text: end && end !== central && !args.some((x) => sameIdea(x, end)) ? concise(end, 35) : '' },
        ].filter((b) => b.text || b.items?.length),
      });
    }
  }

  return { mode, kind: 'biblico', depth, blocks: dedupeBlocks(blocks), source: 'regras', createdAt: now() };
}

/* ---------------------------------- IA ---------------------------------- */

const KIND_METHOD: Record<StudyKind, string> = {
  biblico: 'estudo bíblico e teológico: linguagem reverente e clara, fiel às Escrituras citadas no material, com aplicação para a vida cristã e a igreja',
  didatico: 'material didático: linguagem simples, passo a passo, com exemplos que ajudam a ensinar',
  academico: 'estudo acadêmico: linguagem formal e precisa, conceitos definidos, argumentos e conclusões bem delimitados',
  profissional: 'uso profissional: objetivo, prático, focado em decisões e resultados',
  treinamento: 'formação e treinamento: objetivos de aprendizagem claros, etapas e prática',
  pessoal: 'desenvolvimento pessoal: linguagem próxima, reflexiva, com passos de mudança concretos',
  tecnico: 'estudo técnico: terminologia precisa, processos e critérios bem explicados',
};

const DEPTH_TEXT: Record<SummaryDepth, string> = {
  breve: 'BREVE: só o essencial, listas de até 3 itens, frases curtas',
  normal: 'NORMAL: listas de até 5 itens',
  completo: 'COMPLETO: mais detalhe, listas de até 8 itens, explicações de 2 a 3 frases quando necessário',
};

/** O pedido próprio de cada modalidade (item 11: nada de um prompt genérico para tudo). */
const MODE_PROMPT: Record<SummaryMode, string> = {
  estudo:
    'ESTUDO COMPLETO, na estrutura preferida do autor. Blocos, nesta ordem: "Ideia central" (texto: a mensagem principal); "Contextualização" (texto: situe o leitor no assunto); "Desenvolvimento" (itens: os principais argumentos e conceitos, na sequência do material); "Princípios fundamentais" (itens: os ensinamentos essenciais); "Conexões e aprofundamentos" (itens: relações bíblicas e entre ideias); "Aplicações práticas" (itens começando por verbo); "Síntese final" (texto: consolide sem repetir todo o conteúdo). Omita o bloco que o material não sustentar.',
  executivo:
    'RESUMO EXECUTIVO. Blocos, nesta ordem: "Tema central" (texto, 1 frase); "Objetivo do autor" (texto, 1 frase); "Ideias principais" (itens); "Conclusão" (texto); "Aplicação prática" (itens começando por verbo).',
  essencial:
    'RESUMO ESSENCIAL. Elimine o secundário sem perder o sentido. Blocos: "Ideia central" (texto); "Conceitos indispensáveis" (itens "Termo: definição"); "Uma frase por parte" (itens "Título da parte: frase").',
  aprofundado:
    'RESUMO APROFUNDADO. Um bloco "Tese" (texto). Depois UM bloco para CADA parte do material (cada "##"), na ordem, com "titulo" = título da parte, "secao" = título exato, e "partes": "Explicação" (itens), "Argumentos do autor" (itens), "Exemplos" (itens, só os do material), "Conceitos" (itens "Termo: definição"), "Relação com as outras partes" (texto). No fim, um bloco "Conclusões" (itens).',
  analitico:
    'RESUMO ANALÍTICO. Blocos: "Tese principal" (texto); "Estrutura argumentativa" (itens, na ordem do raciocínio); "Pressupostos" (itens); "Fundamentos" (itens, com as referências do material); "Implicações" (itens); "Pontos fortes" (itens); "Limitações e questões críticas" (itens). Pontos fortes e limitações são avaliação SUA: escreva-os com cuidado e respeito ao autor.',
  capitulos:
    'RESUMO POR CAPÍTULO. Respeite rigorosamente a organização do material: UM bloco para CADA parte (cada "##"), na ordem, com "titulo" = título da parte, "secao" = título exato, e "partes": "Objetivo" (texto), "Ideia central" (texto), "Conceitos" (itens), "Argumentos" (itens), "Exemplos" (itens, só os do material), "Aplicações" (itens), "Conclusão" (texto).',
};

const ORIGEM = { type: 'STRING', enum: ['texto', 'ia', 'fe'] };
const PART = { type: 'OBJECT', properties: { titulo: { type: 'STRING' }, texto: { type: 'STRING' }, itens: { type: 'ARRAY', items: { type: 'STRING' } }, origem: ORIGEM }, required: ['titulo'] };
const MODE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    blocos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { titulo: { type: 'STRING' }, texto: { type: 'STRING' }, itens: { type: 'ARRAY', items: { type: 'STRING' } }, secao: { type: 'STRING' }, partes: { type: 'ARRAY', items: PART }, origem: ORIGEM },
        required: ['titulo'],
      },
    },
  },
  required: ['blocos'],
};

const MAX_CHARS = 1_500_000;

export function buildModePrompt(material: Material, mode: SummaryMode, kind: StudyKind, depth: SummaryDepth, voice = ''): string {
  const text = material.sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n').slice(0, MAX_CHARS);
  return [
    `Você é um especialista em ${KIND_METHOD[kind]}. Leia o material “${material.title}”${material.author ? `, de ${material.author}` : ''} e escreva, em português do Brasil, o resumo pedido abaixo.`,
    '',
    MODE_PROMPT[mode],
    `Profundidade: ${DEPTH_TEXT[depth]}.`,
    '',
    'Regras de fidelidade:',
    '- Use SOMENTE o material como fonte. Não invente fatos, exemplos, citações, autores nem referências bíblicas que não estejam nele.',
    '- Mantenha as distinções importantes do autor (condições, ressalvas, exceções). Resumir não é cortar o sentido.',
    '- Não repita a mesma ideia em blocos diferentes, nem com outras palavras.',
    '- Frases completas e claras. Nunca use reticências nem corte frases. Se o material não trouxer algo, deixe o bloco vazio em vez de inventar.',
    `- "origem" de cada bloco e parte: ${ORIGIN_RULE}`,
    ...(voice ? [voice] : []),
    '',
    'MATERIAL:',
    text,
  ].join('\n');
}

const clean = (v: unknown) => String(v ?? '').replace(/…|\.{3,}/g, '').trim();
const list = (v: unknown) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);

export function parseModeAnswer(raw: string): ModeBlock[] {
  let d: { blocos?: unknown };
  try {
    d = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
  } catch {
    throw new Error('A IA respondeu num formato inesperado. Tente de novo.');
  }
  const toBlock = (b: Record<string, unknown>): ModeBlock => ({
    heading: clean(b.titulo),
    origin: b.origem === 'texto' || b.origem === 'ia' || b.origem === 'fe' ? b.origem : undefined,
    // sem as muletas de texto automático; títulos e seções ficam como vieram
    text: humanize(clean(b.texto)) || undefined,
    items: list(b.itens).length ? list(b.itens).map(humanize) : undefined,
    section: clean(b.secao) || undefined,
    parts: Array.isArray(b.partes) ? (b.partes as Array<Record<string, unknown>>).map(toBlock).filter((p) => p.heading && (p.text || p.items?.length)) : undefined,
  });
  const blocks = (Array.isArray(d.blocos) ? (d.blocos as Array<Record<string, unknown>>) : []).map(toBlock).filter((b) => b.heading && (b.text || b.items?.length || b.parts?.length));
  if (!blocks.length) throw new Error('A IA não devolveu o resumo. Tente de novo.');
  return blocks;
}

export async function buildModeWithAi(
  material: Material,
  mode: SummaryMode,
  kind: StudyKind,
  depth: SummaryDepth,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ModeSummary> {
  if (!material.sections.some((s) => s.text.trim())) throw new Error('Não há texto para resumir.');
  const prompt = buildModePrompt(material, mode, kind, depth, await voicePrompt());
  let model = '';
  const blocks = await withModel(opts, (config) => {
    model = config.model;
    return callGemini(prompt, config, MODE_SCHEMA, opts).then((raw) => dedupeBlocks(parseModeAnswer(raw)));
  });
  return { mode, kind, depth, blocks, source: 'ia', model, createdAt: now() };
}

export async function saveModeSummary(materialId: string, summary: ModeSummary | null, key: string): Promise<void> {
  const m = await db.materials.get(materialId);
  if (!m) return;
  const summaries = { ...(m.summaries ?? {}) };
  if (summary) summaries[key] = summary;
  else delete summaries[key];
  await db.materials.put({ ...m, summaries });
}

/* ------------------------------- exportação ------------------------------- */

export function modeMarkdown(title: string, s: ModeSummary): string {
  const out = [`# ${title} — ${s.mode === 'estudo' ? MODE_LABEL.estudo : `Resumo ${MODE_LABEL[s.mode].toLowerCase()}`}`, ''];
  if (s.source === 'ia') out.push(`_Feito pela IA (${s.model ?? 'Gemini'}) · ${KIND_LABEL[s.kind]} · ${DEPTH_LABEL[s.depth]}. Revise antes de usar._`, '');
  const write = (b: ModeBlock, level: number) => {
    out.push(`${'#'.repeat(level)} ${b.heading}${b.origin ? ` _(${ORIGIN_NAME[b.origin]})_` : ''}`, '');
    if (b.text) out.push(b.text, '');
    if (b.items?.length) out.push(...b.items.map((x) => `- ${x}`), '');
    for (const p of b.parts ?? []) write(p, level + 1);
  };
  for (const b of s.blocks) write(b, 2);
  return out.join('\n');
}

const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Documento do Word (HTML que o Word abre e salva como .docx), como o do estudo. */
export function modeWordHtml(title: string, author: string, s: ModeSummary): string {
  const write = (b: ModeBlock, level: number): string =>
    `<h${level}>${esc(b.heading)}${b.origin ? ` <span class="sub">(${ORIGIN_NAME[b.origin]})</span>` : ''}</h${level}>${b.text ? `<p>${esc(b.text)}</p>` : ''}${b.items?.length ? `<ul>${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${(b.parts ?? []).map((p) => write(p, Math.min(level + 1, 4))).join('')}`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2430;line-height:1.45}h1{font-size:20pt;margin:0}h2{font-size:14pt;color:#1f3a5f;border-bottom:1px solid #c9ced8;padding-bottom:3pt;margin-top:16pt}h3{font-size:12pt;margin:10pt 0 4pt}h4{font-size:11pt;margin:8pt 0 2pt}.sub{color:#5b6270}</style></head><body>
<h1>${esc(title)}</h1><p class="sub">${s.mode === 'estudo' ? MODE_LABEL.estudo : `Resumo ${esc(MODE_LABEL[s.mode].toLowerCase())}`}${author ? ` · ${esc(author)}` : ''}${s.source === 'ia' ? ` · feito pela IA (${esc(s.model ?? 'Gemini')}), ${esc(KIND_LABEL[s.kind].toLowerCase())}` : ' · frases do próprio texto'}</p>
${s.blocks.map((b) => write(b, 2)).join('\n')}
</body></html>`;
}
