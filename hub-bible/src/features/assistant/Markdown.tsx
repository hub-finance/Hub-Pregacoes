import { Fragment, type ReactNode } from 'react';
import { parseReference } from '../../core/bible/reference';
import type { PreviewTarget } from '../bible/VersePreview';

/**
 * Markdown simples da resposta da IA — títulos, listas, citações, negrito e
 * itálico — montado como elementos React, sem innerHTML: o texto vem de fora
 * e nunca vira HTML.
 *
 * Referências entre colchetes só viram botão quando foram conferidas na
 * tradução em uso; as demais aparecem como texto, sem os colchetes.
 */

interface Props {
  text: string;
  validRefs: Set<string>;
  onRef: (target: PreviewTarget, from: HTMLElement) => void;
}

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let para: string[] = [];
  // linha em branco entre duas citações: são duas citações, não uma
  let gap = false;
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); gap = true; continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flush();
      blocks.push({ kind: 'h', level: m[1].length, text: m[2].replace(/\s*#+$/, '') });
    } else if (/^([-*_]\s*){3,}$/.test(line) || /^[═─]{3,}$/.test(line)) {
      flush();
      blocks.push({ kind: 'hr' });
    } else if ((m = line.match(/^[-*•]\s+(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ul') last.items.push(m[1]);
      else blocks.push({ kind: 'ul', items: [m[1]] });
    } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'ol') last.items.push(m[1]);
      else blocks.push({ kind: 'ol', items: [m[1]] });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'quote' && !gap) last.text += ` ${m[1]}`;
      else blocks.push({ kind: 'quote', text: m[1] });
    } else {
      para.push(line);
    }
    gap = false;
  }
  flush();
  return blocks;
}

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\])/g;

function Inline({ text, validRefs, onRef }: { text: string } & Omit<Props, 'text'>) {
  const parts = text.split(INLINE_RE);
  const out: ReactNode[] = parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}><Inline text={part.slice(2, -2)} validRefs={validRefs} onRef={onRef} /></strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      const parsed = validRefs.has(inner) ? parseReference(inner) : null;
      if (!parsed) return <Fragment key={i}>{inner}</Fragment>;
      const target: PreviewTarget = {
        book: parsed.book,
        chapter: parsed.chapter,
        verse: parsed.verse ?? 1,
        verseEnd: parsed.verseEnd,
      };
      return (
        <button
          key={i}
          type="button"
          className="ref-link"
          onClick={(e) => onRef(target, e.currentTarget)}
        >
          {inner}
        </button>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
  return <>{out}</>;
}

export function Markdown({ text, validRefs, onRef }: Props) {
  const blocks = parseBlocks(text);
  const inline = (t: string) => <Inline text={t} validRefs={validRefs} onRef={onRef} />;
  return (
    <div className="md">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h': {
            const Tag = b.level <= 2 ? 'h3' : 'h4';
            return <Tag key={i}>{inline(b.text)}</Tag>;
          }
          case 'ul':
            return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
          case 'ol':
            return <ol key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>;
          case 'quote':
            return <blockquote key={i}>{inline(b.text)}</blockquote>;
          case 'hr':
            return <hr key={i} />;
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}

/** Texto limpo para copiar ou salvar como anotação. */
export function markdownToPlain(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
