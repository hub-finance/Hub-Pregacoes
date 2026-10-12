import type { ExportDoc, ExportFile, ExportFormat, ExportVersion } from '../db/types';
import {
  getApprovedVersion,
  getExportDoc,
  logExport,
  normalizeLayout,
  storeFile,
  validateForExport,
} from '../data/exportDocs';
import { buildRenderDoc, type RenderDoc } from './model';
import { FORMAT_MIME, FORMAT_SHORT, MAX_FILE_BYTES, safeFileName, validateFile } from './files';

/**
 * Do documento aprovado ao arquivo guardado — as etapas, na ordem:
 *
 *   receber a versão aprovada → validar → aplicar o modelo → montar →
 *   gerar → conferir o arquivo → guardar → registrar → entregar.
 *
 * Cada formato é tratado em separado: se o PDF falhar, o Word gerado não se
 * perde, e a tela mostra o resultado verdadeiro de cada um.
 */

export interface GeneratedFile {
  format: ExportFormat;
  ok: boolean;
  filename: string;
  /** O arquivo em mãos — presente mesmo quando não deu para guardar. */
  blob?: Blob;
  /** Registro na biblioteca, quando foi guardado. */
  file?: ExportFile;
  /** Gerado e conferido, mas não guardado (falta de espaço, por exemplo). */
  storeError?: string;
  error?: string;
  pages?: number;
}

export interface GenerationResult {
  doc: ExportDoc;
  version: ExportVersion;
  files: GeneratedFile[];
}

export async function renderBlob(render: RenderDoc, format: ExportFormat): Promise<Blob> {
  switch (format) {
    case 'docx':
      return (await import('./docx')).buildDocx(render);
    case 'pdf':
      return (await import('./pdf')).buildPdf(render);
    case 'md': {
      const { buildMarkdown } = await import('./markdown');
      return new Blob([buildMarkdown(render)], { type: FORMAT_MIME.md });
    }
  }
}

export function renderOf(version: ExportVersion): RenderDoc {
  return buildRenderDoc({
    title: version.title,
    content: version.content,
    structure: version.structure,
    layout: normalizeLayout(version.layout),
  });
}

/** Mensagem compreensível para uma falha técnica. */
function friendly(err: unknown, format: ExportFormat): string {
  const message = (err as Error)?.message ?? String(err);
  if (/quota|QuotaExceeded|storage/i.test(message)) {
    return 'Não há espaço livre no aparelho para guardar o arquivo.';
  }
  if (/fetch|network|Fonte/i.test(message)) {
    return `Não foi possível carregar as fontes do ${FORMAT_SHORT[format]}. Abra o app com internet uma vez para que ele as guarde.`;
  }
  return `Não foi possível gerar o ${FORMAT_SHORT[format]}: ${message}`;
}

export async function generateFiles(
  docId: string,
  formats: ExportFormat[],
  onStep?: (message: string) => void,
): Promise<GenerationResult> {
  let doc = await getExportDoc(docId);
  if (!doc) throw new Error('Documento não encontrado.');
  const version = await getApprovedVersion(doc);
  if (!version) throw new Error('Aprove uma versão antes de gerar os arquivos.');
  const problem = validateForExport(version);
  if (problem) throw new Error(problem);

  onStep?.('Montando o documento…');
  const render = renderOf(version);
  if (!render.nodes.length) throw new Error('A versão aprovada não tem conteúdo para o arquivo.');

  const files: GeneratedFile[] = [];
  for (const format of formats) {
    const filename = safeFileName(version.title, version.version, format);
    const started = performance.now();
    onStep?.(`Gerando ${FORMAT_SHORT[format]}…`);
    let blob: Blob;
    try {
      blob = await renderBlob(render, format);
    } catch (err) {
      await logExport({ at: Date.now(), op: 'gerar', format, ok: false, ms: performance.now() - started, error: (err as Error)?.message });
      files.push({ format, ok: false, filename, error: friendly(err, format) });
      continue;
    }

    onStep?.(`Conferindo o ${FORMAT_SHORT[format]}…`);
    let check;
    try {
      check = await validateFile(blob, format);
    } catch (err) {
      check = { ok: false, reason: `o arquivo não abriu na conferência (${(err as Error)?.message}).` };
    }
    await logExport({
      at: Date.now(),
      op: 'gerar',
      format,
      ok: check.ok,
      ms: performance.now() - started,
      bytes: blob.size,
      error: check.ok ? undefined : check.reason,
    });
    if (!check.ok) {
      files.push({ format, ok: false, filename, error: check.reason });
      continue;
    }

    const result: GeneratedFile = { format, ok: true, filename, blob, pages: check.pages };
    if (blob.size > MAX_FILE_BYTES) {
      result.storeError = 'O arquivo é grande demais para guardar na biblioteca; baixe-o agora.';
    } else {
      onStep?.(`Guardando o ${FORMAT_SHORT[format]}…`);
      try {
        const stored = await storeFile(doc, version, {
          format,
          filename,
          mime: FORMAT_MIME[format],
          blob,
          pages: check.pages,
        });
        result.file = stored.file;
        doc = stored.doc;
        await logExport({ at: Date.now(), op: 'guardar', format, ok: true, ms: 0, bytes: blob.size });
      } catch (err) {
        result.storeError = friendly(err, format);
        await logExport({ at: Date.now(), op: 'guardar', format, ok: false, ms: 0, error: (err as Error)?.message });
      }
    }
    files.push(result);
  }

  return { doc, version, files };
}
