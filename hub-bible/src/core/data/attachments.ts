import { db, now, uid } from '../db/db';
import { LOCAL_USER, type Attachment } from '../db/types';

/**
 * Arquivos importados pelo usuário — sermões que já chegaram prontos em PDF ou
 * Word. O arquivo original é guardado inteiro no aparelho e exibido como veio,
 * sem conversão para texto: a formatação que o autor deu é parte do documento.
 */

export const ACCEPTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

export const ACCEPTED_EXTENSIONS = '.pdf,.docx';

/**
 * Limite por arquivo.
 *
 * Era 25 MB, pensado no sermão avulso. As apostilas do Rhema Brasil pesam
 * perto de 3 MB cada, e uma edição cheia de imagem pode passar bem disso — 35
 * MB dá folga sem chegar perto do ponto em que o IndexedDB do Android começa a
 * engasgar ao gravar um único registro.
 */
export const MAX_FILE_BYTES = 35 * 1024 * 1024;

export type AttachmentFormat = 'pdf' | 'docx';

export interface DetectedFile {
  format: AttachmentFormat;
  /** Nome sem a extensão — vira o título sugerido do sermão. */
  baseName: string;
}

/**
 * Descobre o formato pelo tipo declarado e pela extensão.
 *
 * `.doc` antigo (binário, anterior a 2007) não é reconhecido: não há como
 * renderizá-lo com fidelidade no navegador. A mensagem orienta a salvar como
 * `.docx` ou PDF, que é um passo de dez segundos no Word.
 */
export function detectFormat(file: File): DetectedFile {
  const name = file.name;
  const lower = name.toLowerCase();
  const baseName = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    return { format: 'pdf', baseName };
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return { format: 'docx', baseName };
  }
  if (lower.endsWith('.doc')) {
    throw new Error(
      'Arquivos .doc antigos não podem ser exibidos. Abra no Word e use "Salvar como" para .docx ou PDF.',
    );
  }
  throw new Error('Formato não suportado. Envie um arquivo PDF ou Word (.docx).');
}

export async function saveAttachment(docId: string, file: File): Promise<Attachment> {
  const { format } = detectFormat(file);
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é ${
        MAX_FILE_BYTES / 1024 / 1024
      } MB.`,
    );
  }

  const attachment: Attachment = {
    id: uid('att_'),
    userId: LOCAL_USER,
    docId,
    name: file.name,
    mime: file.type || (format === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    size: file.size,
    format,
    blob: file,
    createdAt: now(),
  };

  await db.attachments.put(attachment);
  return attachment;
}

export const getAttachment = (id: string) => db.attachments.get(id);

export async function removeAttachment(id: string): Promise<void> {
  await db.attachments.delete(id);
}

export async function removeAttachmentsOf(docId: string): Promise<void> {
  await db.attachments.where('docId').equals(docId).delete();
}

/**
 * Descobre o título dentro do próprio documento.
 *
 * O nome do arquivo costuma vir com sublinhados, numeração e sem acento
 * ("O_Coracao_Pastoral_de_Deus_1"). O título de verdade está na primeira linha
 * do documento, escrito como o autor quis — é ele que vale.
 *
 * Devolve `null` quando nada aproveitável é encontrado; nesse caso o nome do
 * arquivo continua servindo.
 */
export async function extractTitle(file: File, format: AttachmentFormat): Promise<string | null> {
  try {
    const first =
      format === 'pdf' ? await firstLineOfPdf(file) : await firstLineOfDocx(file);
    const clean = (first ?? '').replace(/\s+/g, ' ').trim();
    // linhas de filete, numeração solta e frases longas demais não são título
    if (clean.length < 3 || clean.length > 120) return null;
    if (!/[\p{L}]/u.test(clean)) return null;
    return clean;
  } catch {
    return null;
  }
}

async function firstLineOfPdf(file: File): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const content = await doc.getPage(1).then((page) => page.getTextContent());
  for (const item of content.items) {
    const text = (item as { str?: string }).str?.trim();
    if (text && /[\p{L}]/u.test(text) && text.length >= 3) return text;
  }
  return null;
}

async function firstLineOfDocx(file: File): Promise<string | null> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return null;
  for (const match of xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
    const text = match[1].trim();
    if (text && /[\p{L}]/u.test(text) && text.length >= 3) return text;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
