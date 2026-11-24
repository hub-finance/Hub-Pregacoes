/**
 * Leitura de PDF e Word para o Assistente bíblico.
 *
 * A mesma leitura do Hub Resumos (`hub-resumos/src/core/importers.ts` e
 * `text.ts`), copiada e não importada: os dois apps precisam funcionar
 * sozinhos. PDF pelos marcadores do livro, pelo sumário ou pelos títulos;
 * Word pelos estilos de título. Tudo acontece no aparelho — o arquivo não
 * vai a lugar nenhum, e o conteúdo é tratado só como texto.
 *
 * Ao corrigir algo aqui, vale olhar o mesmo trecho no Hub Resumos.
 */

import { parseReference } from '../bible/reference';

export const MAX_MATERIAL_BYTES = 30 * 1024 * 1024;

export interface MaterialPart {
  title: string;
  text: string;
}
type Part = MaterialPart;

const fold = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const countWords = (text: string) => (text.match(/[\p{L}\d]+/gu) ?? []).length;

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/**
 * Word: lê `word/document.xml` direto do pacote. Títulos (estilos Título /
 * Heading) viram `# `, itens de lista viram `- `, e o resto, parágrafos.
 */
export async function docxToText(data: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('O arquivo do Word não tem o documento principal.');
  const lines: string[] = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    const style = /<w:pStyle w:val="([^"]+)"/.exec(p)?.[1] ?? '';
    const text = decodeXml(
      (p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
        .map((t) => (t === '<w:tab/>' ? '\t' : t === '<w:br/>' ? '\n' : t.replace(/<[^>]+>/g, '')))
        .join(''),
    ).trim();
    if (!text) {
      lines.push('');
      continue;
    }
    // "Heading1" no Word em inglês; "Ttulo1" (o í some no id do estilo) no português
    if (/^(heading|title|t[ií]?tulo)/i.test(style)) lines.push(`# ${text}`);
    else if (/<w:numPr>/.test(p)) lines.push(`- ${text}`);
    else lines.push(text, '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * PDF: o texto de cada página, reconstruído em linhas pela posição. PDF
 * escaneado (só imagem) não tem texto — aí a mensagem diz isso.
 */
const foldTitle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Itens dos marcadores que não são capítulo. */
const NOT_CHAPTER = /^(capa|sum[aá]rio|[ií]ndice|cr[eé]ditos|copyright|ficha catalogr[aá]fica|folha de rosto|p[aá]gina de rosto|outras obras|sobre o autor)$/i;

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
}

/* ───────────── Word antigo (.doc, Word 97–2003) ─────────────
 * Muitos e-books evangélicos ainda circulam em .doc. O arquivo é um "Compound
 * File" (uma espécie de disco dentro do arquivo); o texto fica no fluxo
 * WordDocument, em pedaços descritos pela tabela de peças (Clx) do fluxo
 * 0Table/1Table. Lemos só o texto — sem formatação —, que é o que o
 * assistente usa. */

function readCompoundFile(data: ArrayBuffer): Map<string, Uint8Array> {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  if (view.getUint32(0, true) !== 0xe011cfd0 || view.getUint32(4, true) !== 0xe11ab1a1) {
    throw new Error('Este .doc não é um arquivo do Word reconhecível.');
  }
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const miniSize = 1 << view.getUint16(0x20, true);
  const sectorAt = (n: number) => (n + 1) * sectorSize;
  const u32 = (off: number) => view.getUint32(off, true);
  // a FAT: lista de setores, a partir da DIFAT (109 no cabeçalho + encadeados)
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sct = u32(0x4c + i * 4);
    if (sct < 0xfffffffa) fatSectors.push(sct);
  }
  let difat = u32(0x44);
  for (let guard = 0; difat < 0xfffffffa && guard < 10000; guard++) {
    const base = sectorAt(difat);
    for (let i = 0; i < sectorSize / 4 - 1; i++) {
      const sct = u32(base + i * 4);
      if (sct < 0xfffffffa) fatSectors.push(sct);
    }
    difat = u32(base + sectorSize - 4);
  }
  const fat: number[] = [];
  for (const sct of fatSectors) {
    const base = sectorAt(sct);
    for (let i = 0; i < sectorSize / 4; i++) fat.push(u32(base + i * 4));
  }
  const chain = (start: number, table: number[]) => {
    const out: number[] = [];
    for (let n = start; n < 0xfffffffa && out.length <= table.length; n = table[n]) out.push(n);
    return out;
  };
  const readChain = (start: number) => {
    const list = chain(start, fat);
    const out = new Uint8Array(list.length * sectorSize);
    list.forEach((n, i) => out.set(bytes.subarray(sectorAt(n), sectorAt(n) + sectorSize), i * sectorSize));
    return out;
  };
  const dir = readChain(u32(0x30));
  const dv = new DataView(dir.buffer);
  const entries: Array<{ name: string; type: number; start: number; size: number }> = [];
  for (let off = 0; off + 128 <= dir.length; off += 128) {
    const len = dv.getUint16(off + 0x40, true);
    const name = String.fromCharCode(...new Uint16Array(dir.buffer.slice(off, off + Math.max(0, len - 2))));
    entries.push({ name, type: dir[off + 0x42], start: dv.getUint32(off + 0x74, true), size: dv.getUint32(off + 0x78, true) });
  }
  const root = entries[0];
  const cutoff = u32(0x38);
  const miniFatRaw = u32(0x3c) < 0xfffffffa ? readChain(u32(0x3c)) : new Uint8Array();
  const miniFat = Array.from({ length: miniFatRaw.length / 4 }, (_, i) => new DataView(miniFatRaw.buffer).getUint32(i * 4, true));
  const miniStream = root ? readChain(root.start) : new Uint8Array();
  const streams = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (e.type !== 2) continue;
    if (e.size < cutoff) {
      const list = chain(e.start, miniFat);
      const out = new Uint8Array(list.length * miniSize);
      list.forEach((n, i) => out.set(miniStream.subarray(n * miniSize, (n + 1) * miniSize), i * miniSize));
      streams.set(e.name, out.subarray(0, e.size));
    } else {
      streams.set(e.name, readChain(e.start).subarray(0, e.size));
    }
  }
  return streams;
}

