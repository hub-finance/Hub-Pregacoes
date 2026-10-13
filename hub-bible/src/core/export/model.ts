import type { ExportEdition, ExportLayout, ExportStructure, SermonBlock } from '../db/types';
import { parseBlockHtml, plainOf, splitLines, textRuns, tidy, type Para, type Run } from './inline';
import { resolveTheme, type ExportTheme } from './themes';

/**
 * A forma intermediária do documento.
 *
 * Os três geradores (Word, PDF e Markdown) partem desta mesma lista de nós.
 * É isso que garante que o .docx e o .pdf de uma versão tenham o mesmo
 * conteúdo: a decisão do que entra e em que ordem é tomada uma vez, aqui.
 */

export type RenderNode =
  | { t: 'heading'; level: 1 | 2; text: string; pageBreak: boolean }
  | { t: 'para'; runs: Para }
  | { t: 'highlight'; paras: Para[] }
  | { t: 'quote'; paras: Para[]; reference?: string }
  | { t: 'list'; ordered: boolean; items: Para[] }
  | { t: 'table'; rows: string[][] };

export interface RenderDoc {
  title: string;
  layout: ExportLayout;
  theme: ExportTheme;
  nodes: RenderNode[];
}

export interface RenderInput {
  title: string;
  content: SermonBlock[];
  structure: ExportStructure;
  layout: ExportLayout;
}

/** Linha de tabela escrita como `| a | b |`. */
const TABLE_LINE = /^\s*\|.*\|\s*$/;
/** Linha separadora do cabeçalho da tabela (`|---|:---:|`). */
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/**
 * Tabelas são escritas no próprio texto, uma linha por linha da tabela, com as
 * células separadas por `|`. É o jeito mais simples de montar uma tabela num
 * campo de texto — e o mesmo que o Markdown usa, então a tabela atravessa os
 * três formatos sem mudar.
 */
export function tableFrom(runs: Para): string[][] | null {
  const lines = splitLines(runs).map((line) => plainOf(line).trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every((l) => TABLE_LINE.test(l))) return null;
  const rows = lines
    .filter((l) => !TABLE_RULE.test(l))
    .map((l) =>
      l
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map((c) => c.trim()),
    );
  if (!rows.length) return null;
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
}

/** Parágrafos de um bloco, separando listas e tabelas do texto corrido. */
function nodesFromHtml(html: string): RenderNode[] {
  const nodes: RenderNode[] = [];
  for (const segment of parseBlockHtml(html)) {
    if (segment.kind === 'list') {
      nodes.push({ t: 'list', ordered: segment.ordered, items: segment.items });
      continue;
    }
    const table = tableFrom(segment.runs);
    if (table) nodes.push({ t: 'table', rows: table });
    else nodes.push({ t: 'para', runs: segment.runs });
  }
  return nodes;
}

/** Junta tudo de um bloco num só grupo de parágrafos (quadros e citações). */
function parasFromHtml(html: string): Para[] {
  const paras: Para[] = [];
  for (const segment of parseBlockHtml(html)) {
    if (segment.kind === 'para') paras.push(segment.runs);
    else {
      segment.items.forEach((item, i) => {
        paras.push([{ text: segment.ordered ? `${i + 1}. ` : '• ' }, ...item]);
      });
    }
  }
  return paras;
}

/**
 * O conteúdo de cada versão. A do participante deixa de fora as seções
 * marcadas como "só instrutor" e tudo o que vem abaixo delas — até a próxima
 * seção do mesmo nível ou de nível acima. A do instrutor é o documento inteiro.
 */
export function contentForEdition(content: SermonBlock[], structure: ExportStructure, edition?: ExportEdition): SermonBlock[] {
  const hidden = new Set(structure.instructorOnly ?? []);
  if (edition !== 'participante' || !hidden.size) return content;
  const sub = new Set(structure.subheadings);
  const out: SermonBlock[] = [];
  /** Nível da seção que está sendo pulada (1 ou 2), ou 0 quando nada é pulado. */
  let skipping = 0;
  for (const block of content) {
    if (block.type === 'section') {
      const level = sub.has(block.id) ? 2 : 1;
      if (skipping && level <= skipping) skipping = 0;
      if (!skipping && hidden.has(block.id)) skipping = level;
    }
    if (!skipping) out.push(block);
  }
  return out;
}

/** Há divisão entre material do instrutor e do participante? */
export const hasEditions = (structure: ExportStructure) => (structure.instructorOnly ?? []).length > 0;

export function buildRenderDoc(input: RenderInput): RenderDoc {
  const { layout, structure } = input;
  const theme = resolveTheme(layout.theme, layout.accentColor);
  const breaks = new Set(structure.pageBreaks);
  const subheadings = new Set(structure.subheadings);
  const nodes: RenderNode[] = [];

  for (const block of input.content) {
    switch (block.type) {
      case 'section': {
        const text = plainOf(tidy(parasFromHtml(block.html).flat())).replace(/\s*\n\s*/g, ' ').trim();
        if (!text) break;
        const level: 1 | 2 = subheadings.has(block.id) ? 2 : 1;
        nodes.push({
          t: 'heading',
          level,
          text,
          pageBreak: breaks.has(block.id) || (layout.breakBeforeSections && level === 1),
        });
        break;
      }
      case 'highlight': {
        const paras = parasFromHtml(block.html);
        if (paras.length) nodes.push({ t: 'highlight', paras });
        break;
      }
      case 'scripture': {
        const paras = parasFromHtml(block.html);
        const reference = block.reference?.trim() || undefined;
        if (paras.length || reference) nodes.push({ t: 'quote', paras, reference });
        break;
      }
      case 'list': {
        const listNodes = nodesFromHtml(block.html);
        // lista escrita sem marcação de itens: cada linha vira um item
        for (const node of listNodes) {
          if (node.t === 'para') {
            const items = splitLines(node.runs).map(tidy).filter((l) => l.length);
            if (items.length) nodes.push({ t: 'list', ordered: false, items });
          } else nodes.push(node);
        }
        break;
      }
      default:
        nodes.push(...nodesFromHtml(block.html));
    }
  }

  // A primeira coisa do documento nunca abre com página nova: depois da capa
  // ou do sumário ela já está no começo da folha, e a quebra criaria uma página
  // em branco.
  const first = nodes[0];
  if (first?.t === 'heading') first.pageBreak = false;

  return { title: input.title.trim() || 'Documento sem título', layout, theme, nodes };
}

/** Linha de identificação sob o título, quando não há capa. */
export function metaLine(layout: ExportLayout): string {
  return [layout.author, layout.institution, layout.dateLabel].map((s) => s.trim()).filter(Boolean).join(' · ');
}

/** Títulos que entram no sumário. */
export const tocEntries = (doc: RenderDoc) =>
  doc.nodes.filter((n): n is Extract<RenderNode, { t: 'heading' }> => n.t === 'heading');

/** Quantidade de linhas do espaço para anotações. */
export const NOTES_LINES = 10;

export { textRuns, type Para, type Run };
