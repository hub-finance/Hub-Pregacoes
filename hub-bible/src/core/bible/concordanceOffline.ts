/**
 * Guarda a concordância pré-gerada de uma tradução embutida para uso sem
 * internet.
 *
 * Grava no mesmo cache que o service worker consulta (`hub-bible-concordance`,
 * em `vite.config.ts`), então a tela da concordância não muda: o pedido dela
 * passa a ser atendido pelo cache.
 */

import { isNativeApp } from '../platform';

const CACHE_NAME = 'hub-bible-concordance';

function fileUrl(translation: string, name: string): string {
  const path = `${import.meta.env.BASE_URL}concordance/${translation}/${encodeURIComponent(name)}.json`;
  return new URL(path, location.href).href;
}

function letterNames(index: Record<string, number>): string[] {
  return Object.keys(index).filter((k) => !k.startsWith('_'));
}

/** No APK os arquivos já vêm dentro do pacote; sem Cache Storage não há onde guardar. */
function needsCaching(): boolean {
  return !isNativeApp() && typeof caches !== 'undefined';
}

export async function isConcordanceSaved(translation: string): Promise<boolean> {
  if (!needsCaching()) return true;
  const cache = await caches.open(CACHE_NAME);
  const indexRes = await cache.match(fileUrl(translation, 'index'));
  if (!indexRes) return false;
  const index = (await indexRes.json()) as Record<string, number>;
  const hits = await Promise.all(letterNames(index).map((l) => cache.match(fileUrl(translation, l))));
  return hits.every(Boolean);
}

/** Não faz nada quando a tradução não tem concordância pré-gerada (as importadas). */
export async function saveConcordance(
  translation: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!needsCaching()) return;
  const indexUrl = fileUrl(translation, 'index');
  const indexRes = await fetch(indexUrl);
  if (!indexRes.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(indexUrl, indexRes.clone());
  const queue = letterNames((await indexRes.json()) as Record<string, number>);
  const total = queue.length;
  let done = 0;

  const worker = async () => {
    for (;;) {
      const letter = queue.shift();
      if (letter === undefined) return;
      const url = fileUrl(translation, letter);
      if (!(await cache.match(url))) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Não foi possível baixar a concordância. Verifique a internet.');
        await cache.put(url, res);
      }
      done += 1;
      onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: 4 }, worker));
}
