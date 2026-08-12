import { uid } from '../db/db';
import { escapeHtml } from '../backup';
import type { Sermon, SermonBlock, SermonBlockType } from '../db/types';

/**
 * O sermão montado dentro do aplicativo.
 *
 * A referência é o sermão que o pastor já escreve no Word: um título, seções
 * com subtítulo, parágrafos justificados, um ou outro quadro de destaque e as
 * citações bíblicas separadas do corpo. Cada uma dessas coisas é um bloco, e a
 * ordem dos blocos é a ordem da mensagem — dá para inserir, mover e trocar o
 * tipo de qualquer um deles sem reescrever o resto.
 *
 * O conteúdo de cada bloco é HTML porque a formatação de dentro do parágrafo
 * (negrito, itálico, sublinhado, cor) é parte do que o autor quis dizer.
 */

export const BLOCK_LABEL: Record<SermonBlockType, string> = {
  section: 'Seção',
  text: 'Parágrafo',
  highlight: 'Destaque',
  scripture: 'Citação bíblica',
  list: 'Lista',
};

export function newBlock(type: SermonBlockType = 'text', html = ''): SermonBlock {
  return {
    id: uid('blc_'),
    type,
    // a lista já nasce com o primeiro item, senão o campo abre vazio e o
    // usuário digita fora da marcação
    html: html || (type === 'list' ? '<ul><li><br></li></ul>' : ''),
    ...(type === 'scripture' ? { reference: '' } : {}),
  };
}

/** Texto puro de um HTML, sem depender do DOM (serve para busca e exportação). */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<\/(p|div|li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/ /g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texto puro vira HTML de bloco: linhas em branco separam parágrafos. */
const textToHtml = (value: string): string =>
  escapeHtml(value.trim()).replace(/\n/g, '<br>');

export const isBlockEmpty = (block: SermonBlock): boolean =>
  !htmlToPlain(block.html) && !block.reference?.trim();

/**
 * Primeira abertura de um sermão antigo: o que estava nos quatro campos vira
 * blocos, sem perder uma linha. Cada parágrafo separado por linha em branco
 * vira um bloco próprio, que é como o texto será pregado depois.
 */
export function blocksFromSermon(doc: Sermon): SermonBlock[] {
  const blocks: SermonBlock[] = [];

  const addSection = (title: string, body: string) => {
    const parts = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    blocks.push(newBlock('section', escapeHtml(title)));
    parts.forEach((part) => blocks.push(newBlock('text', textToHtml(part))));
  };

  addSection('Introdução', doc.introduction ?? '');
  addSection('Desenvolvimento', doc.development ?? '');
  addSection('Conclusão', doc.conclusion ?? '');
  addSection('Aplicação', doc.application ?? '');

  // sermão em branco começa com o esqueleto na tela, não com uma folha vazia
  if (!blocks.length) {
    return ['Introdução', 'Desenvolvimento', 'Conclusão', 'Aplicação'].flatMap((title) => [
      newBlock('section', title),
      newBlock('text'),
    ]);
  }
  return blocks;
}

/* ------------------------------- exportação ------------------------------ */

export function blocksToText(blocks: SermonBlock[]): string {
  return blocks
    .filter((b) => !isBlockEmpty(b))
    .map((b) => {
      const text = htmlToPlain(b.html);
      if (b.type === 'scripture') return [text, b.reference && `— ${b.reference}`].filter(Boolean).join('\n');
      return text;
    })
    .join('\n\n');
}

export function blocksToMarkdown(blocks: SermonBlock[]): string {
  return blocks
    .filter((b) => !isBlockEmpty(b))
    .map((b) => {
      const text = htmlToPlain(b.html);
      switch (b.type) {
        case 'section':
          return `## ${text}`;
        case 'highlight':
          return text
            .split('\n')
            .map((line) => `> **${line}**`)
            .join('\n');
        case 'scripture':
          return [
            ...text.split('\n').map((line) => `> ${line}`),
            b.reference ? `> — *${b.reference}*` : '',
          ]
            .filter(Boolean)
            .join('\n');
        case 'list':
          return text
            .split('\n')
            .filter(Boolean)
            .map((line) => `- ${line}`)
            .join('\n');
        default:
          return text;
      }
    })
    .join('\n\n');
}

/**
 * HTML para impressão e PDF. As classes são as mesmas usadas na tela, e a
 * folha de estilo da impressão (em `core/backup.ts`) as reproduz — o sermão
 * sai no papel parecido com o que se vê ao escrever.
 */
export function blocksToHtml(blocks: SermonBlock[]): string {
  return blocks
    .filter((b) => !isBlockEmpty(b))
    .map((b) => {
      switch (b.type) {
        case 'section':
          return `<h2 class="s-section">${b.html}</h2>`;
        case 'highlight':
          return `<div class="s-highlight">${b.html}</div>`;
        case 'scripture':
          return `<blockquote class="s-scripture">${b.html}${
            b.reference ? `<cite>${escapeHtml(b.reference)}</cite>` : ''
          }</blockquote>`;
        case 'list':
          return `<div class="s-list">${b.html}</div>`;
        default:
          return `<p class="s-text">${b.html}</p>`;
      }
    })
    .join('');
}

/* ------------------------------- pregação -------------------------------- */

export interface SermonPart {
  title: string;
  blocks: SermonBlock[];
}

/**
 * Agrupa os blocos por seção para o Modo Pregação: cada subtítulo abre um
 * passo, e o que vem depois dele acompanha esse passo até o próximo subtítulo.
 */
export function groupBlocks(blocks: SermonBlock[]): SermonPart[] {
  const parts: SermonPart[] = [];
  let current: SermonPart | null = null;

  for (const block of blocks) {
    if (isBlockEmpty(block)) continue;
    if (block.type === 'section') {
      current = { title: htmlToPlain(block.html), blocks: [] };
      parts.push(current);
      continue;
    }
    if (!current) {
      current = { title: '', blocks: [] };
      parts.push(current);
    }
    current.blocks.push(block);
  }

  return parts.filter((p) => p.title || p.blocks.length);
}
