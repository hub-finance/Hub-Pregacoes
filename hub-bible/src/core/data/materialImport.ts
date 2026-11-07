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

export async function pdfToText(data: ArrayBuffer, onPage?: (page: number, total: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
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
      // linhas quebradas no meio da frase voltam a formar o parágrafo
      pages.push(
        lines
          .join('\n')
          .replace(/-\n(?=\p{Ll})/gu, '')
          .replace(/([^\n.!?:;])\n(?=\p{Ll})/gu, '$1 '),
      );
    }
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
  const text = pages.join('\n\n').trim();
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
  let misses = 0;
  let end = start - 1;
  let pending = '';
  const push = (raw: string, at: number) => {
    const e = tocEntry(raw);
    if (e.length >= 3 && e.length <= 160 && /\p{L}{2}/u.test(e) && !TOC_HEAD.test(e)) {
      entries.push(e);
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
  return entries.length >= 3 ? { entries, end } : null;
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
  for (const entry of entries) {
    const key = titleKey(entry);
    if (key.length < 3) continue;
    for (let k = cursor; k < lines.length; k++) {
      const t = lines[k].trim();
      if (!t || t.length > key.length + 40) continue;
      const lk = titleKey(t);
      const two = k + 1 < lines.length ? titleKey(`${t} ${lines[k + 1].trim()}`) : '';
      const three = k + 2 < lines.length ? titleKey(`${t} ${lines[k + 1].trim()} ${lines[k + 2].trim()}`) : '';
      let body = -1;
      if (lk === key) body = k + 1;
      else if (two === key && lines[k + 1].trim().length <= key.length + 40) body = k + 2;
      else if (three === key && lines[k + 1].trim().length + lines[k + 2].trim().length <= key.length + 40) body = k + 3;
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
  } else if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    format = 'pdf';
    text = await pdfToText(await file.arrayBuffer(), (p, t) => onProgress?.(`Lendo página ${p} de ${t}…`));
  } else {
    throw new Error('Formato não aceito. Use PDF ou Word (.docx).');
  }
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
