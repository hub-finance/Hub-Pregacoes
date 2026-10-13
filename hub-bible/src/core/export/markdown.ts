import type { Para } from './inline';
import { metaLine, NOTES_LINES, type RenderDoc } from './model';

/**
 * Gerador de Markdown — o mesmo conteúdo, em texto estruturado: títulos,
 * listas, tabelas, citações, links e referências. Sublinhado não existe em
 * Markdown; o trecho sai como texto normal, sem perder uma letra.
 */

/** Caracteres que o Markdown leria como marcação. */
const escapeMd = (text: string) => text.replace(/([\\`*_[\]<>|])/g, '\\$1');

function inline(para: Para): string {
  return para
    .map((run) => {
      if (run.text === '\n') return '  \n';
      // a ênfase do Markdown não aceita espaço colado ao asterisco
      const lead = run.text.match(/^\s*/)?.[0] ?? '';
      const trail = run.text.match(/\s*$/)?.[0] ?? '';
      const core = run.text.trim();
      if (!core) return run.text;
      let out = escapeMd(core);
      if (run.bold && run.italic) out = `***${out}***`;
      else if (run.bold) out = `**${out}**`;
      else if (run.italic) out = `*${out}*`;
      if (run.link) out = `[${out}](${run.link})`;
      return lead + out + trail;
    })
    .join('');
}

const cell = (text: string) => escapeMd(text).replace(/\n/g, ' ');

export function buildMarkdown(doc: RenderDoc): string {
  const { layout } = doc;
  const out: string[] = [`# ${doc.title}`];
  if (layout.subtitle.trim()) out.push(`*${escapeMd(layout.subtitle.trim())}*`);
  const meta = metaLine(layout);
  if (meta) out.push(escapeMd(meta));

  for (const node of doc.nodes) {
    switch (node.t) {
      case 'heading':
        if (node.pageBreak) out.push('---');
        out.push(`${node.level === 1 ? '##' : '###'} ${escapeMd(node.text)}`);
        break;
      case 'para':
        out.push(inline(node.runs));
        break;
      case 'highlight':
        out.push(node.paras.map((p) => `> **${inline(p).replace(/\n/g, '\n> ')}**`).join('\n>\n'));
        break;
      case 'quote': {
        const lines = node.paras.map((p) => `> *${inline(p).replace(/\n/g, '\n> ')}*`);
        if (node.reference) lines.push(`> — ${escapeMd(node.reference)}`);
        out.push(lines.join('\n>\n'));
        break;
      }
      case 'list':
        out.push(
          node.items
            .map((item, i) => `${node.ordered ? `${i + 1}.` : '-'} ${inline(item).replace(/\n/g, '\n   ')}`)
            .join('\n'),
        );
        break;
      case 'table': {
        const [head, ...rows] = node.rows;
        out.push(
          [
            `| ${head.map(cell).join(' | ')} |`,
            `| ${head.map(() => '---').join(' | ')} |`,
            ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
          ].join('\n'),
        );
        break;
      }
    }
  }

  if (layout.notesSpace) {
    out.push('## Anotações', Array.from({ length: NOTES_LINES }, () => '_______________________________________').join('\n\n'));
  }
  return `${out.join('\n\n')}\n`;
}