export async function docToText(data: ArrayBuffer): Promise<string> {
  const streams = readCompoundFile(data);
  const word = streams.get('WordDocument');
  if (!word) throw new Error('Este .doc não tem o texto do Word.');
  const wv = new DataView(word.buffer, word.byteOffset, word.byteLength);
  const flags = wv.getUint16(0x0a, true);
  if (flags & 0x0100) throw new Error('Este .doc está protegido por senha.');
  const table = streams.get(flags & 0x0200 ? '1Table' : '0Table');
  if (!table) throw new Error('Este .doc não tem a tabela de texto do Word.');
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const fcClx = wv.getUint32(0x01a2, true);
  const lcbClx = wv.getUint32(0x01a6, true);
  // a tabela de peças: pula as entradas de formatação (0x01) até a de texto (0x02)
  let at = fcClx;
  while (at < fcClx + lcbClx && table[at] === 0x01) at += 3 + tv.getUint16(at + 1, true);
  if (table[at] !== 0x02) throw new Error('Não foi possível ler o texto deste .doc.');
  const lcb = tv.getUint32(at + 1, true);
  const plc = at + 5;
  const n = (lcb - 4) / 12;
  const cp1252 = new TextDecoder('windows-1252');
  const utf16 = new TextDecoder('utf-16le');
  let text = '';
  for (let i = 0; i < n; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true);
    const cpEnd = tv.getUint32(plc + (i + 1) * 4, true);
    const fcRaw = tv.getUint32(plc + (n + 1) * 4 + i * 8 + 2, true);
    const chars = cpEnd - cpStart;
    if (fcRaw & 0x40000000) {
      const fc = (fcRaw & ~0x40000000) / 2;
      text += cp1252.decode(word.subarray(fc, fc + chars));
    } else {
      text += utf16.decode(word.subarray(fcRaw, fcRaw + chars * 2));
    }
  }
  // só o corpo do documento (sem notas, cabeçalhos e comentários, que vêm depois)
  const ccpText = wv.getUint32(0x004c, true);
  if (ccpText > 0 && ccpText < text.length) text = text.slice(0, ccpText);
  return text
    // campos do Word: {código \x14 resultado} — fica só o resultado
    .replace(/\x13[^\x13\x14\x15]*\x14([^\x13\x15]*)\x15/g, '$1')
    .replace(/\x13[^\x13\x15]*\x15/g, '')
    .replace(/\r|\x07/g, '\n')
    .replace(/[\x0b\x0c\x0e]/g, '\n')
    .replace(/[\x00-\x08\x10-\x1f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Os marcadores do PDF, com a página de cada um. Quando o primeiro nível
 * tem só o título do livro, usa os itens de dentro dele.
 */
async function outlineMarks(pdf: {
  getOutline(): Promise<OutlineNode[] | null>;
  getDestination(id: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
}): Promise<Array<{ page: number; title: string }>> {
  let items = (await pdf.getOutline()) ?? [];
  if (items.length < 3 && items.length && (items[0].items?.length ?? 0) >= 3) items = items[0].items!;
  const marks: Array<{ page: number; title: string }> = [];
  for (const item of items) {
    const title = item.title.replace(/\s+/g, ' ').trim();
    if (!title || NOT_CHAPTER.test(title)) continue;
    const dest = typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
    if (!Array.isArray(dest) || dest[0] == null) continue;
    const page = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
    if (!marks.length || page >= marks[marks.length - 1].page) marks.push({ page, title });
  }
  return marks;
}

/** Chave de comparação de cabeçalho: sem acento, sem números (o número da página muda). */
const edgeKey = (line: string) => fold(line).replace(/[\d\s.·|–—-]+/g, ' ').trim();
const EDGE = 3;
/** Linha de sumário: "12. Sabedoria … 271", com a linha pontilhada até o número. */
const TOC_LINE = /(?:[.·…_]\s?){4,}\s*\d{1,4}\s*$/;

/**
 * Cabeçalhos e rodapés que se repetem pelas páginas ("DOUTRINAS BÁSICAS DA
 * BÍBLIA 148…", "FERRAMENTA BÁSICA: UMA BOA TRADUÇÃO 45", o número solto da
 * página). Se ficassem, viravam títulos de parte falsos ou entravam no meio
 * das frases — e às vezes trazem o nome de quem fez o material, que nunca
 * pode aparecer no que o assistente escreve. Só sai a linha da borda da
 * página que (a) é só número, ou (b) se repete e traz número de página, ou
 * (c) se repete em boa parte do livro. O título de um capítulo, que aparece
 * sem número no começo dele, fica.
 */
export function stripRunningLines(pages: string[][]): string[][] {
  if (pages.length < 4) return pages;
  const seen = new Map<string, number>();
  const first = new Map<string, number>();
  const edges = (lines: string[]) => {
    const idx = lines.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
    return [...new Set([...idx.slice(0, EDGE), ...idx.slice(-EDGE)])];
  };
  pages.forEach((lines, page) => {
    const keys = new Set(edges(lines).map((i) => edgeKey(lines[i])).filter((k) => k.length >= 3));
    for (const k of keys) {
      seen.set(k, (seen.get(k) ?? 0) + 1);
      if (!first.has(k)) first.set(k, page);
    }
  });
  const wide = Math.max(3, Math.floor(pages.length * 0.3));
  return pages.map((lines, page) => {
    const drop = new Set<number>();
    for (const i of edges(lines)) {
      const t = lines[i].trim();
      // a entrada do sumário tem o mesmo texto do cabeçalho do capítulo — fica
      if (TOC_LINE.test(t)) continue;
      if (/^\d{1,4}$/.test(t)) {
        drop.add(i);
        continue;
      }
      const key = edgeKey(t);
      const n = seen.get(key) ?? 0;
      // a primeira vez, sem número de página, é o título do capítulo: fica
      if (!/\d/.test(t) && first.get(key) === page) continue;
      if ((n >= 3 && /\d/.test(t) && t.length <= 120) || n >= wide) drop.add(i);
    }
    return lines.filter((_, i) => !drop.has(i));
  });
}

/**
 * Erros típicos de livro escaneado (OCR) que atrapalham achar os versículos e
 * ler as frases: "SI 111.10" (Sl), "lCoríntios"/"lC o" (1Co), "M t 5.17",
 * "E f 2.8" e a letra maiúscula descolada da palavra ("D o mesmo", "S eletividade").
 * A abreviatura só é colada se virar uma referência que existe.
 */
const ROMAN: Record<string, string> = { I: '1', II: '2', III: '3' };

/**
 * Referências escritas à moda antiga: "Romanos 5. 17", "I Coríntios 14. 14",
 * "II Reis 2:9", "I Jo. 4. 4". Viram "Romanos 5.17", "1 Coríntios 14.14"… só
 * quando o resultado é uma referência que existe — "Capítulo I. 3 pontos"
 * fica como está.
 */
export function normalizeReferences(text: string): string {
  return text.replace(
    /(^|[^\p{L}\d])(?:(I{1,3}|[1-3])\s?)?(\p{Lu}[\p{Ll}\p{Lu}]{1,14}\.?)\s(\d{1,3})(?:([.:])\s(\d{1,3})|(:)(\d{1,3}))/gu,
    (all, pre: string, num: string | undefined, book: string, ch: string, sep1?: string, v1?: string, sep2?: string, v2?: string) => {
      const verse = v1 ?? v2;
      const sep = sep1 ?? sep2;
      const n = num ? (ROMAN[num] ?? num) : '';
      // só mexe se havia algo a consertar: espaço depois do ponto ou número romano
      if (!v1 && !(num && ROMAN[num])) return all;
      const ref = `${n ? `${n} ` : ''}${book.replace(/\.$/, '')} ${ch}:${verse}`;
      if (!parseReference(ref)) return all;
      return `${pre}${n ? `${n} ` : ''}${book} ${ch}${sep === ':' ? ':' : '.'}${verse}`;
    },
  );
}

const LOOSE_CAPITAL = /(^|[^\p{L}])([B-DF-HJ-NP-TV-Z]) (?=\p{Ll})/gu;

export function fixOcr(text: string): string {
  // "Pio X de…" é legítimo: a maiúscula só é colada quando o livro está cheio
  // desse defeito (escaneado), e não em texto limpo
  const loose = (text.match(LOOSE_CAPITAL) ?? []).length;
  const damaged = loose >= 25 && loose * 2000 >= countWords(text);
  const fixed = text
    .replace(/\bSI (?=\d{1,3}[.:,]\d)/g, 'Sl ')
    .replace(/(^|[\s(;—–-])l(?=\s?(?:C\s?o|Co|Cor|Cr|Jo|Pe|Rs|Sm|Tm|Ts|Re)\b|Cor[ií]ntios|Tessalonicenses|Tim[oó]teo|Pedro|Jo[aã]o|Reis|Samuel|Cr[oô]nicas)/g, '$11')
    .replace(/(^|[^\p{L}])([1-3]?\p{Lu}) (\p{Ll}{1,2})\.? ?(\d{1,3}[.:]\d{1,3})/gu, (all, pre: string, a: string, b: string, cv: string) =>
      parseReference(`${a}${b} ${cv.replace('.', ':')}`) ? `${pre}${a}${b} ${cv}` : all,
    );
  return damaged ? fixed.replace(LOOSE_CAPITAL, '$1$2') : fixed;
}

export async function pdfToText(data: ArrayBuffer, onPage?: (page: number, total: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  let pages: string[] = [];
  const raw: string[][] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      onPage?.(i, pdf.numPages);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        line += item.str ?? '';
        if (item.hasEOL) {
          lines.push(line.trimEnd());
          line = '';
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      raw.push(lines);
    }
    // linhas quebradas no meio da frase voltam a formar o parágrafo
    pages = stripRunningLines(raw).map((lines) =>
      lines
        // a entrada do sumário não se emenda à de baixo, mesmo que ela comece
        // com minúscula (o escaneado lê "Índices" como "índices")
        .map((l) => (TOC_LINE.test(l) ? `${l}\n` : l))
        .join('\n')
        .replace(/-\n(?=\p{Ll})/gu, '')
        .replace(/([^\n.!?:;])\n(?=\p{Ll})/gu, '$1 '),
    );
    // os marcadores do PDF (o índice clicável do livro) dizem onde cada capítulo começa
    const marks = await outlineMarks(pdf).catch(() => []);
    if (marks.length >= 3) {
      for (const m of [...marks].reverse()) {
        // tira o título repetido no alto da página, que já vira o título da parte
        const body = pages[m.page].split('\n');
        const k = body.findIndex((l) => l.trim());
        if (k >= 0 && foldTitle(body[k]) === foldTitle(m.title)) body.splice(k, 1);
        pages[m.page] = `# ${m.title}\n${body.join('\n')}`;
      }
      // capa, ficha catalográfica e sumário (antes do primeiro capítulo) ficam de fora
      pages.splice(0, marks[0].page);
    }
  } finally {
    await pdf.destroy();
  }
  const text = fixOcr(pages.join('\n\n').trim());
  if (!text) throw new Error('Este PDF não tem texto (provavelmente é digitalizado como imagem).');
  return text;
}


/** Comparação de títulos: sem acento, sem pontuação, sem "Capítulo 3"/"1." na frente. */
function titleKey(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(capitulo|cap|licao|modulo|parte|aula|unidade|secao|seccao|sessao|topico|livro)\s+[0-9ivxlc]+\s*/, '')
    .replace(/^[0-9ivxlc]{1,4}\s+/, '')
    .trim();
}

const TOC_HEAD = /^(sum[aá]rio|[ií]ndice|conte[uú]do|contents)$/i;
/** "1. A lei do limite ........ 15" → "1. A lei do limite" (sem os pontos e o número da página). */
const tocEntry = (line: string) => line.replace(/[\s.·…_–-]*\d{1,4}\s*$/, '').replace(/\s+/g, ' ').trim();
const CHAPTER_NUMBER = /^(cap[ií]tulo|li[cç][aã]o|m[oó]dulo|parte|aula|unidade|se[cç][cç]?[aã]o|sess[aã]o|t[oó]pico|livro)?\s*[\divxlc]{1,4}\.?$/i;
/** Ficha catalográfica, créditos e números soltos não são capítulos. */
const FRONT_MATTER = /isbn|\bcdd\b|\bcdu\b|\bcip\b|cataloga[cç][aã]o|©|copyright|direitos reservados|editora|tradu[cç][aã]o|impress[aã]o|^\d[\d\s./:-]*$|\d{4,}/i;

/**
 * Sumário do próprio livro: a linha "Sumário"/"Índice" e as entradas logo
 * abaixo. Depois, cada entrada é procurada no corpo, na mesma ordem; o
 * livro é dividido onde os capítulos realmente começam. O que vem antes do
 * primeiro capítulo (capa, ficha catalográfica, o próprio sumário) fica de fora.
 */
/** Termina com o número da página: "…… 29", ". . . 7", "Reino 15". */
const HAS_PAGE = /(?:[.·…_–-]\s?){2,}\s*\d{1,4}\s*$|\s\d{1,4}\s*$/;
/** Começa com o número do capítulo: "1. ", "10 ", "3) ". */
const STARTS_NUMBER = /^\d{1,3}[.)]?\s+\S/;

/**
 * Onde começam as entradas do sumário. Pela linha "Sumário"/"Índice" ou,
 * quando ela não veio no texto do PDF, por um bloco de linhas numeradas com o
 * número da página no fim ("1. Origens … 7", "2. Divisão … 29"…), logo no
 * começo do livro.
 */
function tocStart(lines: string[], limit: number): number {
  const head = lines.findIndex((l, i) => i < limit && TOC_HEAD.test(l.trim()));
  if (head >= 0) return head + 1;
  for (let i = 0; i < limit && i < lines.length; i++) {
    const t = lines[i].trim();
    if (!/^1[.)]?\s+\S/.test(t)) continue;
    let numbered = 0;
    let paged = 0;
    for (let j = i, seen = 0; j < lines.length && seen < 60; j++) {
      const u = lines[j].trim();
      if (!u) continue;
      seen++;
      if (u.length > 160) break;
      if (STARTS_NUMBER.test(u)) numbered++;
      if (HAS_PAGE.test(u)) paged++;
    }
    if (numbered >= 3 && paged >= 3) return i;
  }
  return -1;
}

/**
 * Sumário do próprio livro: as entradas logo abaixo de "Sumário"/"Índice"
 * (ou o bloco numerado com páginas). Títulos que são perguntas e títulos
 * quebrados em duas linhas ("4. Fazendo Distinção entre Opressão, /
 * Obsessão e Possessão . . . 83") entram inteiros. Depois, cada entrada é
 * procurada no corpo, na mesma ordem; o livro é dividido onde os capítulos
 * realmente começam. O que vem antes do primeiro capítulo (capa, ficha
 * catalográfica, o próprio sumário) fica de fora.
 */
function readToc(lines: string[]): { entries: string[]; end: number } | null {
  const limit = Math.max(400, Math.floor(lines.length * 0.4));
  const start = tocStart(lines, limit);
  if (start < 0) return null;
  const entries: string[] = [];
  const pages: Array<string | null> = [];
  let misses = 0;
  let end = start - 1;
  let pending = '';
  const push = (raw: string, at: number) => {
    const e = tocEntry(raw);
    if (e.length >= 3 && e.length <= 160 && /\p{L}{2}/u.test(e) && !TOC_HEAD.test(e)) {
      entries.push(e);
      pages.push(/(\d{1,4})\s*$/.exec(raw)?.[1] ?? null);
      end = at;
      misses = 0;
      return true;
    }
    return false;
  };
  for (let j = start; j < lines.length && j < start + 400 && misses < 4; j++) {
    let raw = lines[j].trim();
    if (!raw) continue;
    // o texto corrido começou: o sumário acabou
    if (raw.length > 160) break;
    // o primeiro título do sumário reaparece: é o começo do livro, não outra entrada
    if (entries.length >= 3 && entries.some((x) => titleKey(x) === titleKey(tocEntry(raw)))) break;
    if (pending) {
      // continuação do título da linha anterior (não começa com número)
      if (!STARTS_NUMBER.test(raw)) {
        raw = `${pending} ${raw}`;
        pending = '';
      } else {
        push(pending, j - 1);
        pending = '';
      }
    }
    // sumário numerado ("1.", "2."…): a primeira linha sem número encerra o sumário
    const numbered = entries.filter((x) => STARTS_NUMBER.test(x)).length;
    if (entries.length >= 3 && numbered >= entries.length * 0.7 && !STARTS_NUMBER.test(raw)) break;
    // título numerado sem página: pode continuar na linha de baixo
    if (STARTS_NUMBER.test(raw) && !HAS_PAGE.test(raw)) {
      pending = raw;
      continue;
    }
    if (!push(raw, j)) misses++;
  }
  if (pending) push(pending, end + 1);
  // um título quebrado em duas linhas do sumário, cada uma com a mesma página
  // ("O ESPÍRITO NO INTERIOR: O ESPÍRITO SANTO … 11" / "E O NOVO NASCIMENTO … 11")
  const merged: string[] = [];
  entries.forEach((e, i) => {
    if (i && pages[i] && pages[i] === pages[i - 1]) merged[merged.length - 1] += ` ${e}`;
    else merged.push(e);
  });
  return merged.length >= 3 ? { entries: merged, end } : null;
}

function splitByToc(lines: string[]): Part[] | null {
  const toc = readToc(lines);
  if (!toc) return null;
  const { entries, end } = toc;

  return locateChapters(lines, entries, end + 1);
}

/**
 * Procura cada título no corpo, a partir da linha `from` e na mesma ordem, e
 * divide ali. Aceita o título com ou sem "Capítulo 3"/"3." na frente, em
 * maiúsculas ou não, e quebrado em até três linhas. Só divide se achar a
 * maioria dos títulos.
 */
function locateChapters(lines: string[], entries: string[], from: number): Part[] | null {
  const starts: Array<{ line: number; body: number; title: string }> = [];
  let cursor = from;
  // sem espaços: no livro escaneado a palavra vem partida ("contextual mente",
  // "Isra e l"), no sumário e no título do capítulo, cada um do seu jeito
  const squash = (x: string) => titleKey(x).replace(/ /g, '');
  for (const entry of entries) {
    const key = squash(entry);
    if (key.length < 3) continue;
    for (let k = cursor; k < lines.length; k++) {
      const t = lines[k].trim();
      if (!t || t.length > key.length + 40) continue;
      // o título pode vir quebrado em até quatro linhas
      let body = -1;
      let joined = '';
      let size = 0;
      for (let n = 0; n < 4 && k + n < lines.length; n++) {
        const piece = lines[k + n].trim();
        joined = n ? `${joined} ${piece}` : piece;
        size += piece.length;
        if (n && size > key.length + 40) break;
        const got = squash(joined);
        if (got === key) {
          body = k + n + 1;
          break;
        }
        if (!key.startsWith(got)) break;
      }
      if (body < 0) continue;
      // "CAPÍTULO 1" numa linha e o título na seguinte: o capítulo começa no número
      let line = k;
      for (let b = k - 1; b >= cursor && k - b <= 2; b--) {
        const prev = lines[b].trim();
        if (!prev) continue;
        if (CHAPTER_NUMBER.test(prev)) line = b;
        break;
      }
      starts.push({ line, body, title: entry });
      cursor = body;
      break;
    }
  }
  if (starts.length < 3 || starts.length < entries.length * 0.5) return null;
  return starts.map((s, i) => ({
    title: s.title,
    text: lines.slice(s.body, i + 1 < starts.length ? starts[i + 1].line : lines.length).join('\n'),
  }));
}

/**
 * Texto corrido (colado ou importado) dividido em partes:
 * 1. pelo sumário do livro, quando há um (ver splitByToc);
 * 2. por títulos claros — `# Título` (os marcadores do PDF entram assim) ou
 *    "Capítulo 3 — …", "Seção 2", "Parte I", "Lição 2", "Módulo 1", "Tópico 4";
 * 3. só sem nada disso, por linhas curtas em MAIÚSCULAS — ignorando ficha
 *    catalográfica e cabeçalhos que se repetem em toda página, e juntando à
 *    parte anterior os pedaços pequenos demais para serem capítulo.
 * Sem nenhum título, vira uma parte só.
 */
export function splitIntoSections(text: string, fallbackTitle = 'Conteúdo'): Part[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const clean = (parts: Part[]) =>
    parts
      .map((s) => ({ title: s.title.trim(), text: s.text.replace(/\n{3,}/g, '\n\n').trim() }))
      .filter((s, _, all) => s.text || all.length === 1 || s.title !== fallbackTitle);

  const toc = splitByToc(lines);
  if (toc) return clean(toc);

  const strong = (t: string): string | null => {
    const md = /^#{1,4}\s+(.+?)\s*#*$/.exec(t);
    if (md) return md[1];
    if (/^(cap[ií]tulo|li[cç][aã]o|m[oó]dulo|parte|aula|unidade|semana|dia|se[cç][cç]?[aã]o|sess[aã]o|t[oó]pico|livro)\s+[\divxlc]+\b.{0,80}$/i.test(t)) return t;
    return null;
  };
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l.trim(), (counts.get(l.trim()) ?? 0) + 1);
  const caps = (t: string): string | null =>
    t.length >= 4 &&
    t.length <= 70 &&
    t === t.toUpperCase() &&
    /[A-ZÁÉÍÓÚ]{3}/.test(t) &&
    !/[.!?:]$/.test(t) &&
    !FRONT_MATTER.test(t) &&
    (counts.get(t) ?? 0) < 3 // repete em toda página: é cabeçalho, não capítulo
      ? t.charAt(0) + t.slice(1).toLowerCase()
      : null;
  const useStrong = lines.filter((l) => strong(l.trim())).length >= 2;

  const out: Array<{ title: string; lines: string[] }> = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    let heading = useStrong ? strong(t) : strong(t) ?? caps(t);
    // "CAPÍTULO 1" sozinho: o título vem na linha seguinte
    if (heading && CHAPTER_NUMBER.test(t)) {
      const next = lines[i + 1]?.trim() ?? '';
      if (next && next.length <= 80 && !/[.!?]$/.test(next)) {
        heading = `${t} — ${next}`;
        i++;
      }
    }
    // título em maiúsculas quebrado em duas linhas no PDF ("… A CONFISSÃO DA" / "PALAVRA")
    if (heading && t === t.toUpperCase()) {
      const next = lines[i + 1]?.trim() ?? '';
      if (next && next.length <= 50 && next === next.toUpperCase() && /\p{Lu}{2}/u.test(next) && !/[.!?:]$/.test(next) && !strong(next)) {
        heading = `${heading} ${heading === t ? next : next.charAt(0) + next.slice(1).toLowerCase()}`.replace(/\s+/g, ' ');
        i++;
      }
    }
    if (heading) out.push({ title: heading, lines: [] });
    else {
      if (!out.length) out.push({ title: fallbackTitle, lines: [] });
      out[out.length - 1].lines.push(lines[i]);
    }
  }
  let parts: Part[] = out.map((s) => ({ title: s.title, text: s.lines.join('\n') }));
  // muitas partes minúsculas: eram títulos falsos — juntam-se à anterior
  if (!useStrong && parts.length > 25) {
    const merged: Part[] = [];
    for (const p of parts) {
      if (merged.length && countWords(p.text) < 80) {
        const last = merged[merged.length - 1];
        last.text = `${last.text}\n${p.title}\n${p.text}`;
      } else merged.push({ ...p });
    }
    parts = merged;
  }
  return clean(parts);
}


