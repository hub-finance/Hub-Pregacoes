/// <reference types="vite/client" />

/**
 * O número da compilação, injetado por `vite.config.ts` a partir de `HUB_BUILD`
 * — o mesmo número que vira o versionCode do APK. Fora do CI vale "0".
 */
declare const __HUB_BUILD__: string;
