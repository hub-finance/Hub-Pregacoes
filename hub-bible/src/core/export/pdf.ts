import type { Content, ContentTable, TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import type { Para } from './inline';
import { metaLine, NOTES_LINES, tocEntries, type RenderDoc, type RenderNode } from './model';
import { MARGINS_MM, PAGE_MM, PDF_FONT } from './themes';

/**
 * Gerador de PDF — pronto para imprimir e compartilhar.
 *
 * As fontes vão embutidas no arquivo (Lora e Source Sans 3), por isso acentos,
 * travessões e aspas saem iguais em qualquer aparelho. O sumário é montado
 * pelo próprio gerador depois de paginar, então os números de página do
 * sumário são os do arquivo final.
 *
 * `pdfDefinition` é pura — monta a descrição do documento sem tocar em
 * navegador nem em arquivo —, e é ela que os testes exercitam. `buildPdf`
 * carrega as fontes e o `pdfmake` sob demanda e devolve o arquivo.
 */

const MM = 72 / 25.4;
const hex = (value: string) => `#${value}`;

/** Arquivos de fonte em `public/fonts/`. */
export const PDF_FONT_FILES = {
  Lora: {
    normal: 'Lora-Regular.ttf',
    bold: 'Lora-Bold.ttf',
    italics: 'Lora-Italic.ttf',
    bolditalics: 'Lora-BoldItalic.ttf',
  },
  SourceSans: {
    normal: 'SourceSans3-Regular.ttf',
    bold: 'SourceSans3-Bold.ttf',
    italics: 'SourceSans3-Italic.ttf',
    bolditalics: 'SourceSans3-BoldItalic.ttf',
  },
} satisfies TFontDictionary;

function runs(para: Para, linkColor: string): Content[] {
  // O espaço no começo de um trecho (" com", depois de um negrito) fica com o
  // trecho anterior: no texto justificado, espaço solto no início de um trecho
  // vira um vão maior que os outros.
  const parts = para.map((run) => ({ ...run }));
  for (let i = 1; i < parts.length; i++) {
    const lead = /^ +/.exec(parts[i].text)?.[0];
    if (lead && parts[i - 1].text !== '\n') {
      parts[i - 1].text += lead;
      parts[i].text = parts[i].text.slice(lead.length);
    }
  }
  return parts
    .filter((run) => run.text.length)
    .map((run) => {
      if (run.text === '\n') return { text: '\n' };
      return {
        text: run.text,
        bold: run.bold || undefined,
        italics: run.italic || undefined,
        decoration: run.underline || run.link ? 'underline' : undefined,
        color: run.color ? hex(run.color) : run.link ? linkColor : undefined,
        link: run.link,
      };
    });
}

const textLength = (paras: Para[]) => paras.reduce((n, p) => n + p.reduce((m, r) => m + r.text.length, 0), 0);

export function pdfDefinition(doc: RenderDoc): TDocumentDefinitions {
  const { layout, theme } = doc;
  const size = layout.fontSize;
  const margin = MARGINS_MM[layout.margins] * MM;
  /** Largura útil da folha, para os fios e as linhas de anotação. */
  const width = PAGE_MM[layout.pageSize].width * MM - 2 * margin;
  const bodyFont = PDF_FONT[theme.body];
  const headingFont = PDF_FONT[theme.headings];
  const accent = hex(theme.colors.accent);
  const align = theme.justify ? 'justify' : 'left';
  const content: Content[] = [];

  /* -------------------------------- capa ------------------------------- */
  if (layout.cover) {
    const cover: Content[] = [{ text: '', margin: [0, 60 * MM * 0.5, 0, 0] }];
    if (layout.logo) {
      const logoWidth = Math.min(110, layout.logo.width);
      cover.push({ image: layout.logo.dataUrl, width: logoWidth, alignment: 'center', margin: [0, 0, 0, 28] });
    }
    cover.push({ text: doc.title, style: 'coverTitle' });
    if (layout.subtitle.trim()) cover.push({ text: layout.subtitle.trim(), style: 'coverSubtitle' });
    cover.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 120, y2: 0, lineWidth: 1.2, lineColor: accent }],
      alignment: 'center',
      margin: [0, 18, 0, 40],
    } as Content);
    for (const value of [layout.author, layout.institution, layout.dateLabel]) {
      if (value.trim()) cover.push({ text: value.trim(), style: 'coverMeta' });
    }
    content.push({ stack: cover, pageBreak: 'after' } as Content);
  }

  /* ------------------------------ sumário ------------------------------ */
  if (layout.toc && tocEntries(doc).length) {
    content.push({
      toc: {
        title: { text: 'Sumário', style: 'tocTitle' },
        numberStyle: { font: PDF_FONT.sans, color: hex(theme.colors.muted) },
        textMargin: [0, 2, 0, 2],
      },
      pageBreak: 'after',
    } as Content);
  }

  /* ------------------------------- título ------------------------------ */
  if (!layout.cover) {
    content.push({ text: doc.title, style: 'docTitle' });
    if (layout.subtitle.trim()) content.push({ text: layout.subtitle.trim(), style: 'docSubtitle' });
    const meta = metaLine(layout);
    if (meta) content.push({ text: meta, style: 'docMeta' });
    content.push({ text: '', margin: [0, 0, 0, 8] });
  }

  const boxLayout = (bar: string, barWidth: number) => ({
    hLineWidth: () => 0,
    vLineWidth: (i: number) => (i === 0 ? barWidth : 0),
    vLineColor: () => bar,
    paddingLeft: () => 11,
    paddingRight: () => 10,
    paddingTop: () => 7,
    paddingBottom: () => 7,
  });

  const nodeToContent = (node: RenderNode): Content => {
    switch (node.t) {
      case 'heading': {
        const text = theme.h1Uppercase && node.level === 1 ? node.text.toUpperCase() : node.text;
        const heading: Content = {
          text,
          style: node.level === 1 ? 'h1' : 'h2',
          tocItem: true,
          tocStyle: node.level === 1 ? { bold: true } : {},
          tocMargin: node.level === 1 ? [0, 4, 0, 0] : [14, 2, 0, 0],
        } as Content;
        if (node.level === 1 && theme.headingRule) {
          return {
            stack: [
              heading,
              {
                canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.8, lineColor: accent }],
                margin: [0, 2, 0, 8],
              },
            ],
            headlineLevel: node.level,
            pageBreak: node.pageBreak ? 'before' : undefined,
          } as Content;
        }
        return {
          ...(heading as object),
          headlineLevel: node.level,
          pageBreak: node.pageBreak ? 'before' : undefined,
        } as Content;
      }
      case 'para':
        return { text: runs(node.runs, accent), alignment: align, margin: [0, 0, 0, size * 0.6] };
      case 'highlight':
        return {
          table: {
            widths: ['*'],
            body: [[{ stack: node.paras.map((p) => ({ text: runs(p, accent), margin: [0, 0, 0, 3] })), fillColor: hex(theme.colors.highlightBg) }]],
          },
          layout: boxLayout(hex(theme.colors.heading), 3),
          margin: [0, 4, 0, size * 0.9],
          unbreakable: textLength(node.paras) < 700,
        } as ContentTable;
      case 'quote': {
        const stack: Content[] = node.paras.map((p) => ({
          text: runs(p, accent),
          italics: true,
          alignment: align,
          margin: [0, 0, 0, 3],
        }));
        if (node.reference) stack.push({ text: node.reference, style: 'reference' });
        return {
          table: { widths: ['*'], body: [[{ stack, fillColor: hex(theme.colors.quoteBg) }]] },
          layout: boxLayout(accent, 2.2),
          margin: [8, 4, 0, size * 0.9],
          unbreakable: textLength(node.paras) < 700,
        } as ContentTable;
      }
      case 'list': {
        const items = node.items.map((item) => ({ text: runs(item, accent), margin: [0, 0, 0, 3] }));
        return (node.ordered
          ? { ol: items, margin: [6, 0, 0, size * 0.7] }
          : { ul: items, margin: [6, 0, 0, size * 0.7] }) as Content;
      }
      case 'table': {
        const columns = node.rows[0]?.length ?? 1;
        return {
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: Array(columns).fill('*'),
            body: node.rows.map((row, r) =>
              row.map((cell) => ({
                text: cell,
                bold: r === 0 || undefined,
                fillColor: r === 0 ? hex(theme.colors.highlightBg) : undefined,
                fontSize: size * 0.92,
              })),
            ),
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => '#C8C8C8',
            vLineColor: () => '#C8C8C8',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 4, 0, size * 0.9],
        } as ContentTable;
      }
    }
  };

  for (const node of doc.nodes) content.push(nodeToContent(node));

  if (layout.notesSpace) {
    const gap = size * 2.2;
    content.push({
      stack: [
        { text: 'Anotações', style: 'h2' },
        {
          canvas: Array.from({ length: NOTES_LINES }, (_, i) => ({
            type: 'line' as const,
            x1: 0,
            y1: (i + 1) * gap,
            x2: width,
            y2: (i + 1) * gap,
            lineWidth: 0.5,
            lineColor: '#BFBFBF',
          })),
        },
      ],
      unbreakable: true,
      margin: [0, 16, 0, 0],
    } as Content);
  }

  const small = Math.max(7.5, size * 0.75);
  const skipCover = (page: number) => layout.cover && page === 1;

  return {
    pageSize: layout.pageSize,
    pageMargins: [margin, margin + (layout.header.trim() ? 8 : 0), margin, margin + 6],
    info: {
      title: doc.title,
      author: layout.author.trim() || undefined,
      subject: layout.subtitle.trim() || undefined,
      creator: 'Hub Bible',
      producer: 'Hub Bible',
    },
    content,
    header: (page: number) => {
      if (!layout.header.trim() || skipCover(page)) return null;
      return {
        text: layout.header.trim(),
        alignment: 'right',
        font: PDF_FONT.sans,
        fontSize: small,
        color: hex(theme.colors.muted),
        margin: [margin, margin * 0.45, margin, 0],
      } as Content;
    },
    footer: (page: number) => {
      if (skipCover(page)) return null;
      const footerText = layout.footer.trim();
      if (!footerText && !layout.pageNumbers) return null;
      const number = layout.pageNumbers ? String(page) : '';
      const base = { font: PDF_FONT.sans, fontSize: small, color: hex(theme.colors.muted) };
      if (layout.pageNumberAlign === 'right') {
        return {
          columns: [
            { text: footerText, alignment: 'left', ...base },
            { text: number, alignment: 'right', width: 40, ...base },
          ],
          margin: [margin, 6, margin, 0],
        } as Content;
      }
      return {
        text: [footerText, footerText && number ? '  ·  ' : '', number].join(''),
        alignment: 'center',
        margin: [margin, 6, margin, 0],
        ...base,
      } as Content;
    },
    // Título no pé da página vai para a página seguinte, junto do texto dele:
    // quebra quando nada além do próprio título (e do fio dele) cabe abaixo.
    pageBreakBefore: (current, following) =>
      !!current.headlineLevel &&
      following.every((n) => n.startPosition.top - current.startPosition.top < size * 3.2),
    defaultStyle: {
      font: bodyFont,
      fontSize: size,
      lineHeight: layout.lineSpacing,
      color: hex(theme.colors.text),
    },
    styles: {
      coverTitle: {
        font: headingFont,
        fontSize: size * theme.titleScale * 1.15,
        bold: true,
        color: hex(theme.colors.title),
        alignment: 'center',
        lineHeight: 1.15,
        margin: [0, 0, 0, 12],
      },
      coverSubtitle: {
        fontSize: size * 1.25,
        italics: true,
        color: hex(theme.colors.muted),
        alignment: 'center',
        lineHeight: 1.25,
      },
      coverMeta: { fontSize: size * 1.05, alignment: 'center', margin: [0, 0, 0, 4] },
      tocTitle: {
        font: headingFont,
        fontSize: size * theme.h1Scale,
        bold: true,
        color: hex(theme.colors.heading),
        margin: [0, 0, 0, 14],
      },
      docTitle: {
        font: headingFont,
        fontSize: size * theme.titleScale,
        bold: true,
        color: hex(theme.colors.title),
        lineHeight: 1.15,
        margin: [0, 0, 0, 4],
      },
      docSubtitle: { fontSize: size * 1.1, italics: true, color: hex(theme.colors.muted), margin: [0, 0, 0, 2] },
      docMeta: { font: PDF_FONT.sans, fontSize: size * 0.85, color: hex(theme.colors.muted), margin: [0, 2, 0, 6] },
      h1: {
        font: headingFont,
        fontSize: size * theme.h1Scale,
        bold: true,
        color: hex(theme.colors.heading),
        lineHeight: 1.15,
        margin: [0, size * 1.3, 0, size * 0.5],
      },
      h2: {
        font: headingFont,
        fontSize: size * theme.h2Scale,
        bold: true,
        color: hex(theme.colors.heading),
        lineHeight: 1.15,
        margin: [0, size * 0.9, 0, size * 0.35],
      },
      reference: {
        font: PDF_FONT.sans,
        fontSize: size * 0.8,
        bold: true,
        color: accent,
        alignment: 'right',
        italics: false,
        margin: [0, 2, 0, 0],
      },
    },
  };
}