export interface ReadFile {
  title: string;
  format: 'pdf' | 'docx';
  parts: MaterialPart[];
  words: number;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Material importado';

/** Lê o PDF ou o Word e divide em partes (capítulos, lições, seções). */
export async function readMaterialFile(file: File, onProgress?: (message: string) => void): Promise<ReadFile> {
  if (file.size > MAX_MATERIAL_BYTES) throw new Error('O arquivo passa de 30 MB.');
  const name = file.name.toLowerCase();
  let text: string;
  let format: ReadFile['format'];
  if (name.endsWith('.docx')) {
    format = 'docx';
    text = await docxToText(await file.arrayBuffer());
  } else if (name.endsWith('.doc')) {
    format = 'docx';
    text = await docToText(await file.arrayBuffer());
  } else if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    format = 'pdf';
    text = await pdfToText(await file.arrayBuffer(), (p, t) => onProgress?.(`Lendo página ${p} de ${t}…`));
  } else {
    throw new Error('Formato não aceito. Use PDF ou Word (.docx ou .doc).');
  }
  text = normalizeReferences(text);
  const split = splitIntoSections(text, 'Introdução');
  // a capa ou o título do documento ("Título" no Word) vira parte sem texto:
  // sai das partes e, se vier primeiro, dá o nome ao material
  const lead = split[0] && !split[0].text.trim() && split.length > 1 ? split[0].title : '';
  const parts = split.filter((p) => p.text.trim());
  return {
    title: lead && lead.length <= 120 ? lead : baseName(file.name),
    format,
    parts: parts.length ? parts : split,
    words: countWords(text),
  };
}
