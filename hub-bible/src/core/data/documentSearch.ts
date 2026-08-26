/**
 * Procurar uma palavra dentro do material aberto.
 *
 * Uma apostila do Rhema passa de cinquenta páginas. Rolar até achar o trecho é
 * o que se faz hoje, e é caro no meio de uma aula. Aqui a busca devolve **onde**
 * está, com a página e um pedaço da frase em volta, para o leitor reconhecer o
 * trecho antes de saltar até ele.
 *
 * O PDF é o caso que importa: as páginas viram imagem só quando chegam perto da
 * tela, então o texto não está no HTML e é preciso pedi-lo ao próprio PDF. Word
 * e apresentação já estão desenhados por inteiro, e aí quem responde é o texto
 * da tela.
 */

/** Um trecho encontrado. */
export interface DocumentHit {
  /** Página do PDF (1 em diante). Ausente em Word e apresentação. */
  page?: number;
  /** A frase em volta do achado, para reconhecer o trecho sem sair do lugar. */
  snippet: string;
  /** Onde o trecho começa dentro de `snippet`, para destacá-lo. */
  at: number;
  /** Comprimento do trecho destacado. */
  length: number;
}

/** Sem acento e em minúsculas: "oração" acha "Oracao" e vice-versa. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Quantos caracteres mostrar de cada lado do achado. */
const CONTEXT = 45;

/**
 * Todos os achados dentro de um texto corrido.
 *
 * A comparação é feita na versão sem acento, mas o trecho devolvido vem do
 * texto original — quem lê quer ver a palavra como ela está escrita.
 */
export function findIn(text: string, query: string, page?: number): DocumentHit[] {
  const alvo = fold(query);
  if (!alvo) return [];

  const plano = fold(text);
  const hits: DocumentHit[] = [];
  let from = 0;

  while (hits.length < 50) {
    const index = plano.indexOf(alvo, from);
    if (index < 0) break;

    const start = Math.max(0, index - CONTEXT);
    const end = Math.min(text.length, index + alvo.length + CONTEXT);
    hits.push({
      page,
      snippet:
        (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : ''),
      at: index - start + (start > 0 ? 1 : 0),
      length: alvo.length,
    });
    from = index + alvo.length;
  }
  return hits;
}

/** O que o visualizador precisa saber para procurar num PDF. */
export interface PdfLike {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
}

/**
 * Texto de cada página do PDF, guardado depois da primeira leitura.
 *
 * Extrair o texto de sessenta páginas leva alguns segundos. Fazer isso uma vez
 * por letra digitada tornaria a busca inútil justamente no documento em que ela
 * mais serve, então o resultado fica guardado enquanto o arquivo estiver aberto.
 */
export class PdfTextIndex {
  private readonly pages = new Map<number, string>();

  constructor(private readonly doc: PdfLike) {}

  private async textOf(n: number): Promise<string> {
    const cached = this.pages.get(n);
    if (cached !== undefined) return cached;
    try {
      const page = await this.doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((raw) => (raw as { str?: string }).str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ');
      this.pages.set(n, text);
      return text;
    } catch {
      // uma página ilegível não pode calar a busca nas outras
      this.pages.set(n, '');
      return '';
    }
  }

  /**
   * Procura em todas as páginas, em ordem.
   *
   * `onProgress` existe para a tela poder mostrar o resultado chegando: numa
   * apostila longa, ver os primeiros achados enquanto o resto é lido é a
   * diferença entre uma busca útil e uma espera.
   */
  async search(
    query: string,
    onProgress?: (hits: DocumentHit[], done: number, total: number) => void,
    cancelled?: () => boolean,
  ): Promise<DocumentHit[]> {
    const all: DocumentHit[] = [];
    for (let n = 1; n <= this.doc.numPages; n++) {
      if (cancelled?.()) break;
      const found = findIn(await this.textOf(n), query, n);
      if (found.length) all.push(...found);
      onProgress?.(all, n, this.doc.numPages);
    }
    return all;
  }
}

/**
 * Procura no que já está desenhado na tela — Word e apresentação.
 *
 * Devolve, junto com cada achado, o elemento onde ele está, para a tela saber
 * até onde rolar.
 */
export function searchRendered(
  host: HTMLElement,
  query: string,
): Array<DocumentHit & { node: HTMLElement }> {
  const alvo = fold(query);
  if (!alvo) return [];

  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const hits: Array<DocumentHit & { node: HTMLElement }> = [];

  let node: Node | null;
  while ((node = walker.nextNode()) && hits.length < 50) {
    const text = node.textContent ?? '';
    if (!text.trim() || !fold(text).includes(alvo)) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    for (const hit of findIn(text, query)) hits.push({ ...hit, node: parent });
  }
  return hits;
}
