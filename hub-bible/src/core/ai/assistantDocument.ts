/**
 * O trabalho que nasce de uma conversa do assistente bíblico: um estudo
 * sistemático, uma mensagem ou um resumo.
 *
 * A IA redige o texto inteiro, corrido, e o pregador edita num campo só. O
 * documento sai daqui em PDF ou Word pelo mesmo gerador do Gerar e Exportar,
 * ou segue para o Gerador (mensagem), para o Rhema (estudo) ou para o próprio
 * Gerar e Exportar, onde ganha capa, tema e sumário.
 */

import { db, now, uid } from '../db/db';
import { escapeHtml } from '../backup';
import type { ExportCategory, ExportFormat, ExportLayout, SermonBlock, StudySection } from '../db/types';
import { newBlock } from '../data/sermonContent';
import { newSermon, newStudy, saveDoc } from '../data/documents';
import { createExportDoc, getPreferredLayout, normalizeLayout } from '../data/exportDocs';
import { BASE_LAYOUT } from '../export/templates';
import { buildRenderDoc } from '../export/model';
import { renderBlob } from '../export/generate';
import { getMeta, getVerses } from '../bible/repository';
import { formatReference, parseReference } from '../bible/reference';
import type { AssistantMessage } from './assistant';

/* ───────────────────────────── objetivos ───────────────────────────── */

export type AssistantGoal = 'livre' | 'estudo' | 'mensagem' | 'resumo';

export const GOAL_LABEL: Record<AssistantGoal, string> = {
  livre: 'Pergunta livre',
  estudo: 'Estudo sistemático',
  mensagem: 'Mensagem',
  resumo: 'Resumo',
};

/** "Título do estudo", "Título da mensagem". */
export const GOAL_TITLE_LABEL: Record<AssistantGoal, string> = {
  livre: 'Título do estudo',
  estudo: 'Título do estudo',
  mensagem: 'Título da mensagem',
  resumo: 'Título do resumo',
};

/** O que o objetivo pede da IA, conforme o Prompt Mestre (seção 16). */
export const GOAL_HINT: Record<AssistantGoal, string> = {
  livre: '',
  estudo:
    'OBJETIVO DO TRABALHO: estudo sistemático. O pregador está construindo um estudo que será exportado. ' +
    'Construa a doutrina a partir de vários textos e da teologia bíblica, seguindo a hierarquia de interpretação. ' +
    'Organize em seções com títulos "## " claros (por exemplo: texto e contexto, palavras no original, desenvolvimento doutrinário, relação com Cristo e a Nova Aliança, aplicação), ' +
    'com as partes ligadas umas às outras: o estudo é um argumento só.',
  mensagem:
    'OBJETIVO DO TRABALHO: mensagem (pregação). O pregador está construindo uma mensagem que será exportada; ele continua sendo o autor. ' +
    'Priorize estrutura homilética: texto principal, introdução, pontos com argumento bíblico, explicação e aplicação, transições, conclusão e apelo quando couber. ' +
    'Use títulos "## " para cada parte e transições que liguem uma parte à seguinte.',
  resumo:
    'OBJETIVO DO TRABALHO: resumo. Condense o essencial em poucos pontos bem escolhidos, com títulos "## " curtos e as referências que sustentam cada ponto. ' +
    'Qualidade, não quantidade.',
};

/* ───────────────────────────── documento ───────────────────────────── */

/**
 * Um texto só, corrido, em Markdown simples: o pregador pediu que as partes
 * não fiquem soltas — introdução, pontos e conclusão formam um argumento.
 */
export interface AssistantDocument {
  title: string;
  goal: AssistantGoal;
  text: string;
  /** Versão anterior, para desfazer a última mudança da IA. */
  previousText?: string;
  /** Referências do texto conferidas na tradução em uso. */
  validRefs: string[];
  /** Acrescenta ao fim os versículos citados, com o texto da tradução em uso. */
  includeVerses: boolean;
  /** Feito sem IA: as respostas juntas, para o pregador costurar. */
  manual?: boolean;
  updatedAt: number;
}

/** De uma pergunta livre, o que se leva para fora é um estudo. */
export const documentGoal = (goal: AssistantGoal): AssistantGoal => (goal === 'livre' ? 'estudo' : goal);

/** Tira a linha "# Título" do começo do texto da IA e devolve as duas partes. */
export function splitTitle(text: string): { title: string; body: string } {
  const m = /^\s*#\s+(.+?)\s*#*\s*\n/.exec(text);
  if (!m) return { title: '', body: text.trim() };
  return { title: m[1].replace(/\*\*/g, '').trim(), body: text.slice(m[0].length).trim() };
}

