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
