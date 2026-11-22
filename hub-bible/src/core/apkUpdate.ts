import { HAS_RHEMA } from './edition';

/**
 * Atualização do APK.
 *
 * No site quem avisa é o service worker; no APK não há servidor de onde vir
 * versão nova — atualizar é instalar o APK seguinte. Aqui o app confere a
 * última versão publicada no GitHub e oferece o arquivo **da mesma edição**:
 * a completa baixa a completa, a 2.0 baixa a 2.0 (pedido do usuário: "a que
 * estiver instalada deve ser a atualizada"). Os identificadores no Android são
 * diferentes, então uma nunca instala por cima da outra.
 */

const LATEST = 'https://api.github.com/repos/hub-finance/Hub-Pregacoes/releases/latest';

/** O arquivo desta edição em cada versão publicada. */
export const APK_FILE = HAS_RHEMA ? 'farol-da-palavra.apk' : 'farol-da-palavra-2.0.apk';

const DISMISSED_KEY = 'hub-bible:apk-update:dismissed';

export interface ApkUpdate {
  build: number;
  url: string;
}

/** Número desta compilação (o mesmo que aparece em Configurações › Sobre). */
export const currentBuild = (): number => Number(__HUB_BUILD__) || 0;

/** A versão mais nova desta edição, se houver; `null` sem internet ou sem novidade. */
export async function checkApkUpdate(fetcher: typeof fetch = fetch): Promise<ApkUpdate | null> {
  try {
    const res = await fetcher(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; assets?: Array<{ name: string; browser_download_url: string }> };
    const build = Number(/^apk-v(\d+)$/.exec(data.tag_name ?? '')?.[1]);
    const asset = data.assets?.find((a) => a.name === APK_FILE);
    if (!build || !asset || build <= currentBuild()) return null;
    return { build, url: asset.browser_download_url };
  } catch {
    return null;
  }
}

/** "Depois": não insiste na mesma versão; uma mais nova volta a avisar. */
export function dismissApkUpdate(build: number): void {
  try { localStorage.setItem(DISMISSED_KEY, String(build)); } catch { /* sem armazenamento: avisa de novo */ }
}

export function wasDismissed(build: number): boolean {
  try { return Number(localStorage.getItem(DISMISSED_KEY)) >= build; } catch { return false; }
}
