/* Testes do módulo de exportação — executados por scripts/test-export.mjs. */
import 'fake-indexeddb/auto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import JSZip from 'jszip';
import { db, uid } from '../../src/core/db/db';
import type { ExportLayout, Sermon, SermonBlock } from '../../src/core/db/types';
import { parseBlockHtml, plainOf } from '../../src/core/export/inline';
import { buildRenderDoc, contentForEdition, tableFrom, type RenderDoc } from '../../src/core/export/model';
import { buildDocx } from '../../src/core/export/docx';
import { buildMarkdown } from '../../src/core/export/markdown';
import { pdfDefinition, PDF_FONT_FILES } from '../../src/core/export/pdf';
import { safeFileName, validateFile } from '../../src/core/export/files';
import { layoutFor } from '../../src/core/export/templates';
import {
  approveVersion,
  createExportDoc,
  deleteExportDoc,
  duplicateExportDoc,
  filterExportLibrary,
  getExportDoc,
  listFiles,
  listVersions,
  loadExportLibrary,
  readExportLog,
  restoreOriginal,
  restoreVersion,
  saveDraft,
} from '../../src/core/data/exportDocs';
import { generateFiles } from '../../src/core/export/generate';
import { markdownishToBlocks } from '../../src/core/export/sources';

const OUT = process.env.EXPORT_TEST_OUT!;
const FONTS = process.env.EXPORT_TEST_FONTS!;
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
const results: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    results.push(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    results.push(`  ✘ ${name}\n      ${(err as Error).stack?.split('\n').slice(0, 3).join('\n      ')}`);
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

/* ------------------------------ utilitários ----------------------------- */

const block = (type: SermonBlock['type'], html: string, reference?: string): SermonBlock => ({
  id: uid('blc_'),
  type,
  html,
  ...(reference !== undefined ? { reference } : {}),
});

/** PDF pelo mesmo `pdfDefinition` do app, com as fontes de public/fonts. */
async function pdfBlob(doc: RenderDoc): Promise<Blob> {
  const PdfPrinter = require('pdfmake');
  const fonts: Record<string, Record<string, string>> = {};
  for (const [family, files] of Object.entries(PDF_FONT_FILES)) {
    fonts[family] = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, join(FONTS, f)]));
  }
  const printer = new PdfPrinter(fonts);
  const pdf = printer.createPdfKitDocument(pdfDefinition(doc));
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(new Blob([Buffer.concat(chunks)], { type: 'application/pdf' })));
    pdf.on('error', reject);
    pdf.end();
  });
}

/** Texto de cada página do PDF, extraído pelo pdf.js (o mesmo leitor do app). */
async function pdfPages(blob: Blob): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), disableFontFace: true, useSystemFonts: false });
  const pdf = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      (content.items as Array<{ str?: string; hasEOL?: boolean }>)
        .map((it) => (it.str ?? '') + (it.hasEOL ? '\n' : ''))
        .join('')
        .replace(/[ \t]+/g, ' '),
    );
  }
  await pdf.destroy();
  return pages;
}

/** Texto do documento principal do .docx. */
async function docxText(blob: Blob): Promise<{ text: string; xml: string; zip: JSZip }> {
  const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml = await zip.file('word/document.xml')!.async('string');
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  return { text, xml, zip };
}

const save = async (name: string, blob: Blob) => writeFileSync(join(OUT, name), Buffer.from(await blob.arrayBuffer()));

const norm = (s: string) => s.replace(/\s+/g, ' ');

function layout(category: string, model: string, patch: Partial<ExportLayout> = {}): ExportLayout {
  return { ...layoutFor(category, model, null), ...patch };
}

/* ---------------------------- conteúdo de teste ------------------------- */

const ACENTOS = 'Ação, coração, oração, É, À, ç, ã, õ, ü — “aspas” ‘simples’ … nº 1º ª §';

