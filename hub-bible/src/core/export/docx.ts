import type { ExportLayout } from '../db/types';
import type { Para } from './inline';
import { metaLine, NOTES_LINES, tocEntries, type RenderDoc, type RenderNode } from './model';
import { DOCX_FONT, MARGINS_MM, PAGE_MM } from './themes';

/**
 * Gerador de Word (.docx) — arquivo editável de verdade, com estilos de título
 * (o Word monta o sumário a partir deles), listas numeradas e com marcadores,
 * tabelas, quadros, citações, cabeçalho, rodapé e numeração de páginas.
 *
 * A biblioteca `docx` é carregada sob demanda: quem nunca gera um arquivo não
 * baixa nada disto.
 */

type Docx = typeof import('docx');

const ptToHalf = (pt: number) => Math.round(pt * 2);

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function buildDocx(doc: RenderDoc): Promise<Blob> {
  const d: Docx = await import('docx');
  const { layout, theme } = doc;
  const headingFont = DOCX_FONT[theme.headings];
  const size = layout.fontSize;
  const mm = d.convertMillimetersToTwip;
  const page = PAGE_MM[layout.pageSize];
  const margin = mm(MARGINS_MM[layout.margins]);
  const contentWidth = mm(page.width) - 2 * margin;

  const runsOf = (para: Para, base: { italics?: boolean; size?: number; color?: string } = {}) => {
    const out: Array<InstanceType<Docx['TextRun']> | InstanceType<Docx['ExternalHyperlink']>> = [];
    let pendingBreak = 0;
    for (const run of para) {
      if (run.text === '\n') {
        pendingBreak++;
        continue;
      }
      const text = new d.TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italic || base.italics,
        underline: run.underline || run.link ? {} : undefined,
        color: run.color ?? (run.link ? theme.colors.accent : base.color),
        size: base.size ? ptToHalf(base.size) : undefined,
        break: pendingBreak || undefined,
      });
      pendingBreak = 0;
      out.push(run.link ? new d.ExternalHyperlink({ link: run.link, children: [text] }) : text);
    }
    return out;
  };

  const justified = theme.justify ? d.AlignmentType.JUSTIFIED : d.AlignmentType.LEFT;
  let listInstance = 0;

  /*
   * O sumário é escrito por extenso — cada título com link e o número da
   * página como campo de referência —, e não como o campo TOC do Word. O
   * campo TOC só mostra alguma coisa depois de atualizado, e leitores como o
   * LibreOffice e o Google Docs o abrem vazio. Assim, os títulos aparecem em
   * qualquer leitor, e os números de página são calculados por ele.
   */
  const withToc = layout.toc && tocEntries(doc).length > 0;
  let headingIndex = 0;
  const bookmarkOf = (i: number) => `_Toc_hub_${i}`;

  const nodeToChildren = (node: RenderNode): Array<InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']>> => {
    switch (node.t) {
      case 'heading': {
        const text = new d.TextRun({ text: theme.h1Uppercase && node.level === 1 ? node.text.toUpperCase() : node.text });
        const id = bookmarkOf(headingIndex++);
        return [
          new d.Paragraph({
            heading: node.level === 1 ? d.HeadingLevel.HEADING_1 : d.HeadingLevel.HEADING_2,
            pageBreakBefore: node.pageBreak,
            children: withToc ? [new d.Bookmark({ id, children: [text] })] : [text],
          }),
        ];
      }
      case 'para':
        return [new d.Paragraph({ alignment: justified, children: runsOf(node.runs) })];
      case 'highlight':
        return node.paras.map(
          (para, i) =>
            new d.Paragraph({
              children: runsOf(para),
              shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: theme.colors.highlightBg },
              border: { left: { style: d.BorderStyle.SINGLE, size: 18, color: theme.colors.heading, space: 8 } },
              indent: { left: 200, right: 200 },
              spacing: { before: i === 0 ? 160 : 0, after: i === node.paras.length - 1 ? 200 : 60 },
              keepLines: true,
            }),
        );
      case 'quote': {
        const paras = node.paras.map(
          (para, i) =>
            new d.Paragraph({
              alignment: justified,
              children: runsOf(para, { italics: true }),
              shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: theme.colors.quoteBg },
              border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: theme.colors.accent, space: 8 } },
              indent: { left: 360, right: 200 },
              spacing: { before: i === 0 ? 160 : 0, after: 60 },
              keepNext: true,
            }),
        );
        if (node.reference) {
          paras.push(
            new d.Paragraph({
              alignment: d.AlignmentType.RIGHT,
              indent: { left: 360, right: 200 },
              spacing: { after: 200 },
              children: [
                new d.TextRun({
                  text: node.reference,
                  font: DOCX_FONT.sans,
                  size: ptToHalf(size * 0.82),
                  color: theme.colors.accent,
                  bold: true,
                }),
              ],
            }),
          );
        }
        return paras;
      }
      case 'list': {
        listInstance++;
        return node.items.map(
          (item) =>
            new d.Paragraph({
              children: runsOf(item),
              ...(node.ordered
                ? { numbering: { reference: 'hub-ordered', level: 0, instance: listInstance } }
                : { numbering: { reference: 'hub-bullet', level: 0 } }),
              spacing: { after: 60 },
            }),
        );
      }
      case 'table': {
        const columns = node.rows[0]?.length ?? 1;
        return [
          new d.Table({
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            borders: Object.fromEntries(
              ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].map((side) => [
                side,
                { style: d.BorderStyle.SINGLE, size: 4, color: 'C8C8C8' },
              ]),
            ),
            rows: node.rows.map(
              (row, r) =>
                new d.TableRow({
                  tableHeader: r === 0,
                  cantSplit: true,
                  children: row.map(
                    (cell) =>
                      new d.TableCell({
                        width: { size: Math.floor(100 / columns), type: d.WidthType.PERCENTAGE },
                        shading: r === 0 ? { type: d.ShadingType.CLEAR, color: 'auto', fill: theme.colors.highlightBg } : undefined,
                        margins: { top: 60, bottom: 60, left: 100, right: 100 },
                        children: [
                          new d.Paragraph({
                            spacing: { after: 0 },
                            children: [new d.TextRun({ text: cell, bold: r === 0 })],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
          new d.Paragraph({ spacing: { after: 120 }, children: [] }),
        ];
      }
    }
  };

  /* ------------------------------- capa ------------------------------- */
  const coverChildren: Array<InstanceType<Docx['Paragraph']>> = [];
  if (layout.cover) {
    coverChildren.push(new d.Paragraph({ spacing: { before: mm(40) }, children: [] }));
    if (layout.logo) {
      const maxW = 140;
      const ratio = layout.logo.height / layout.logo.width;
      const width = Math.min(maxW, layout.logo.width);
      coverChildren.push(
        new d.Paragraph({
          alignment: d.AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [
            new d.ImageRun({
              type: layout.logo.mime === 'image/png' ? 'png' : 'jpg',
              data: dataUrlBytes(layout.logo.dataUrl),
              transformation: { width, height: Math.round(width * ratio) },
            }),
          ],
        }),
      );
    }
    coverChildren.push(
      new d.Paragraph({
        heading: d.HeadingLevel.TITLE,
        alignment: d.AlignmentType.CENTER,
        children: [new d.TextRun({ text: doc.title })],
      }),
    );
    if (layout.subtitle.trim()) {
      coverChildren.push(
        new d.Paragraph({
          alignment: d.AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new d.TextRun({ text: layout.subtitle.trim(), italics: true, size: ptToHalf(size * 1.25), color: theme.colors.muted })],
        }),
      );
    }
    coverChildren.push(
      new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        border: { bottom: { style: d.BorderStyle.SINGLE, size: 8, color: theme.colors.accent, space: 1 } },
        indent: { left: mm(50), right: mm(50) },
        spacing: { after: mm(30) },
        children: [],
      }),
    );
    for (const value of [layout.author, layout.institution, layout.dateLabel]) {
      if (!value.trim()) continue;
      coverChildren.push(
        new d.Paragraph({
          alignment: d.AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new d.TextRun({ text: value.trim(), size: ptToHalf(size * 1.05), color: theme.colors.text })],
        }),
      );
    }
  }

  /* --------------------------- corpo do texto -------------------------- */
  const mainChildren: Array<InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']> | InstanceType<Docx['TableOfContents']>> = [];

  if (withToc) {
    mainChildren.push(
      new d.Paragraph({
        spacing: { after: 240 },
        children: [new d.TextRun({ text: 'Sumário', font: headingFont, bold: true, size: ptToHalf(size * theme.h1Scale), color: theme.colors.heading })],
      }),
      ...tocEntries(doc).map(
        (entry, i) =>
          new d.Paragraph({
            indent: entry.level === 2 ? { left: 360 } : undefined,
            spacing: { before: entry.level === 1 ? 80 : 0, after: 40 },
            tabStops: [{ type: d.TabStopType.RIGHT, position: contentWidth, leader: d.LeaderType.DOT }],
            children: [
              new d.InternalHyperlink({
                anchor: bookmarkOf(i),
                children: [new d.TextRun({ text: entry.text, bold: entry.level === 1 })],
              }),
              new d.TextRun({ children: [new d.Tab()] }),
              new d.PageReference(bookmarkOf(i), { hyperlink: true }),
            ],
          }),
      ),
      new d.Paragraph({ children: [new d.PageBreak()] }),
    );
  }

  if (!layout.cover) {
    mainChildren.push(
      new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun({ text: doc.title })] }),
    );
    if (layout.subtitle.trim()) {
      mainChildren.push(
        new d.Paragraph({
          spacing: { after: 80 },
          children: [new d.TextRun({ text: layout.subtitle.trim(), italics: true, color: theme.colors.muted, size: ptToHalf(size * 1.1) })],
        }),
      );
    }
    const meta = metaLine(layout);
    if (meta) {
      mainChildren.push(
        new d.Paragraph({
          spacing: { after: 280 },
          children: [new d.TextRun({ text: meta, font: DOCX_FONT.sans, size: ptToHalf(size * 0.85), color: theme.colors.muted })],
        }),
      );
    }
  }

  for (const node of doc.nodes) mainChildren.push(...nodeToChildren(node));

  if (layout.notesSpace) {
    mainChildren.push(
      new d.Paragraph({
        spacing: { before: 360, after: 120 },
        keepNext: true,
        children: [new d.TextRun({ text: 'Anotações', font: headingFont, bold: true, color: theme.colors.heading })],
      }),
    );
    for (let i = 0; i < NOTES_LINES; i++) {
      mainChildren.push(
        new d.Paragraph({
          spacing: { before: 0, after: 0, line: 480 },
          border: { bottom: { style: d.BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 1 } },
          children: [],
        }),
      );
    }
  }

  /* ----------------------- cabeçalho e rodapé ------------------------- */
  const smallRun = (text: string) =>
    new d.TextRun({ text, font: DOCX_FONT.sans, size: ptToHalf(Math.max(7.5, size * 0.75)), color: theme.colors.muted });

  const header = layout.header.trim()
    ? new d.Header({
        children: [
          new d.Paragraph({
            alignment: d.AlignmentType.RIGHT,
            border: { bottom: { style: d.BorderStyle.SINGLE, size: 4, color: 'D0D0D0', space: 4 } },
            children: [smallRun(layout.header.trim())],
          }),
        ],
      })
    : undefined;

  const footerParts: Array<InstanceType<Docx['TextRun']>> = [];
  if (layout.footer.trim()) footerParts.push(smallRun(layout.footer.trim()));
  if (layout.pageNumbers) {
    if (footerParts.length) footerParts.push(smallRun(layout.pageNumberAlign === 'right' ? '\t' : '  ·  '));
    footerParts.push(
      new d.TextRun({
        children: [d.PageNumber.CURRENT],
        font: DOCX_FONT.sans,
        size: ptToHalf(Math.max(7.5, size * 0.75)),
        color: theme.colors.muted,
      }),
    );
  }
  const footer = footerParts.length
    ? new d.Footer({
        children: [
          new d.Paragraph({
            alignment:
              layout.pageNumberAlign === 'right' && !layout.footer.trim()
                ? d.AlignmentType.RIGHT
                : layout.pageNumberAlign === 'right'
                  ? d.AlignmentType.LEFT
                  : d.AlignmentType.CENTER,
            tabStops: [{ type: d.TabStopType.RIGHT, position: contentWidth }],
            children: footerParts,
          }),
        ],
      })
    : undefined;

  const pageProps = {
    size: { width: mm(page.width), height: mm(page.height) },
    margin: { top: margin, bottom: margin, left: margin, right: margin, header: mm(10), footer: mm(10) },
  };

  const sections = [];
  if (layout.cover) {
    sections.push({ properties: { page: pageProps }, children: coverChildren });
  }
  sections.push({
    properties: { page: pageProps, ...(layout.cover ? { type: d.SectionType.NEXT_PAGE } : {}) },
    headers: header ? { default: header } : undefined,
    footers: footer ? { default: footer } : undefined,
    children: mainChildren,
  });

  const document = new d.Document({
    creator: layout.author.trim() || 'Hub Bible',
    title: doc.title,
    description: layout.subtitle.trim() || undefined,
    // o Word recalcula os números de página do sumário ao abrir
    features: { updateFields: withToc },
    // linha que termina numa quebra manual não é esticada no texto justificado
    compatibility: { doNotExpandShiftReturn: true },
    styles: docxStyles(d, layout, doc),
    numbering: {
      config: [
        {
          reference: 'hub-ordered',
          levels: [
            {
              level: 0,
              format: d.LevelFormat.DECIMAL,
              text: '%1.',
              alignment: d.AlignmentType.START,
              style: { paragraph: { indent: { left: 540, hanging: 300 } } },
            },
          ],
        },
        {
          reference: 'hub-bullet',
          levels: [
            {
              level: 0,
              format: d.LevelFormat.BULLET,
              text: '•',
              alignment: d.AlignmentType.START,
              style: { paragraph: { indent: { left: 540, hanging: 300 } } },
            },
          ],
        },
      ],
    },
    sections,
  });

  return d.Packer.toBlob(document);
}

