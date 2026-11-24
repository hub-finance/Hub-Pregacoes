import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { pdfFromDefinition } from './pdf';

/**
 * Mensagens em HTML — o "Modo Púlpito" que o pregador monta no projeto de
 * mensagens dele: uma página que se navega por tópicos, com menu, marcação de
 * onde parou e cronômetro. O app guarda o arquivo inteiro e o exibe como veio
 * (DocumentViewer, num quadro isolado); daqui saem o título e o PDF.
 *
 * O conteúdo de verdade fica no bloco <script type="application/json"
 * id="mensagem">: título, abertura e tópicos, cada um com blocos
 * (p, h, b, txt, vs, fr, q, decl; **texto** = negrito). Sem esse bloco, o HTML
 * é lido como página comum (títulos, parágrafos, listas, citações).
 *
 * Ler com DOMParser não executa nenhum script do arquivo.
 */

export type MessageBlock = [string, unknown];

export interface MessageTopic {
  etiqueta?: string;
  titulo: string;
  blocos: MessageBlock[];
}

export interface HtmlMessage {
  titulo: string;
  abertura: MessageBlock[];
  topicos: MessageTopic[];
}

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** O bloco de dados do Modo Púlpito, se o arquivo tiver. */
function messageFromJson(doc: Document): HtmlMessage | null {
  const node = doc.querySelector('script#mensagem[type="application/json"], script#mensagem');
  if (!node?.textContent) return null;
  try {
    const raw = JSON.parse(node.textContent) as Partial<HtmlMessage>;
    if (!Array.isArray(raw.topicos)) return null;
    return {
      titulo: String(raw.titulo ?? '').trim(),
      abertura: Array.isArray(raw.abertura) ? (raw.abertura as MessageBlock[]) : [],
      topicos: raw.topicos
        .filter((t): t is MessageTopic => !!t && typeof t === 'object')
        .map((t) => ({ etiqueta: t.etiqueta ? String(t.etiqueta) : '', titulo: String(t.titulo ?? ''), blocos: Array.isArray(t.blocos) ? t.blocos : [] })),
    };
  } catch {
    return null;
  }
}

/** HTML comum: cada h1/h2 abre um tópico; o resto vira blocos. */
function messageFromPage(doc: Document): HtmlMessage {
  doc.querySelectorAll('script, style, noscript, nav, header, footer, button, select').forEach((n) => n.remove());
  const titulo = (doc.querySelector('h1')?.textContent ?? doc.title ?? '').trim();
  const topicos: MessageTopic[] = [];
  const abertura: MessageBlock[] = [];
  const push = (b: MessageBlock) => (topicos.length ? topicos[topicos.length - 1].blocos : abertura).push(b);
  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  for (const el of Array.from(doc.body?.querySelectorAll('h1, h2, h3, h4, p, li, blockquote') ?? [])) {
    if (el.closest('li') && el.tagName !== 'LI') continue;
    if (el.tagName === 'P' && el.closest('blockquote')) continue;
    const t = text(el);
    if (!t) continue;
    if (el.tagName === 'H1' && t === titulo) continue;
    if (el.tagName === 'H1' || el.tagName === 'H2') topicos.push({ etiqueta: '', titulo: t, blocos: [] });
    else if (el.tagName === 'H3' || el.tagName === 'H4') push(['h', t]);
    else if (el.tagName === 'LI') push(['b', [t]]);
    else if (el.tagName === 'BLOCKQUOTE') push(['vs', [t, '']]);
    else push(['p', t]);
  }
  return { titulo, abertura, topicos: topicos.length ? topicos : [{ etiqueta: '', titulo: titulo || 'Mensagem', blocos: abertura.splice(0) }] };
}

export function readHtmlMessage(html: string): HtmlMessage {
  const doc = parse(html);
  return messageFromJson(doc) ?? messageFromPage(doc);
}

/** O título da mensagem: o do bloco de dados, o <title> ou o primeiro título. */
export function htmlTitle(html: string): string | null {
  const doc = parse(html);
  const fromJson = messageFromJson(doc)?.titulo;
  const t = fromJson || doc.title.replace(/\s+[—–-]\s+Modo Púlpito$/i, '') || doc.querySelector('h1')?.textContent || '';
  const clean = t.replace(/\s+/g, ' ').trim();
  return clean.length >= 3 && clean.length <= 160 ? clean : null;
}

/* ───────────────────────────── o PDF ───────────────────────────── */

// as cores da impressão do Modo Púlpito: azul-marinho e dourado
const NAVY = '#1E2A3E';
const BLUE = '#24427a';
const GOLD = '#B8892A';
const GOLD_LIGHT = '#F6EEDB';
const SOFT = '#F4F6FA';
const MUTE = '#667085';

