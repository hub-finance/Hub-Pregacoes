/**
 * Trazer conteúdo para o Hub Resumos: arquivos de texto, Markdown, Word, PDF
 * e a cópia de segurança do Hub Bible.
 *
 * Tudo acontece no aparelho — o arquivo não é enviado a lugar nenhum. O
 * conteúdo importado é tratado como texto: nada nele é executado.
 */

export const MAX_IMPORT_BYTES = 30 * 1024 * 1024;

export interface ImportedText {
  title: string;
  text: string;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Material importado';

const readAsText = (file: File) => file.text();

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
  } finally {
    await pdf.destroy();
  }
  const text = pages.join('\n\n').trim();
  if (!text) throw new Error('Este PDF não tem texto (provavelmente é digitalizado como imagem).');
  return text;
}

export async function importFile(file: File, onProgress?: (message: string) => void): Promise<ImportedText> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('O arquivo passa de 30 MB.');
  const name = file.name.toLowerCase();
  const title = baseName(file.name);
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || file.type.startsWith('text/')) {
    return { title, text: await readAsText(file) };
  }
  if (name.endsWith('.docx')) return { title, text: await docxToText(await file.arrayBuffer()) };
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return { title, text: await pdfToText(await file.arrayBuffer(), (p, t) => onProgress?.(`Lendo página ${p} de ${t}…`)) };
  }
  throw new Error('Formato não aceito. Use .txt, .md, .docx ou .pdf.');
}

/* --------------------------- Hub Bible (backup) --------------------------- */

export interface HubCandidate {
  table: 'sermons' | 'studies' | 'devotionals' | 'libraryDocs';
  id: string;
  title: string;
  label: string;
  kind: 'estudo' | 'resumo';
  sections: Array<{ title: string; text: string }>;
}

const TABLE_LABEL: Record<HubCandidate['table'], string> = {
  sermons: 'Mensagem (Gerador)',
  studies: 'Estudo (Rhema)',
  devotionals: 'Curso / devocional',
  libraryDocs: 'Material',
};

/** HTML dos blocos do Hub para texto puro. */
const plain = (html: string) =>
  decodeXml(
    String(html ?? '')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function sermonSections(row: Row): Array<{ title: string; text: string }> {
  const blocks = Array.isArray(row.content) ? (row.content as Row[]) : [];
  const out: Array<{ title: string; lines: string[] }> = [];
  const push = (line: string) => {
    if (!out.length) out.push({ title: 'Mensagem', lines: [] });
    out[out.length - 1].lines.push(line);
  };
  if (blocks.length) {
    for (const b of blocks) {
      const text = plain(str(b.html));
      switch (b.type) {
        case 'section':
          if (text) out.push({ title: text, lines: [] });
          break;
        case 'highlight':
          text.split('\n').filter(Boolean).forEach((l) => push(`> ${l}`));
          break;
        case 'list':
          text.split('\n').filter(Boolean).forEach((l) => push(`- ${l}`));
          break;
        case 'scripture':
          if (text || b.reference) push(`“${text}”${b.reference ? ` — ${str(b.reference)}` : ''}`);
          break;
        default:
          if (text) push(text);
      }
      push('');
    }
  } else {
    for (const [title, key] of [
      ['Introdução', 'introduction'],
      ['Desenvolvimento', 'development'],
      ['Conclusão', 'conclusion'],
      ['Aplicação', 'application'],
    ] as const) {
      if (str(row[key]).trim()) out.push({ title, lines: [str(row[key])] });
    }
  }
  const main = str(row.mainText);
  if (main && !out.some((s) => s.lines.join(' ').includes(main))) {
    out.unshift({ title: 'Texto principal', lines: [`${str(row.mainTextContent) ? `“${str(row.mainTextContent)}” — ` : ''}${main}`] });
  }
  return out.map((s) => ({ title: s.title, text: s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() })).filter((s) => s.text);
}

const SECTION_TITLE: Record<string, string> = {
  texto: 'Texto principal',
  introducao: 'Introdução',
  desenvolvimento: 'Desenvolvimento',
  aplicacao: 'Aplicações',
  conclusao: 'Conclusão',
};

function studySections(row: Row): Array<{ title: string; text: string }> {
  if (Array.isArray(row.sections) && row.sections.length) {
    return (row.sections as Row[])
      .map((s) => ({ title: str(s.title) || SECTION_TITLE[str(s.kind)] || 'Seção', text: str(s.text).trim() }))
      .filter((s) => s.text);
  }
  return (
    [
      ['Texto principal', 'mainText'],
      ['Introdução', 'introduction'],
      ['Desenvolvimento', 'development'],
      ['Comentários', 'comments'],
      ['Aplicações', 'application'],
      ['Conclusão', 'conclusion'],
    ] as const
  )
    .map(([title, key]) => ({ title, text: str(row[key]).trim() }))
    .filter((s) => s.text);
}

function devotionalSections(row: Row): Array<{ title: string; text: string }> {
  const scripture = str(row.scripture);
  return [
    { title: 'Texto bíblico', text: scripture ? `${str(row.scriptureText) ? `“${str(row.scriptureText)}” — ` : ''}${scripture}` : '' },
    { title: 'Reflexão', text: str(row.reflection) },
    { title: 'Aplicação', text: str(row.application) },
    { title: 'Oração', text: str(row.prayer) },
  ].filter((s) => s.text.trim());
}

/**
 * Lê a cópia de segurança do Hub Bible (Configurações › Exportar meus dados)
 * e devolve o que dá para trazer. Não grava nada: o usuário escolhe.
 */
export function readHubBackup(json: unknown): HubCandidate[] {
  const data = (json as { app?: string; data?: Record<string, unknown> }) ?? {};
  if (data.app !== 'hub-bible' || !data.data) throw new Error('Este arquivo não é uma cópia de segurança do Hub Bible.');
  const out: HubCandidate[] = [];
  const rows = (table: string) => (Array.isArray(data.data?.[table]) ? (data.data?.[table] as Row[]) : []);
  for (const row of rows('sermons')) {
    out.push({ table: 'sermons', id: str(row.id), title: str(row.title) || 'Mensagem sem título', label: TABLE_LABEL.sermons, kind: 'estudo', sections: sermonSections(row) });
  }
  for (const row of rows('studies')) {
    out.push({ table: 'studies', id: str(row.id), title: str(row.title) || 'Estudo sem título', label: TABLE_LABEL.studies, kind: 'estudo', sections: studySections(row) });
  }
  for (const row of rows('devotionals')) {
    out.push({ table: 'devotionals', id: str(row.id), title: str(row.title) || 'Sem título', label: TABLE_LABEL.devotionals, kind: 'estudo', sections: devotionalSections(row) });
  }
  for (const row of rows('libraryDocs')) {
    const text = [str(row.summary) && `> ${str(row.summary)}`, str(row.content)].filter(Boolean).join('\n\n');
    out.push({ table: 'libraryDocs', id: str(row.id), title: str(row.title) || 'Material', label: TABLE_LABEL.libraryDocs, kind: 'resumo', sections: text ? [{ title: 'Conteúdo', text }] : [] });
  }
  // conteúdo que só existe como arquivo importado no Hub não tem texto aqui
  return out.filter((c) => c.sections.length);
}
