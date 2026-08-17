/**
 * Persistência do armazenamento local.
 *
 * Por padrão, o navegador trata os dados de um site como descartáveis: quando o
 * aparelho fica sem espaço, ele apaga o que julgar menos usado — **sem avisar**.
 * Para um app onde moram anos de sermões, isso é inaceitável.
 *
 * `navigator.storage.persist()` marca o armazenamento como permanente, e a
 * partir daí o navegador não apaga por conta própria. No Chrome do Android um
 * app instalado costuma receber essa marca automaticamente; pedir explicitamente
 * garante o caso em que a heurística não bastaria.
 *
 * **O que isto não faz, e é preciso dizer com todas as letras:** não protege de
 * o próprio usuário limpar os dados do navegador, nem de desinstalar o app, nem
 * de perder o aparelho. Contra isso só existe cópia fora daqui — ver
 * `backupStore.ts`.
 */

export interface StorageStatus {
  /** O navegador oferece a API? (Safari antigo e WebViews podem não oferecer.) */
  supported: boolean;
  /** O armazenamento está marcado como permanente. */
  persisted: boolean;
  /** Bytes em uso e cota estimada, quando o navegador informa. */
  usage?: number;
  quota?: number;
}

export function storagePersistenceSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.persist;
}

export async function storageStatus(): Promise<StorageStatus> {
  if (!storagePersistenceSupported()) return { supported: false, persisted: false };
  try {
    const persisted = (await navigator.storage.persisted?.()) ?? false;
    const estimate = (await navigator.storage.estimate?.()) ?? {};
    return { supported: true, persisted, usage: estimate.usage, quota: estimate.quota };
  } catch {
    return { supported: false, persisted: false };
  }
}

/**
 * Pede a marca de permanente. Devolve o estado final — que pode ser `false`
 * mesmo sem erro, quando o navegador decide não conceder.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!storagePersistenceSupported()) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Pedido silencioso na abertura do app.
 *
 * Não há o que mostrar ao usuário: no Chrome a concessão é automática e sem
 * diálogo, e falhar aqui não muda nada do que ele pode fazer agora.
 */
export function ensurePersistenceQuietly(): void {
  void requestPersistence().catch(() => undefined);
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