const sermonContent: SermonBlock[] = [
  block('section', 'Texto principal'),
  block(
    'scripture',
    'Eu sou a videira, vós, as varas; quem está em mim, e eu nele, esse dá muito fruto; porque sem mim nada podeis fazer.',
    'João 15:5',
  ),
  block('section', 'Introdução'),
  block('text', `A <b>comunhão</b> com Cristo não é um <i>acessório</i> da vida cristã: é a própria vida. ${ACENTOS}`),
  block('text', 'Segunda linha do parágrafo<br>com quebra de linha e <span style="color:#b23a35">texto em vermelho</span> e <u>sublinhado</u>.'),
  block('highlight', 'Permanecer não é esforço humano; é <b>dependência</b> diária.'),
  block('section', '1. O chamado para permanecer'),
  block('list', '<ul><li>Oração constante</li><li>Leitura da Palavra</li><li>Obediência prática</li></ul>'),
  block('list', '<ol><li>Primeiro passo</li><li>Segundo passo</li></ol>'),
  block('text', '| Disciplina | Frequência | Observação |<br>|---|---|---|<br>| Oração | Diária | Manhã e noite |<br>| Jejum | Semanal | Quarta-feira |'),
  block('section', 'Conclusão'),
  block('text', 'Quem permanece, frutifica. Visite <a href="https://www.exemplo.org">o site</a> da igreja.'),
];

const SERMON_LAYOUT = () => layout('pregacao', 'mensagem-completa', { author: 'Pr. Autor de Teste', header: 'Igreja de Teste', footer: 'Hub Bible' });

/* --------------------------------- testes ------------------------------- */

await test('leitura do HTML: ênfase, cor, link, lista, quebra e entidades', () => {
  const segs = parseBlockHtml('<p>Um <b>dois</b> <i>três</i> &amp; <span style="color: rgb(178, 58, 53)">cor</span><br>linha&nbsp;2</p><ul><li>a</li><li><b>b</b></li></ul><a href="https://x.org">link</a>');
  assert(segs.length === 3, `esperava 3 segmentos, veio ${segs.length}`);
  const [p, list, last] = segs;
  assert(p.kind === 'para' && plainOf(p.runs) === 'Um dois três & cor\nlinha 2', `texto: ${JSON.stringify(p.kind === 'para' && plainOf(p.runs))}`);
  assert(p.kind === 'para' && p.runs.some((r) => r.bold && r.text === 'dois'), 'negrito perdido');
  assert(p.kind === 'para' && p.runs.some((r) => r.color === 'B23A35'), 'cor perdida');
  assert(list.kind === 'list' && list.items.length === 2 && list.items[1][0].bold, 'lista perdida');
  assert(last.kind === 'para' && last.runs[0].link === 'https://x.org', 'link perdido');
  // marcação que não é permitida não executa nada e o texto permanece
  const evil = parseBlockHtml('<script>alert(1)</script><img src=x onerror=alert(1)>texto');
  assert(evil.length === 1 && evil[0].kind === 'para' && plainOf(evil[0].runs).includes('texto'), 'texto do HTML estranho');
});

await test('tabela escrita com | vira tabela', () => {
  const t = tableFrom([{ text: '| A | B |' }, { text: '\n' }, { text: '|---|---|' }, { text: '\n' }, { text: '| 1 | 2 |' }]);
  assert(t && t.length === 2 && t[1][1] === '2', JSON.stringify(t));
  assert(!tableFrom([{ text: 'texto comum | com barra' }]), 'texto comum virou tabela');
});

await test('nome de arquivo seguro preserva acentos', () => {
  const name = safeFileName('Mensagem: "A Videira" / João 15?', 2, 'pdf');
  assert(name === 'Mensagem A Videira João 15 - v2.pdf', name);
  assert(safeFileName('   ', 1, 'docx') === 'Documento - v1.docx', 'nome vazio');
});

await test('Material com marcação (#, -, >) vira seções, listas e destaques', () => {
  const blocks = markdownishToBlocks('# Módulo 1\nTexto do módulo.\n\n- item um\n- item dois\n\n> Destaque\n## Módulo 2\nMais texto.');
  const types = blocks.map((b) => b.type).join(',');
  assert(types === 'section,text,list,highlight,section,text', types);
});

