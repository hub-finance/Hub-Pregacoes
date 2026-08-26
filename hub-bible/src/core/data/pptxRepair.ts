/**
 * Conserta o manifesto de uma apresentação antes de desenhá-la.
 *
 * Um `.pptx` é um zip com um manifesto — `[Content_Types].xml` — que declara o
 * tipo de cada parte de dentro. O PowerPoint às vezes deixa nesse manifesto
 * partes que **não existem** no arquivo: uma apresentação que passou por vários
 * modelos ao longo da vida acumula declarações de `slideMaster` que já foram
 * removidas. O próprio PowerPoint abre assim mesmo, porque na hora de exibir
 * ele se guia pelas relações e não pelo manifesto.
 *
 * O desenhista de apresentações do aplicativo, não. Ele percorre o manifesto e
 * pede cada parte declarada; ao chegar numa que não existe, para tudo — e como
 * engole o próprio erro, o resultado é uma tela vazia, sem aviso nenhum. Foi
 * assim que uma apostila de 20 slides não abria: o manifesto anunciava 20
 * `slideMaster` e o arquivo trazia um.
 *
 * A limpeza aqui é conservadora de propósito: só **remove declarações órfãs**.
 * Nenhum slide, nenhuma imagem, nenhum texto é tocado — o que não existe não
 * pode ser exibido de qualquer forma.
 */

/** `<Override PartName="/ppt/…" ContentType="…"/>`, uma declaração por parte. */
const OVERRIDE = /<Override\s[^>]*PartName="([^"]+)"[^>]*\/>/g;

const CONTENT_TYPES = '[Content_Types].xml';

export interface PptxRepair {
  /** O arquivo pronto para desenhar — o original, quando não havia o que fazer. */
  buffer: ArrayBuffer;
  /** Quantas declarações órfãs saíram. Zero significa arquivo já íntegro. */
  removed: number;
}

export async function repairPptx(buffer: ArrayBuffer): Promise<PptxRepair> {
  const { default: JSZip } = await import('jszip');

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // não é um zip legível: deixar o desenhista falhar e dizer o que achar
    return { buffer, removed: 0 };
  }

  const manifest = zip.file(CONTENT_TYPES);
  if (!manifest) return { buffer, removed: 0 };

  const original = await manifest.async('text');
  let removed = 0;

  const cleaned = original.replace(OVERRIDE, (tag, part: string) => {
    // no manifesto o caminho começa com "/"; no zip, não
    const path = part.replace(/^\//, '');
    if (zip.file(path)) return tag;
    removed++;
    return '';
  });

  if (!removed) return { buffer, removed: 0 };

  zip.file(CONTENT_TYPES, cleaned);
  const repaired = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });
  return { buffer: repaired, removed };
}
