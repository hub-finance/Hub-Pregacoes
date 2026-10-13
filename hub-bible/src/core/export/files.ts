import type { ExportFormat } from '../db/types';

/**
 * Nome, tipo e conferência dos arquivos gerados.
 *
 * A conferência existe para nunca dizer "arquivo gerado" sobre um arquivo
 * vazio ou corrompido: depois de gerar, o conteúdo é aberto e examinado antes
 * de ir para a biblioteca ou para o download.
 */

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  docx: 'Word (.docx)',
  pdf: 'PDF (.pdf)',
  md: 'Markdown (.md)',
};

export const FORMAT_SHORT: Record<ExportFormat, string> = {
  docx: 'Word',
  pdf: 'PDF',
  md: 'Markdown',
};

export const FORMAT_MIME: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  md: 'text/markdown;charset=utf-8',
};

/** Limite de tamanho de um arquivo gerado guardado na biblioteca. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;

/**
 * Nome de arquivo seguro em qualquer sistema: mantém acentos, tira o que o
 * Windows, o Android ou o Drive recusam, e limita o comprimento.
 */
export function safeFileName(title: string, version: number, format: ExportFormat): string {
  const base =
    title
      .normalize('NFC')
      // caracteres de controle e os proibidos em nomes de arquivo
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, 80)
      .trim() || 'Documento';
  return `${base} - v${version}.${format}`;
}

export interface Validation {
  ok: boolean;
  /** Motivo, em linguagem do usuário, quando não está bom. */
  reason?: string;
  pages?: number;
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/**
 * Confere o arquivo gerado.
 *
 * - **Word:** abre o pacote e verifica que o documento principal existe e tem
 *   corpo — um .docx é um zip, e um zip quebrado não abre no Word.
 * - **PDF:** cabeçalho `%PDF-`, marca de fim `%%EOF` e a contagem de páginas.
 * - **Markdown:** texto não vazio e com o título.
 */
export async function validateFile(blob: Blob, format: ExportFormat): Promise<Validation> {
  if (!blob || blob.size === 0) return { ok: false, reason: 'O arquivo saiu vazio.' };
  if (blob.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `O arquivo passou do limite de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.` };
  }
  const bytes = await bytesOf(blob);

  if (format === 'pdf') {
    if (ascii(bytes.subarray(0, 5)) !== '%PDF-') return { ok: false, reason: 'O PDF gerado não tem o cabeçalho de um PDF.' };
    const tail = ascii(bytes.subarray(Math.max(0, bytes.length - 1024)));
    if (!tail.includes('%%EOF')) return { ok: false, reason: 'O PDF gerado está incompleto.' };
    // cada página tem um objeto `/Type /Page` (as listas de páginas são `/Pages`)
    const text = new TextDecoder('latin1').decode(bytes);
    const pages = (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
    if (!pages) return { ok: false, reason: 'O PDF gerado não tem páginas.' };
    return { ok: true, pages };
  }

  if (format === 'docx') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { ok: false, reason: 'O arquivo do Word gerado não é um pacote válido.' };
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(bytes);
    const main = zip.file('word/document.xml');
    if (!main) return { ok: false, reason: 'O arquivo do Word gerado não tem o documento principal.' };
    const xml = await main.async('string');
    if (!xml.includes('<w:body>')) return { ok: false, reason: 'O documento do Word gerado está sem corpo.' };
    if (!zip.file('[Content_Types].xml')) return { ok: false, reason: 'O arquivo do Word gerado está incompleto.' };
    return { ok: true };
  }

  const text = new TextDecoder('utf-8').decode(bytes);
  if (!text.trim()) return { ok: false, reason: 'O Markdown saiu vazio.' };
  // o título é a primeira linha do arquivo; sem ele, algo se perdeu
  if (!text.startsWith('# ')) return { ok: false, reason: 'O Markdown saiu sem o título.' };
  return { ok: true };
}