function docxStyles(d: Docx, layout: ExportLayout, doc: RenderDoc) {
  const { theme } = doc;
  const size = layout.fontSize;
  const line = Math.round(240 * layout.lineSpacing);
  const bodyFont = DOCX_FONT[theme.body];
  const headingFont = DOCX_FONT[theme.headings];
  return {
    default: {
      document: {
        run: { font: bodyFont, size: ptToHalf(size), color: theme.colors.text },
        paragraph: { spacing: { line, after: 140 } },
      },
      title: {
        run: { font: headingFont, size: ptToHalf(size * theme.titleScale), bold: true, color: theme.colors.title },
        paragraph: { spacing: { after: 120 } },
      },
      heading1: {
        run: { font: headingFont, size: ptToHalf(size * theme.h1Scale), bold: true, color: theme.colors.heading },
        paragraph: {
          spacing: { before: 360, after: 140 },
          keepNext: true,
          keepLines: true,
          ...(theme.headingRule
            ? { border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: theme.colors.accent, space: 2 } } }
            : {}),
        },
      },
      heading2: {
        run: { font: headingFont, size: ptToHalf(size * theme.h2Scale), bold: true, color: theme.colors.heading },
        paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, keepLines: true },
      },
      listParagraph: { run: { font: bodyFont, size: ptToHalf(size) } },
    },
  };
}
