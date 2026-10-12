import { db } from '../db/db';
import { escapeHtml } from '../backup';
import { blocksFromSermon, mainScriptureOf, newBlock } from '../data/sermonContent';
import { sectionsOf, sectionTitle } from '../data/studySections';
import type {
  Devotional,
  ExportSource,
  ExportSourceKind,
  LibraryDoc,
  Sermon,
  SermonBlock,
  Study,
} from '../db/types';

/**
 * O conteúdo de origem, trazido para os blocos do documento de exportação.
 *
 * Regra desta conversão: **só entra o que o autor escreveu.** Campo vazio não
 * vira título com caixa em branco, nada é resumido, completado ou reescrito.
 * A única mudança é de forma — o texto passa a ser uma sequência de blocos
 * (seção, parágrafo, destaque, citação, lista), a mesma que o Gerador usa.
 */

export interface SourceOption {
  kind: ExportSourceKind;
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
  /** Conteúdo que só existe como arquivo importado (PDF/Word) — não dá para formatar. */
  fileOnly: boolean;
}

export const SOURCE_LABEL: Record<ExportSourceKind, string> = {
  sermon: 'Gerador (mensagem)',
  study: 'Rhema (estudo)',
  devotional: 'Cursos e devocionais',
  doc: 'Material da biblioteca (antigo)',
  blank: 'Documento em branco',
};