/* ------------------------------ no navegador ----------------------------- */

let vfsCache: Record<string, string> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Lê as fontes de `fonts/` (no precache do app: funciona sem internet). */
async function loadFonts(): Promise<Record<string, string>> {
  if (vfsCache) return vfsCache;
  const files = Object.values(PDF_FONT_FILES).flatMap((f) => Object.values(f));
  const entries = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(`./fonts/${file}`);
      if (!res.ok) throw new Error(`Fonte ${file} indisponível (${res.status}).`);
      return [file, toBase64(await res.arrayBuffer())] as const;
    }),
  );
  vfsCache = Object.fromEntries(entries);
  return vfsCache;
}

export async function buildPdf(doc: RenderDoc): Promise<Blob> {
  const [vfs, mod] = await Promise.all([loadFonts(), import('pdfmake/build/pdfmake')]);
  const pdfMake = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const definition = pdfDefinition(doc);
  const pdf = (pdfMake as unknown as {
    createPdf: (
      def: TDocumentDefinitions,
      layouts?: unknown,
      fonts?: TFontDictionary,
      vfs?: Record<string, string>,
    ) => { getBlob: (cb: (blob: Blob) => void) => unknown };
  }).createPdf(definition, undefined, PDF_FONT_FILES, vfs);
  return new Promise<Blob>((resolve, reject) => {
    try {
      const maybe = pdf.getBlob((blob) => resolve(blob));
      if (maybe && typeof (maybe as Promise<Blob>).then === 'function') {
        (maybe as Promise<Blob>).then(resolve, reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}
