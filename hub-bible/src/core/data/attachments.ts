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

/** Limite por arquivo. Acima disso o IndexedDB do Android começa a sofrer. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
