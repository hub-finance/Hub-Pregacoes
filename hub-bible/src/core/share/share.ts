/**
 * Compartilhamento — usa a folha de compartilhamento nativa do Android/iOS
 * (Web Share API) quando disponível e cai para a área de transferência quando não.
 */

export const APP_NAME = 'Hub Bible';

export interface SharePayload {
  title?: string;
  text: string;
  url?: string;
}

export const canShareFiles = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share;

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback para navegadores/WebViews sem Clipboard API
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export type ShareResult = 'shared' | 'copied' | 'failed';

export async function shareText(payload: SharePayload): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'shared';
    }
  }
  return (await copyToClipboard(payload.text)) ? 'copied' : 'failed';
}

export async function shareImage(blob: Blob, filename: string, text?: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'shared';
    }
  }
  downloadBlob(blob, filename);
  return 'copied';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Texto padrão de compartilhamento de uma passagem. */
export function formatShareText(text: string, reference: string, translation?: string): string {
  const credit = translation ? ` (${translation})` : '';
  return `"${text}"\n\n— ${reference}${credit}\n\n${APP_NAME}`;
}