/** "**negrito**" vira trechos em negrito, no azul-marinho. */
function rich(value: unknown): Content[] {
  const s = String(value ?? '');
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true, color: NAVY } : { text: part },
  );
}

/** Caixa com barra lateral, como as do Modo Púlpito. */
function box(stack: Content[], opts: { fill?: string; bar?: string; barWidth?: number; border?: string; margin?: [number, number, number, number] } = {}): Content {
  return {
    table: { widths: ['*'], body: [[{ stack, fillColor: opts.fill, margin: [10, 8, 10, 8] }]] },
    layout: {
      hLineWidth: () => (opts.border ? 1.4 : 0),
      vLineWidth: (i: number) => (i === 0 ? opts.barWidth ?? (opts.bar ? 3 : opts.border ? 1.4 : 0) : opts.border ? 1.4 : 0),
      vLineColor: (i: number) => (i === 0 && opts.bar ? opts.bar : opts.border ?? NAVY),
      hLineColor: () => opts.border ?? NAVY,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: opts.margin ?? [0, 0, 0, 10],
  } as Content;
}

function block([kind, value]: MessageBlock): Content | null {
  switch (kind) {
    case 'p':
      return { text: rich(value), margin: [0, 0, 0, 8] };
    case 'h':
      return { text: String(value), style: 'h3', margin: [0, 10, 0, 6] };
    case 'b':
      return {
        ul: (Array.isArray(value) ? value : [value]).map((x) => ({ text: rich(x) })),
        markerColor: GOLD,
        margin: [6, 0, 0, 8],
      } as Content;
    case 'txt':
      return { text: [{ text: 'Textos: ', bold: true, color: GOLD }, String(value)], fontSize: 9.5, color: MUTE, margin: [0, 0, 0, 8] };
    case 'vs': {
      const [t, ref] = Array.isArray(value) ? value : [value, ''];
      return box(
        [{ text: rich(t), italics: true, color: '#2a3140' }, ...(ref ? [{ text: `— ${ref}`, bold: true, color: GOLD, fontSize: 9.5, margin: [0, 4, 0, 0] } as Content] : [])],
        { fill: SOFT, bar: GOLD },
      );
    }
    case 'fr':
      return box([{ text: rich(value), bold: true, color: NAVY }], { fill: GOLD_LIGHT, bar: GOLD });
    case 'q':
      return box(
        (Array.isArray(value) ? value : [value]).map((x) => ({ text: [{ text: '? ', color: GOLD, bold: true }, { text: String(x), bold: true, color: NAVY }], margin: [0, 2, 0, 2] }) as Content),
        { border: NAVY },
      );
    case 'decl':
      return box([{ text: rich(value), italics: true, bold: true, color: '#ffffff' }], { fill: NAVY, bar: GOLD, barWidth: 5 });
    default:
      return null;
  }
}

export function messagePdfDefinition(msg: HtmlMessage): TDocumentDefinitions {
  const content: Content[] = [];
  if (msg.titulo) {
    content.push({ text: msg.titulo.toUpperCase(), style: 'kick' });
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2.5, lineColor: GOLD }], margin: [0, 2, 0, 14] });
  }
  for (const b of msg.abertura) {
    const c = block(b);
    if (c) content.push(c);
  }
  msg.topicos.forEach((t, i) => {
    const first: Content[] = [];
    if (t.etiqueta) first.push({ text: t.etiqueta, style: 'tag' });
    first.push({ text: t.titulo, style: 'h2' });
    // cada tópico começa numa página nova, como na impressão do Modo Púlpito
    content.push({ stack: first, pageBreak: i > 0 || msg.abertura.length ? 'before' : undefined } as Content);
    for (const b of t.blocos) {
      const c = block(b);
      if (c) content.push(c);
    }
  });
  return {
    pageSize: 'A4',
    pageMargins: [45, 50, 45, 50],
    info: { title: msg.titulo || 'Mensagem' },
    content,
    defaultStyle: { font: 'SourceSans', fontSize: 11.5, lineHeight: 1.3, color: '#1d2433' },
    styles: {
      kick: { font: 'SourceSans', fontSize: 22, bold: true, color: NAVY },
      tag: { fontSize: 9.5, bold: true, color: GOLD, characterSpacing: 0.8, margin: [0, 0, 0, 2] },
      h2: { fontSize: 17, bold: true, color: NAVY, margin: [0, 0, 0, 10] },
      h3: { fontSize: 13, bold: true, color: BLUE },
    },
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 8.5, color: MUTE, margin: [0, 14, 0, 0] }),
  };
}

export async function htmlMessagePdf(html: string): Promise<{ blob: Blob; title: string }> {
  const msg = readHtmlMessage(html);
  const blob = await pdfFromDefinition(messagePdfDefinition(msg));
  return { blob, title: msg.titulo || 'Mensagem' };
}
