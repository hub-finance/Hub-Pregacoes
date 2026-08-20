/**
 * Onde o app está rodando.
 *
 * O mesmo código serve às duas formas de instalar — o endereço na web e o APK —
 * e quase tudo funciona igual nas duas. As poucas diferenças reais moram aqui,
 * em vez de espalhadas por `if`s pelas telas.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

const capacitor = (): CapacitorGlobal | undefined =>
  (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;

/**
 * Rodando dentro do aplicativo Android empacotado.
 *
 * Lido do objeto global em vez de importado de `@capacitor/core`: o pacote não
 * precisa entrar no bundle da versão web só para responder a esta pergunta.
 */
export const isNativeApp = (): boolean => capacitor()?.isNativePlatform?.() === true;

/**
 * Como o app foi instalado — usado para explicar ao usuário onde os dados dele
 * moram, que é a diferença que de fato importa entre as duas versões.
 */
export function installKind(): 'app' | 'pwa' | 'browser' {
  if (isNativeApp()) return 'app';
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);
  return standalone ? 'pwa' : 'browser';
}

/**
 * Desliga o service worker quando o app roda empacotado.
 *
 * Dentro do APK ele não serve para nada — os arquivos já vêm no pacote, não há
 * rede para poupar nem servidor de onde buscar versão nova. E cria um problema
 * sério: o cache dele sobrevive à atualização do aplicativo, então uma versão
 * nova instalada continua mostrando telas antigas. Foi exatamente o que
 * aconteceu com o manual — o arquivo novo estava no pacote, e o service worker
 * entregava o velho.
 *
 * Devolve `true` quando havia um service worker no controle desta página: aí o
 * que está na tela ainda é o conteúdo antigo, e só uma recarga resolve.
 */
export async function unregisterServiceWorkerInApp(): Promise<boolean> {
  if (!isNativeApp() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) return false;

    await Promise.all(registrations.map((r) => r.unregister()));
    if ('caches' in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    // sem controlador, a página já veio dos arquivos do pacote: nada a fazer
    return !!navigator.serviceWorker.controller;
  } catch {
    return false;
  }
}