let sermonDoc: RenderDoc;
await test('Pregação → Word: abre, tem estilos de título, tabela, listas e acentos', async () => {
  sermonDoc = buildRenderDoc({ title: 'A Videira Verdadeira', content: sermonContent, structure: { pageBreaks: [], subheadings: [] }, layout: SERMON_LAYOUT() });
  const blob = await buildDocx(sermonDoc);
  await save('pregacao.docx', blob);
  const check = await validateFile(blob, 'docx');
  assert(check.ok, check.reason ?? '');
  const { text, xml, zip } = await docxText(blob);
  for (const expected of ['A Videira Verdadeira', 'Eu sou a videira', 'João 15:5', ACENTOS, 'Oração constante', 'Quarta-feira', 'Quem permanece, frutifica.']) {
    assert(norm(text).includes(norm(expected)), `faltou no Word: ${expected}`);
  }
  assert(xml.includes('w:pStyle w:val="Heading1"'), 'sem estilo Título 1 (necessário para o sumário)');
  assert(xml.includes('<w:tbl>'), 'sem tabela');
  assert(xml.includes('w:numPr'), 'sem listas numeradas/marcadores');
  assert(xml.includes('B23A35'), 'cor do texto perdida');
  assert(Object.keys(zip.files).some((f) => f.startsWith('word/header')), 'sem cabeçalho');
  assert(Object.keys(zip.files).some((f) => f.startsWith('word/footer')), 'sem rodapé');
  const footer = await zip.file(Object.keys(zip.files).find((f) => f.startsWith('word/footer'))!)!.async('string');
  assert(footer.includes('PAGE'), 'rodapé sem número de página');
  const rels = await zip.file('word/_rels/document.xml.rels')!.async('string');
  assert(rels.includes('https://www.exemplo.org'), 'link perdido');
});

await test('Pregação → PDF: abre no pdf.js, texto completo com acentos e referências', async () => {
  const blob = await pdfBlob(sermonDoc);
  await save('pregacao.pdf', blob);
  const check = await validateFile(blob, 'pdf');
  assert(check.ok, check.reason ?? '');
  const pages = await pdfPages(blob);
  assert(pages.length === check.pages, `contagem de páginas diverge: ${pages.length} x ${check.pages}`);
  const all = norm(pages.join(' '));
  for (const expected of ['A Videira Verdadeira', 'Eu sou a videira', 'João 15:5', ACENTOS, 'Oração constante', 'Quarta-feira', 'Quem permanece, frutifica.', 'Igreja de Teste']) {
    assert(all.includes(norm(expected)), `faltou no PDF: ${expected}`);
  }
});

await test('Pregação → Word + PDF da mesma versão: mesmo conteúdo', async () => {
  const [docx, pdf] = [await buildDocx(sermonDoc), await pdfBlob(sermonDoc)];
  const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 3 && !/^\d+$/.test(w)));
  const fromDocx = words((await docxText(docx)).text);
  const fromPdf = words((await pdfPages(pdf)).join(' '));
  const missing = [...fromDocx].filter((w) => !fromPdf.has(w) && !['Hub', 'Bible'].includes(w));
  // palavras partidas por hifenização/quebra de linha no PDF são toleradas, nada além disso
  assert(missing.length <= 2, `palavras do Word ausentes no PDF: ${missing.join(', ')}`);
});

await test('Pregação → Markdown: títulos, citação, lista, tabela e link', async () => {
  const md = buildMarkdown(sermonDoc);
  writeFileSync(join(OUT, 'pregacao.md'), md);
  const check = await validateFile(new Blob([md]), 'md');
  assert(check.ok, check.reason ?? '');
  for (const expected of ['# A Videira Verdadeira', '## Introdução', '> — João 15:5', '- Oração constante', '1. Primeiro passo', '| Disciplina | Frequência | Observação |', '| --- | --- | --- |', '[o site](https://www.exemplo.org)', '**comunhão**']) {
    assert(md.includes(expected), `faltou no Markdown: ${expected}`);
  }
});

