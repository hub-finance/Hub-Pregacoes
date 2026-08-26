/**
 * Entregar um arquivo ao usuário quando o app roda empacotado.
 *
 * No navegador, um `<a download>` com um endereço `blob:` basta, e a folha de
 * compartilhamento do aparelho vem de `navigator.share`. Dentro do APK nenhum
 * dos dois funciona: a WebView do Android **não implementa** a Web Share API, e
 * um download `blob:` some sem erro nenhum. O resultado era o pior possível — a
 * cópia de segurança parecia salva e não saía do aplicativo.
 *
 * Aqui o arquivo passa pelo lado nativo: é gravado de verdade e entregue à
 * folha de compartilhamento do Android, que é por onde se chega ao Drive.
 *
 * Os plugins entram por `import()` de propósito: quem abre pelo navegador não
 * baixa nada disto.
 */
import { isNativeApp } from './platform';

/**
 * O conteúdo em base64, sem o prefixo `data:`.
 *
 * `FileReader` em vez de percorrer os bytes na mão porque a conversão acontece
 * fora da linha principal — um backup com as Bíblias passa de 12 MB, e um laço
 * em JavaScript sobre isso trava a tela.
 */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo.'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Grava o arquivo na área temporária do app e abre a folha de
 * compartilhamento. Devolve `false` quando não é o app empacotado — aí quem
 * chamou segue pelo caminho do navegador.
 *
 * A pasta é a de cache, e não a de Documentos, porque assim não é preciso pedir
 * permissão de armazenamento nenhuma: o arquivo é entregue pela folha, e o
 * destino escolhido pelo usuário é quem o guarda de verdade.
 */
export async function shareFileNatively(blob: Blob, filename: string): Promise<boolean> {
  if (!isNativeApp()) return false;

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  await Filesystem.writeFile({
    path: filename,
    data: await toBase64(blob),
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

  try {
    await Share.share({ title: filename, files: [uri] });
  } catch (err) {
    // fechar a folha não é erro: o usuário desistiu, e o arquivo está gravado
    if (!/cancel|abort/i.test((err as Error)?.message ?? '')) throw err;
  }
  return true;
}

/**
 * Grava o arquivo onde o usuário consegue achá-lo pelo gerenciador de arquivos.
 *
 * Devolve o caminho legível para a mensagem da tela, ou `null` fora do app
 * empacotado. `Documents` porque é a pasta que todo gerenciador de arquivos
 * mostra — a de cache serve para passar adiante, não para guardar.
 */
export async function saveFileNatively(blob: Blob, filename: string): Promise<string | null> {
  if (!isNativeApp()) return null;

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  await Filesystem.writeFile({
    path: filename,
    data: await toBase64(blob),
    directory: Directory.Documents,
    recursive: true,
  });
  return `Documentos/${filename}`;
}
