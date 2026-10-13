import { isNativeApp } from '../platform';
import { saveFileNatively } from '../nativeFiles';
import { downloadBlob, shareFile } from '../share/share';

/**
 * Entrega o arquivo ao usuário.
 *
 * No navegador, o download comum. No aplicativo Android o download `blob:`
 * some sem aviso, então o arquivo é gravado em Documentos pelo lado nativo —
 * e a mensagem diz onde ele ficou.
 */
export async function deliverFile(blob: Blob, filename: string): Promise<string> {
  if (isNativeApp()) {
    const path = await saveFileNatively(blob, filename);
    if (path) return `Arquivo salvo em ${path}.`;
  }
  downloadBlob(blob, filename);
  return 'Download iniciado.';
}

/** Abre a folha de compartilhamento do aparelho com o arquivo. */
export async function shareExportFile(blob: Blob, filename: string): Promise<string> {
  const result = await shareFile(blob, filename);
  return result === 'shared' ? 'Arquivo enviado para compartilhar.' : 'Este aparelho não compartilha arquivos; o download foi iniciado.';
}