/** Aviso que abre cada estudo montado sem IA — no documento, fica uma vez só. */
const ENGINE_NOTE = /^\*Montado com os dados do seu aparelho[^\n]*\*\s*$/m;

/** Sem IA: as respostas da conversa, na ordem, num texto só. */
export function documentFromAnswers(title: string, goal: AssistantGoal, messages: AssistantMessage[]): AssistantDocument {
  const answers = messages.filter((m) => m.role === 'assistant');
  const first = splitTitle(answers[0]?.content ?? '');
  const parts = answers.map((m, i) => {
    const { title: t, body } = splitTitle(m.content);
    const clean = body.replace(ENGINE_NOTE, '').trim();
    // a primeira resposta dá o título; as seguintes viram partes do mesmo texto
    return i === 0 ? clean : `${t ? `## ${t}\n\n` : ''}${clean}`;
  });
  return {
    title: first.title || title || GOAL_LABEL[documentGoal(goal)],
    goal: documentGoal(goal),
    text: parts.join('\n\n'),
    validRefs: [...new Set(answers.flatMap((m) => m.validRefs ?? []))],
    includeVerses: false,
    manual: true,
    updatedAt: now(),
  };
}

/* ─────────────────────── markdown → blocos do app ─────────────────────── */

/** Negrito e itálico viram marcação; referências perdem os colchetes. */
/**
 * As fontes dos arquivos não têm letras hebraicas nem gregas (sairiam como
 * quadradinhos): no arquivo fica a transliteração, que vem sempre junto.
 */
const ORIGINAL_SCRIPT = /[\u0590-\u05FF\uFB1D-\uFB4F\u0370-\u03FF\u1F00-\u1FFF]+[\u0590-\u05FF\u0370-\u03FF\u1F00-\u1FFF\s\u0300-\u036F]*/g;
const withoutOriginalScript = (text: string) =>
  text.replace(ORIGINAL_SCRIPT, '').replace(/\*\*\s*\*\*\s*/g, '').replace(/\(\s*\)/g, '').replace(/ {2,}/g, ' ');

function inlineHtml(text: string): string {
  return escapeHtml(withoutOriginalScript(text).replace(/\[([^\]]+)\]/g, '$1'))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

function markdownToBlocks(text: string, subheadings: string[]): SermonBlock[] {
  const blocks: SermonBlock[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(newBlock('text', `<p>${inlineHtml(para.join(' '))}</p>`));
    para = [];
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? 'ol' : 'ul';
      blocks.push(newBlock('list', `<${tag}>${list.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${tag}>`));
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push(newBlock('highlight', `<p>${inlineHtml(quote.join(' '))}</p>`));
    quote = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    let m: RegExpExecArray | null;
    if (!line) { flushAll(); continue; }
    if ((m = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line))) {
      flushAll();
      const block = newBlock('section', escapeHtml(m[2].replace(/\*\*/g, '')));
      if (m[1].length >= 3) subheadings.push(block.id);
      blocks.push(block);
    } else if (/^([-*_]\s*){3,}$/.test(line)) {
      flushAll();
    } else if ((m = /^(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line))) {
      flushPara(); flushQuote();
      const ordered = !!m[1];
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(m[2]);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara(); flushList();
      quote.push(m[1]);
    } else {
      flushList(); flushQuote();
      para.push(line);
    }
  }
  flushAll();
  return blocks;
}