await test('Devocional com espaço para anotações (Word e PDF)', async () => {
  const doc = buildRenderDoc({
    title: 'Devocional — Dia 1',
    content: [
      block('section', 'Texto bíblico'),
      block('scripture', 'O Senhor é o meu pastor; nada me faltará.', 'Salmos 23:1'),
      block('section', 'Reflexão'),
      block('text', 'Deus cuida de cada detalhe da nossa vida.'),
      block('section', 'Oração'),
      block('text', 'Senhor, ensina-me a confiar.'),
    ],
    structure: { pageBreaks: [], subheadings: [] },
    layout: layout('devocional', 'diario', { dateLabel: '12 de outubro de 2026' }),
  });
  assert(doc.layout.notesSpace, 'o modelo diário deveria trazer espaço para anotações');
  const pdf = await pdfBlob(doc);
  await save('devocional.pdf', pdf);
  const docx = await buildDocx(doc);
  await save('devocional.docx', docx);
  assert((await validateFile(docx, 'docx')).ok, 'Word inválido');
  const text = norm((await pdfPages(pdf)).join(' '));
  for (const expected of ['Devocional — Dia 1', 'Salmos 23:1', 'Anotações', '12 de outubro de 2026']) {
    assert(text.includes(expected), `faltou: ${expected}`);
  }
});