/** Texto puro vira parágrafos; linhas em branco separam um do outro. */
function textBlocks(value: string): SermonBlock[] {
  const blocks: SermonBlock[] = [];
  for (const part of value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    const lines = part.split('\n');
    // marcadores escritos à mão continuam lista
    if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
      const ordered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
      const items = lines.map((l) => `<li>${escapeHtml(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>`).join('');
      blocks.push(newBlock('list', ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`));
      continue;
    }
    blocks.push(newBlock('text', lines.map(escapeHtml).join('<br>')));
  }
  return blocks;
}

/**
 * Texto do Material da biblioteca. Ali o autor escreve num campo livre, às
 * vezes com a marcação de Markdown (`#`, `-`, `>`); ela é respeitada, e o que
 * não for marcação fica como parágrafo.
 */
export function markdownishToBlocks(value: string): SermonBlock[] {
  const blocks: SermonBlock[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) blocks.push(...textBlocks(buffer.join('\n')));
    buffer = [];
  };
  let quote: string[] = [];
  const flushQuote = () => {
    if (quote.length) blocks.push(newBlock('highlight', quote.map(escapeHtml).join('<br>')));
    quote = [];
  };

  for (const raw of value.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(raw);
    const quoted = /^\s{0,3}>\s?(.*)$/.exec(raw);
    if (heading) {
      flush();
      flushQuote();
      blocks.push(newBlock('section', escapeHtml(heading[1])));
    } else if (quoted) {
      flush();
      quote.push(quoted[1]);
    } else {
      flushQuote();
      buffer.push(raw);
    }
  }
  flush();
  flushQuote();
  return blocks;
}

function section(title: string, body: SermonBlock[]): SermonBlock[] {
  return body.length ? [newBlock('section', escapeHtml(title)), ...body] : [];
}

function scripture(reference: string, text?: string): SermonBlock {
  const block = newBlock('scripture', text?.trim() ? escapeHtml(text.trim()).replace(/\n/g, '<br>') : '');
  block.reference = reference.trim();
  return block;
}

/** Cópia profunda com ids novos, para o documento não compartilhar objetos com a origem. */
const cloneBlocks = (blocks: SermonBlock[]): SermonBlock[] =>
  blocks.map((b) => ({ ...newBlock(b.type, b.html), ...(b.reference !== undefined ? { reference: b.reference } : {}) }));

export function sermonBlocks(doc: Sermon): SermonBlock[] {
  const content = doc.content?.length ? doc.content : blocksFromSermon(doc);
  const blocks = cloneBlocks(content);
  // o texto principal guardado fora do corpo (sermões antigos) entra no início,
  // mas só quando o corpo ainda não traz nenhuma citação
  if (doc.mainText?.trim() && !mainScriptureOf(blocks)) {
    blocks.unshift(scripture(doc.mainText, doc.mainTextContent));
  }
  return blocks;
}

export function studyBlocks(doc: Study): SermonBlock[] {
  const blocks: SermonBlock[] = [];
  for (const s of sectionsOf(doc)) {
    if (!s.text.trim()) continue;
    if (s.kind === 'texto') {
      blocks.push(newBlock('section', escapeHtml(sectionTitle(s))));
      // a seção de texto guarda a referência; o versículo é trazido no editor
      for (const reference of s.text.split('\n').map((l) => l.trim()).filter(Boolean)) {
        blocks.push(scripture(reference));
      }
      continue;
    }
    blocks.push(...section(sectionTitle(s), textBlocks(s.text)));
  }
  if (doc.relatedVerses?.length) {
    const items = doc.relatedVerses.map((v) => `<li>${escapeHtml(v)}</li>`).join('');
    blocks.push(newBlock('section', 'Versículos relacionados'), newBlock('list', `<ul>${items}</ul>`));
  }
  return blocks;
}

export function devotionalBlocks(doc: Devotional): SermonBlock[] {
  const blocks: SermonBlock[] = [];
  if (doc.scripture?.trim()) blocks.push(newBlock('section', 'Texto bíblico'), scripture(doc.scripture, doc.scriptureText));
  blocks.push(...section('Reflexão', textBlocks(doc.reflection ?? '')));
  blocks.push(...section('Aplicação', textBlocks(doc.application ?? '')));
  blocks.push(...section('Oração', textBlocks(doc.prayer ?? '')));
  blocks.push(...section('Observações', textBlocks(doc.notes ?? '')));
  return blocks;
}

export function libraryBlocks(doc: LibraryDoc): SermonBlock[] {
  const blocks: SermonBlock[] = [];
  if (doc.summary?.trim()) blocks.push(newBlock('highlight', escapeHtml(doc.summary.trim())));
  blocks.push(...markdownishToBlocks(doc.content ?? ''));
  return blocks;
}

/** Tudo o que pode servir de origem, do mais recente para o mais antigo. */
export async function listSources(): Promise<SourceOption[]> {
  const [sermons, studies, devotionals, docs] = await Promise.all([
    db.sermons.toArray(),
    db.studies.toArray(),
    db.devotionals.toArray(),
    db.libraryDocs.toArray(),
  ]);
  const date = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '');
  const options: SourceOption[] = [
    ...sermons.map((s) => ({
      kind: 'sermon' as const,
      id: s.id,
      title: s.title || 'Mensagem sem título',
      subtitle: [s.mainText, date(s.date)].filter(Boolean).join(' · '),
      updatedAt: s.updatedAt,
      fileOnly: !!s.attachmentId && !s.content?.length && !blocksFromSermon(s).length,
    })),
    ...studies.map((s) => ({
      kind: 'study' as const,
      id: s.id,
      title: s.title || 'Estudo sem título',
      subtitle: s.theme || s.category,
      updatedAt: s.updatedAt,
      fileOnly: !!s.attachmentId && !studyBlocks(s).length,
    })),
    ...devotionals.map((d) => ({
      kind: 'devotional' as const,
      id: d.id,
      title: d.title || 'Sem título',
      subtitle: [d.scripture, date(d.date)].filter(Boolean).join(' · '),
      updatedAt: d.updatedAt,
      fileOnly: !!d.attachmentId && !devotionalBlocks(d).length,
    })),
    ...docs.map((d) => ({
      kind: 'doc' as const,
      id: d.id,
      title: d.title || 'Material sem título',
      subtitle: d.category,
      updatedAt: d.updatedAt,
      fileOnly: false,
    })),
  ];
  return options.sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface LoadedSource {
  source: ExportSource;
  blocks: SermonBlock[];
  /** Sugestões para a capa, tiradas do próprio documento de origem. */
  subtitle: string;
  dateLabel: string;
}

const dateLabelOf = (iso?: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

/** Carrega a origem escolhida e a converte em blocos. */
export async function loadSource(kind: ExportSourceKind, id?: string): Promise<LoadedSource> {
  if (kind === 'blank' || !id) {
    return { source: { kind: 'blank', title: 'Documento em branco' }, blocks: [], subtitle: '', dateLabel: '' };
  }
  switch (kind) {
    case 'sermon': {
      const doc = await db.sermons.get(id);
      if (!doc) throw new Error('A mensagem escolhida não foi encontrada.');
      return {
        source: { kind, id, title: doc.title },
        blocks: sermonBlocks(doc),
        subtitle: doc.theme ?? '',
        dateLabel: dateLabelOf(doc.date),
      };
    }
    case 'study': {
      const doc = await db.studies.get(id);
      if (!doc) throw new Error('O estudo escolhido não foi encontrado.');
      return { source: { kind, id, title: doc.title }, blocks: studyBlocks(doc), subtitle: doc.theme ?? '', dateLabel: '' };
    }
    case 'devotional': {
      const doc = await db.devotionals.get(id);
      if (!doc) throw new Error('O devocional escolhido não foi encontrado.');
      return { source: { kind, id, title: doc.title }, blocks: devotionalBlocks(doc), subtitle: '', dateLabel: dateLabelOf(doc.date) };
    }
    case 'doc': {
      const doc = await db.libraryDocs.get(id);
      if (!doc) throw new Error('O material escolhido não foi encontrado.');
      return { source: { kind, id, title: doc.title }, blocks: libraryBlocks(doc), subtitle: '', dateLabel: '' };
    }
  }
}

/** Rota do documento de origem, para o "abrir origem" da biblioteca. */
export function sourceRoute(source: ExportSource): string | null {
  if (!source.id) return null;
  switch (source.kind) {
    case 'sermon':
      return `/sermoes/${source.id}`;
    case 'study':
      return `/rhema/${source.id}`;
    case 'devotional':
      return `/cursos/${source.id}`;
    // o Material da biblioteca não tem mais tela própria (a rota leva ao Rhema)
    default:
      return null;
  }
}