/** Referências citadas no texto, na ordem em que aparecem. */
function citedReferences(text: string, valid: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(/\[([^\]]+)\]/g)) {
    const ref = m[1].trim();
    if (!valid.has(ref) || seen.has(ref)) continue;
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

export interface DocumentContent {
  blocks: SermonBlock[];
  subheadings: string[];
}

/** O documento nos blocos do app — os mesmos do Gerador e do Gerar e Exportar. */
export async function documentContent(
  doc: AssistantDocument,
  messages: AssistantMessage[],
  translation: string,
): Promise<DocumentContent> {
  const subheadings: string[] = [];
  // o arquivo é do pregador: sem faixa "Preparado com…" no alto (pedido dele).
  // Dentro do app, cada resposta continua com o selo "Comentário da IA".
  const blocks: SermonBlock[] = [];
  blocks.push(...markdownToBlocks(splitTitle(doc.text).body || doc.text, subheadings));

  if (doc.includeVerses) {
    const valid = new Set([...doc.validRefs, ...messages.flatMap((m) => m.validRefs ?? [])]);
    const refs = citedReferences(doc.text, valid).slice(0, 40);
    const quotes: SermonBlock[] = [];
    const meta = await getMeta(translation).catch(() => null);
    const label = meta?.shortName ?? meta?.name ?? translation;
    for (const ref of refs) {
      const parsed = parseReference(ref);
      if (!parsed) continue;
      const rows = await getVerses({
        translation,
        book: parsed.book,
        chapter: parsed.chapter,
        verse: parsed.verse ?? 1,
        verseEnd: parsed.verse ? parsed.verseEnd : undefined,
      }).catch(() => []);
      if (!rows.length) continue;
      const text = rows.length === 1 ? rows[0].text : rows.map((r) => `${r.verse} ${r.text}`).join(' ');
      const block = newBlock('scripture', `<p>${escapeHtml(text)}</p>`);
      block.reference = `${formatReference(parsed)} (${label})`;
      quotes.push(block);
    }
    if (quotes.length) blocks.push(newBlock('section', 'Textos bíblicos citados'), ...quotes);
  }
  return { blocks, subheadings };
}

/* ─────────────────────────────── saídas ─────────────────────────────── */

const fileBase = (title: string) =>
  title
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim() || 'Documento';

export async function exportDocument(
  doc: AssistantDocument,
  messages: AssistantMessage[],
  translation: string,
  format: ExportFormat,
  author: string,
): Promise<{ blob: Blob; filename: string }> {
  const { blocks, subheadings } = await documentContent(doc, messages, translation);
  const preferred = await getPreferredLayout().catch(() => null);
  const layout: ExportLayout = normalizeLayout({
    ...BASE_LAYOUT,
    ...(preferred ?? {}),
    cover: false,
    toc: false,
    subtitle: GOAL_LABEL[doc.goal],
    author: preferred?.author || author,
    dateLabel: new Date().toLocaleDateString('pt-BR'),
  });
  const render = buildRenderDoc({
    title: doc.title,
    content: blocks,
    structure: { pageBreaks: [], subheadings, instructorOnly: [] },
    layout,
  });
  try {
    const blob = await renderBlob(render, format);
    return { blob, filename: `${fileBase(doc.title)}.${format}` };
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    if (/fetch|network|Fonte/i.test(message)) {
      throw new Error('Não foi possível carregar as fontes do PDF. Abra o app com internet uma vez para que ele as guarde.');
    }
    throw new Error(`Não foi possível gerar o arquivo: ${message}`);
  }
}

const plainText = (text: string) =>
  text
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/\[([^\]]+)\]/g, '$1')
    .trim();

/** Vira uma mensagem no Gerador, já em blocos. Devolve o id. */
export async function sendToSermon(doc: AssistantDocument, messages: AssistantMessage[], translation: string): Promise<string> {
  const { blocks } = await documentContent(doc, messages, translation);
  const sermon = { ...newSermon(), title: doc.title, content: blocks, tags: ['assistente'] };
  await saveDoc('sermon', sermon);
  return sermon.id;
}

/** Vira um estudo no Rhema: uma seção livre por parte "## ". Devolve o id. */
export async function sendToStudy(doc: AssistantDocument): Promise<string> {
  const sections: StudySection[] = [];
  let title = 'Introdução';
  let lines: string[] = [];
  const push = () => {
    const text = plainText(lines.join('\n'));
    if (text) sections.push({ id: uid('sec_'), kind: 'livre', title, text });
    lines = [];
  };
  for (const line of (splitTitle(doc.text).body || doc.text).split('\n')) {
    const m = /^\s{0,3}#{1,2}\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) { push(); title = m[1].replace(/\*\*/g, ''); } else lines.push(line);
  }
  push();
  const study = { ...newStudy(), title: doc.title, sections, tags: ['assistente'] };
  await saveDoc('study', study);
  return study.id;
}

/** Abre no Gerar e Exportar, para escolher capa, tema e sumário. Devolve o id. */
export async function sendToExport(doc: AssistantDocument, messages: AssistantMessage[], translation: string): Promise<string> {
  const { blocks, subheadings } = await documentContent(doc, messages, translation);
  const [category, model]: [ExportCategory, string] = doc.goal === 'mensagem'
    ? ['pregacao', 'mensagem-completa']
    : ['estudo', 'tematico'];
  const created = await createExportDoc({ category, model, sourceKind: 'blank', title: doc.title });
  const structure = { pageBreaks: [], subheadings, instructorOnly: [] };
  await db.exportDocs.update(created.id, {
    content: blocks,
    original: blocks.map((b) => ({ ...b })),
    structure,
    originalStructure: { ...structure, subheadings: [...subheadings] },
    updatedAt: now(),
  });
  return created.id;
}