await test('Apostila com vários capítulos: capa, sumário com páginas corretas e quebras', async () => {
  const content: SermonBlock[] = [];
  const paragraph = 'O discipulado é o processo pelo qual a vida de Cristo é formada em nós, pela Palavra e pelo Espírito, na comunhão da igreja. ';
  for (let c = 1; c <= 6; c++) {
    content.push(block('section', `Módulo ${c}: Fundamentos da fé — parte ${c}`));
    for (let p = 0; p < 5; p++) content.push(block('text', paragraph.repeat(4)));
    const sub = block('section', `Exercícios do módulo ${c}`);
    content.push(sub);
    content.push(block('list', '<ol><li>Leia Romanos 12.</li><li>Anote o que aprendeu.</li></ol>'));
  }
  const subs = content.filter((b) => b.type === 'section' && b.html.startsWith('Exercícios')).map((b) => b.id);
  const doc = buildRenderDoc({
    title: 'Apostila de Discipulado',
    content,
    structure: { pageBreaks: [], subheadings: subs },
    layout: layout('treinamento', 'apostila', { subtitle: 'Material do participante', author: 'Ministério de Ensino', institution: 'Igreja Local' }),
  });
  assert(doc.layout.cover && doc.layout.toc && doc.layout.breakBeforeSections, 'padrões da apostila');
  const pdf = await pdfBlob(doc);
  await save('apostila.pdf', pdf);
  const pages = await pdfPages(pdf);
  assert(pages.length >= 8, `poucas páginas: ${pages.length}`);
  assert(pages[0].includes('Apostila de Discipulado') && pages[0].includes('Igreja Local'), 'capa');
  assert(!/\b1\b\s*$/.test(pages[0].trim()), 'a capa não deve ter número de página');
  assert(pages[1].includes('Sumário'), 'sumário na página 2');
  // cada módulo começa em página nova, e o número no sumário é a página onde ele está
  for (let c = 1; c <= 6; c++) {
    const title = `Módulo ${c}: Fundamentos da fé — parte ${c}`;
    const at = pages.findIndex((p, i) => i > 1 && norm(p).includes(title));
    assert(at > 1, `módulo ${c} não encontrado`);
    assert(norm(pages[at]).trimStart().startsWith(title) || norm(pages[at]).includes(title), `módulo ${c}`);
    const tocLine = new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)`);
    const m = tocLine.exec(norm(pages[1]));
    assert(m && Number(m[1]) === at + 1, `sumário diz página ${m?.[1]} para o módulo ${c}, que está na ${at + 1}`);
  }
  const docx = await buildDocx(doc);
  await save('apostila.docx', docx);
  const { xml } = await docxText(docx);
  assert(xml.includes('PAGEREF _Toc_hub_0') && xml.includes('w:bookmarkStart'), 'Word sem sumário com referências de página');
  assert(xml.includes('w:pageBreakBefore'), 'Word sem quebra de página antes das seções');
  assert(xml.includes('Heading2'), 'Word sem subtítulos (nível 2)');
  const settings = await (await JSZip.loadAsync(new Uint8Array(await docx.arrayBuffer()))).file('word/settings.xml')!.async('string');
  assert(settings.includes('updateFields'), 'Word não pede para atualizar o sumário ao abrir');
});

await test('Documento longo: sem truncamento no fim (PDF e Word)', async () => {
  const content: SermonBlock[] = [];
  for (let i = 1; i <= 120; i++) content.push(block('text', `Parágrafo número ${i}: a graça de Deus se manifestou, trazendo salvação a todos os homens.`));
  content.push(block('text', 'ÚLTIMA LINHA DO DOCUMENTO — fim.'));
  const doc = buildRenderDoc({ title: 'Documento longo', content, structure: { pageBreaks: [], subheadings: [] }, layout: layout('institucional', 'relatorio') });
  const pdf = await pdfBlob(doc);
  await save('longo.pdf', pdf);
  const pages = await pdfPages(pdf);
  assert(pages.length >= 4, `esperava várias páginas, veio ${pages.length}`);
  const all = norm(pages.join(' '));
  assert(all.includes('Parágrafo número 120') && all.includes('ÚLTIMA LINHA DO DOCUMENTO — fim.'), 'PDF truncado');
  const { text } = await docxText(await buildDocx(doc));
  assert(norm(text).includes('ÚLTIMA LINHA DO DOCUMENTO — fim.'), 'Word truncado');
});

await test('Logotipo na capa (PNG) entra no Word e no PDF', async () => {
  // PNG 2x2 válido
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';
  const doc = buildRenderDoc({
    title: 'Com logotipo',
    content: [block('text', 'Conteúdo.')],
    structure: { pageBreaks: [], subheadings: [] },
    layout: layout('treinamento', 'apostila', { logo: { dataUrl: png, mime: 'image/png', width: 2, height: 2 } }),
  });
  const docx = await buildDocx(doc);
  const zip = await JSZip.loadAsync(new Uint8Array(await docx.arrayBuffer()));
  assert(Object.keys(zip.files).some((f) => f.startsWith('word/media/')), 'imagem ausente no Word');
  const pdf = await pdfBlob(doc);
  assert((await validateFile(pdf, 'pdf')).ok, 'PDF com imagem inválido');
  assert(new TextDecoder('latin1').decode(new Uint8Array(await pdf.arrayBuffer())).includes('/Subtype /Image'), 'imagem ausente no PDF');
});

await test('Arquivo corrompido ou vazio não passa na conferência', async () => {
  assert(!(await validateFile(new Blob([]), 'pdf')).ok, 'vazio passou');
  assert(!(await validateFile(new Blob(['%PDF-1.7 sem fim']), 'pdf')).ok, 'PDF sem %%EOF passou');
  assert(!(await validateFile(new Blob(['não é zip']), 'docx')).ok, 'docx falso passou');
  assert(!(await validateFile(new Blob(['   ']), 'md')).ok, 'md vazio passou');
});

/* --------------------------- camada de dados --------------------------- */

await test('Fluxo completo: origem → rascunho → aprovar → gerar → editar → nova versão → restaurar', async () => {
  const t = Date.now();
  const sermon: Sermon = {
    id: 'srm_teste',
    userId: 'local',
    title: 'Fé que Vence',
    theme: 'Vitória pela fé',
    mainText: '',
    date: '2026-10-11',
    category: 'Fé',
    introduction: '',
    development: '',
    conclusion: '',
    application: '',
    notes: '',
    tags: [],
    createdAt: t,
    updatedAt: t,
    content: [block('section', 'Introdução'), block('text', 'Todo o que é nascido de Deus vence o mundo.'), block('scripture', 'Esta é a vitória que vence o mundo: a nossa fé.', '1 João 5:4')],
  };
  await db.sermons.put(sermon);

  let doc = await createExportDoc({ category: 'pregacao', model: 'mensagem-completa', sourceKind: 'sermon', sourceId: sermon.id });
  assert(doc.title === 'Fé que Vence' && doc.status === 'rascunho', 'documento novo');
  assert(doc.layout.subtitle === 'Vitória pela fé', 'subtítulo sugerido do tema');
  assert(doc.content.length === 3 && doc.original.length === 3, 'conteúdo da origem');
  // a origem não é alterada pela exportação
  await saveDraft(doc.id, { content: [...doc.content, block('text', 'Acréscimo na revisão.')] });
  assert((await db.sermons.get(sermon.id))!.content!.length === 3, 'a origem foi alterada!');

  // gerar sem aprovar é recusado
  let refused = false;
  try {
    await generateFiles(doc.id, ['docx']);
  } catch {
    refused = true;
  }
  assert(refused, 'gerou sem versão aprovada');

  const v1 = await approveVersion(doc.id);
  assert(v1.version.version === 1 && v1.doc.status === 'aprovado', 'aprovação v1');
  const again = await approveVersion(doc.id);
  assert(again.version.id === v1.version.id, 'aprovar o mesmo conteúdo criou versão repetida');

  const gen = await generateFiles(doc.id, ['docx', 'md']);
  assert(gen.files.every((f) => f.ok && f.file), `geração: ${JSON.stringify(gen.files.map((f) => f.error ?? f.storeError))}`);
  doc = (await getExportDoc(doc.id))!;
  assert(doc.status === 'finalizado' && doc.formats.includes('docx') && doc.formats.includes('md'), `situação ${doc.status}`);
  const stored = await listFiles(doc.id);
  assert(stored.length === 2 && stored.every((f) => f.version === 1 && f.size > 0 && f.blob.size === f.size), 'arquivos guardados');
  const docxStored = stored.find((f) => f.format === 'docx')!;
  assert(docxStored.filename === 'Fé que Vence - v1.docx', docxStored.filename);
  const { text } = await docxText(docxStored.blob);
  assert(text.includes('Acréscimo na revisão.') && text.includes('1 João 5:4'), 'o arquivo guardado não corresponde à versão aprovada');

  // editar depois de aprovar volta a rascunho; os arquivos continuam da v1
  doc = await saveDraft(doc.id, { title: 'Fé que Vence (revisado)' });
  assert(doc.status === 'rascunho', 'editar após aprovar deveria voltar a rascunho');
  const v2 = await approveVersion(doc.id);
  assert(v2.version.version === 2, 'v2');
  const gen2 = await generateFiles(doc.id, ['md']);
  assert(gen2.files[0].file?.filename === 'Fé que Vence (revisado) - v2.md', gen2.files[0].file?.filename ?? 'sem arquivo');
  assert((await listVersions(doc.id)).map((v) => v.version).join(',') === '2,1', 'histórico de versões');

  doc = await restoreVersion(doc.id, v1.version.id);
  assert(doc.title === 'Fé que Vence' && doc.status === 'rascunho', 'restaurar v1');
  doc = await restoreOriginal(doc.id);
  assert(doc.content.length === 3, 'restaurar o original');

  const copy = await duplicateExportDoc(doc.id);
  assert(copy.id !== doc.id && copy.versionCount === 0 && copy.status === 'rascunho', 'duplicar');

  // biblioteca: pesquisa, filtros e isolamento do usuário local
  await db.exportDocs.put({ ...copy, id: 'exp_outro_usuario', userId: 'outra-pessoa', title: 'Privado de outra pessoa' });
  const rows = await loadExportLibrary();
  assert(!rows.some((r) => r.doc.userId !== 'local'), 'a biblioteca mostrou documento de outro usuário');
  const found = filterExportLibrary(rows, { query: 'fe que', category: 'pregacao', status: 'todos', days: 30 });
  assert(found.length === 2, `pesquisa sem acento: ${found.length}`);
  assert(filterExportLibrary(rows, { query: '', category: 'devocional', status: 'todos', days: 0 }).length === 0, 'filtro por categoria');

  await deleteExportDoc(doc.id);
  assert(!(await getExportDoc(doc.id)) && (await listFiles(doc.id)).length === 0 && (await listVersions(doc.id)).length === 0, 'exclusão completa');

  // o registro operacional não guarda o texto do documento
  const log = JSON.stringify(await readExportLog());
  assert(log.length > 2 && !log.includes('vence o mundo'), 'registro operacional');
});

await test('Falha ao guardar: o arquivo continua disponível e o erro é informado', async () => {
  const doc = await createExportDoc({ category: 'institucional', model: 'comunicado', sourceKind: 'blank', title: 'Comunicado' });
  await saveDraft(doc.id, { content: [block('text', 'Aviso importante à igreja.')] });
  await approveVersion(doc.id);
  const original = db.exportFiles.put.bind(db.exportFiles);
  (db.exportFiles as unknown as { put: unknown }).put = () => Promise.reject(Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' }));
  try {
    const gen = await generateFiles(doc.id, ['md']);
    const f = gen.files[0];
    assert(f.ok && f.blob && !f.file && f.storeError?.includes('espaço'), JSON.stringify({ ok: f.ok, storeError: f.storeError }));
    assert((await getExportDoc(doc.id))!.status === 'aprovado', 'não pode marcar como finalizado sem guardar');
  } finally {
    (db.exportFiles as unknown as { put: unknown }).put = original;
  }
});

await test('Documento sem título ou vazio não é aprovado', async () => {
  const doc = await createExportDoc({ category: 'institucional', model: 'carta', sourceKind: 'blank', title: 'Carta' });
  let msg = '';
  try {
    await approveVersion(doc.id);
  } catch (err) {
    msg = (err as Error).message;
  }
  assert(msg.includes('sem conteúdo'), msg);
});

/* ------------------------------- Fase 3 ------------------------------- */

await test('Instrutor e participante: a versão do participante tira só as partes do instrutor', () => {
  const a = block('section', 'Abertura');
  const b = block('section', 'Notas do instrutor');
  const c = block('section', 'Como conduzir');
  const d = block('section', 'Lição');
  const content = [a, block('text', 'Bem-vindos.'), b, block('text', 'Chegue 15 minutos antes.'), c, block('text', 'Divida em grupos.'), d, block('text', 'Texto da lição.')];
  const structure = { pageBreaks: [], subheadings: [c.id], instructorOnly: [b.id] };
  const part = contentForEdition(content, structure, 'participante').map((x) => x.html).join('|');
  assert(part === 'Abertura|Bem-vindos.|Lição|Texto da lição.', part);
  assert(contentForEdition(content, structure, 'instrutor').length === content.length, 'instrutor tem tudo');
  // subtítulo marcado só some ele e o que vem abaixo dele, até a próxima seção
  const onlySub = contentForEdition(content, { pageBreaks: [], subheadings: [c.id], instructorOnly: [c.id] }, 'participante').map((x) => x.html);
  assert(!onlySub.includes('Divida em grupos.') && onlySub.includes('Lição') && onlySub.includes('Chegue 15 minutos antes.'), onlySub.join('|'));
});

await test('Plano devocional de 7 dias: vários devocionais num só documento, cada um como um dia', async () => {
  const t = Date.now();
  const ids: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const id = `dev_${i}`;
    ids.push(id);
    await db.devotionals.put({
      id, userId: 'local', title: `Confiança ${i}`, date: '2026-10-1' + i, category: 'Fé', scripture: 'Salmos 23:1',
      reflection: `Reflexão do dia ${i}.`, application: '', prayer: `Oração ${i}.`, notes: '', tags: [], createdAt: t, updatedAt: t,
    });
  }
  const doc = await createExportDoc({ category: 'devocional', model: 'plano-7', sourceKind: 'compiled', sources: ids.map((id) => ({ kind: 'devotional', id })), title: 'Sete dias de confiança' });
  const titles = doc.content.filter((b) => b.type === 'section' && !doc.structure.subheadings.includes(b.id)).map((b) => b.html);
  assert(titles.join('|') === 'Dia 1 — Confiança 1|Dia 2 — Confiança 2|Dia 3 — Confiança 3', titles.join('|'));
  assert(doc.source.kind === 'compiled' && doc.source.parts?.length === 3, 'origens guardadas');
  assert(doc.layout.breakBeforeSections && doc.layout.cover, 'cada dia em página nova, com capa');
  const render = buildRenderDoc({ title: doc.title, content: doc.content, structure: doc.structure, layout: doc.layout });
  const h1 = render.nodes.filter((n) => n.t === 'heading' && n.level === 1).length;
  const h2 = render.nodes.filter((n) => n.t === 'heading' && n.level === 2).length;
  assert(h1 === 3 && h2 >= 6, `títulos ${h1}, subtítulos ${h2}`);
  const pdf = await pdfBlob(render);
  await save('plano-devocional.pdf', pdf);
  const pages = await pdfPages(pdf);
  assert(pages.some((p) => p.includes('Dia 3 — Confiança 3')) && pages.length >= 4, `páginas ${pages.length}`);
  // restaurar o original mantém os subtítulos de cada dia
  await saveDraft(doc.id, { structure: { pageBreaks: [], subheadings: [] } });
  const restored = await restoreOriginal(doc.id);
  assert(restored.structure.subheadings.length === doc.structure.subheadings.length, 'restaurar o compilado');
  let refused = false;
  try {
    await createExportDoc({ category: 'devocional', model: 'plano-7', sourceKind: 'compiled', sources: [{ kind: 'devotional', id: ids[0] }, { kind: 'devotional', id: 'nao-existe' }] });
  } catch {
    refused = true;
  }
  assert(refused, 'origem inexistente deveria ser recusada');
});

await test('Plano de leitura vira documento, semana a semana, com o que já foi lido', async () => {
  const t = Date.now();
  await db.plans.put({
    id: 'pln_teste', userId: 'local', templateId: 'personalizado', name: 'Evangelhos em 10 dias', description: 'Leitura dos Evangelhos.',
    totalDays: 10, days: Array.from({ length: 10 }, (_, i) => ({ day: i + 1, ranges: [['MAT', i * 2 + 1, i * 2 + 2]] as Array<[string, number, number]> })),
    completedDays: [1, 2], startedAt: t, createdAt: t, updatedAt: t,
  });
  const doc = await createExportDoc({ category: 'devocional', model: 'plano-leitura', sourceKind: 'plan', sourceId: 'pln_teste' });
  const render = buildRenderDoc({ title: doc.title, content: doc.content, structure: doc.structure, layout: doc.layout });
  const tables = render.nodes.filter((n): n is Extract<typeof n, { t: 'table' }> => n.t === 'table');
  assert(tables.length === 2, `tabelas ${tables.length}`);
  assert(tables[0].rows[1].join('|') === '1|Mateus 1-2|✓' && tables[0].rows[3][2] === '☐', JSON.stringify(tables[0].rows.slice(0, 4)));
  assert(tables[1].rows.length === 4, 'segunda semana com 3 dias + cabeçalho');
  const docx = await buildDocx(render);
  assert((await docxText(docx)).text.includes('Mateus 19-20'), 'último dia no Word');
});

await test('Gerar com divisão: um arquivo do instrutor e um do participante', async () => {
  const doc = await createExportDoc({ category: 'treinamento', model: 'apostila', sourceKind: 'blank', title: 'Treinamento de líderes' });
  const intro = block('section', 'Introdução');
  const notes = block('section', 'Orientações ao instrutor');
  const content = [intro, block('text', 'Bem-vindos ao treinamento.'), notes, block('text', 'Resposta esperada: graça.')];
  await saveDraft(doc.id, { content, structure: { pageBreaks: [], subheadings: [], instructorOnly: [notes.id] } });
  await approveVersion(doc.id);
  const gen = await generateFiles(doc.id, ['md']);
  assert(gen.files.length === 2 && gen.files.every((f) => f.ok && f.file), JSON.stringify(gen.files.map((f) => [f.edition, f.error])));
  const names = gen.files.map((f) => f.filename).sort().join('|');
  assert(names === 'Treinamento de líderes - v1 - instrutor.md|Treinamento de líderes - v1 - participante.md', names);
  const participante = await gen.files.find((f) => f.edition === 'participante')!.blob!.text();
  const instrutor = await gen.files.find((f) => f.edition === 'instrutor')!.blob!.text();
  assert(!participante.includes('Resposta esperada') && instrutor.includes('Resposta esperada'), 'conteúdo das versões');
  const only = await generateFiles(doc.id, ['md'], undefined, ['participante']);
  assert(only.files.length === 1 && only.files[0].edition === 'participante', 'só a versão do participante');
});

console.log(results.join('\n'));
console.log(`\n${passed} aprovados, ${failed} reprovados. Arquivos em ${OUT}`);
if (failed) process.exit(1);
