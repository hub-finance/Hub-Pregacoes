import { db } from '../db/db';
import type { CachedBook, Pericope } from '../db/types';

/**
 * Títulos dos Salmos ("Salmo de Davi quando fugia de Absalão, seu filho").
 *
 * Nos módulos importados (a ARA do usuário, p.ex.) o título vem grudado no
 * começo do versículo 1, e parecia parte do texto bíblico. Aqui ele é
 * separado: sai do versículo e vira um título próprio do capítulo, mostrado
 * acima do salmo em itálico — como nas Bíblias impressas.
 *
 * Só nos Salmos e só no versículo 1. Cada frase do começo precisa abrir com
 * uma palavra típica de título; "Aleluia!" fica no texto, porque na ARA ele é
 * parte do versículo.
 */

const TITLE_START =
  /^(ao mestre de canto|ao regente|ao músico-mor|ao cantor-mor|para o cantor-mor|para o regente|salmo|cântico|canção|oração|hino|mictão|masquil|sigaiom|lamentação|de davi|dos filhos de corá|de asafe|de salomão|de moisés|para o dia|para lembrança|para ensinar|davi|ele disse|e disse)\b/i;

/** Uma frase do começo, até o ponto (ou dois-pontos) seguido de espaço. "Ele disse:" fecha o título longo do Sl 18. */
const SENTENCE = /^[^.:!?]{2,300}[.:](?=\s)/;

export interface PsalmTitleSplit {
  title: string;
  rest: string;
  /** Quantas palavras saíram do começo do versículo (para os números Strong). */
  words: number;
}

export function splitPsalmTitle(text: string): PsalmTitleSplit | null {
  let rest = text.trimStart();
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    if (!TITLE_START.test(rest)) break;
    const m = rest.match(SENTENCE);
    if (!m) break;
    parts.push(m[0].trim());
    rest = rest.slice(m[0].length).trimStart();
  }
  // sobra texto de verdade, começando por maiúscula (ou aspas): senão não é título
  if (!parts.length || rest.length < 8 || !/^[\p{Lu}"“«(]/u.test(rest)) return null;
  const title = parts.join(' ');
  return { title, rest, words: title.split(/\s+/).filter(Boolean).length };
}

/**
 * Tira os títulos do versículo 1 de cada salmo do livro e os guarda como
 * `pericopes` de tipo `superscription`. Ajusta as posições dos números Strong.
 * Devolve se mudou alguma coisa.
 */
export function separatePsalmTitles(record: CachedBook): boolean {
  if (record.book !== 'PSA') return false;
  let changed = false;
  const pericopes: Pericope[] = [...(record.pericopes ?? [])];
  record.chapters.forEach((verses, ci) => {
    const first = verses[0];
    if (!first) return;
    const split = splitPsalmTitle(first);
    if (!split) return;
    verses[0] = split.rest;
    const tags = record.strongs?.[ci]?.[0];
    if (tags && record.strongs) {
      record.strongs[ci][0] = tags
        .filter(([w]) => w >= split.words)
        .map(([w, code]) => [w - split.words, code] as [number, string]);
    }
    if (!pericopes.some((p) => p.chapter === ci + 1 && p.kind === 'superscription')) {
      pericopes.push({ chapter: ci + 1, verse: 1, title: split.title, kind: 'superscription' });
    }
    changed = true;
  });
  if (changed) record.pericopes = pericopes.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
  record.psalmTitlesSeparated = true;
  return changed;
}

/**
 * Para as traduções já importadas (e as que voltam de um backup antigo): faz a
 * separação uma vez em cada uma. Silenciosa; roda a cada abertura, mas depois
 * da primeira passada só confere a marca.
 */
export async function separateImportedPsalmTitles(): Promise<number> {
  let done = 0;
  try {
    const metas = await db.settings.where('key').startsWith('translation:meta:').primaryKeys();
    for (const key of metas as string[]) {
      const id = key.replace('translation:meta:', '');
      const record = await db.books.get(`${id}:PSA`);
      if (!record || record.psalmTitlesSeparated) continue;
      const changed = separatePsalmTitles(record);
      await db.books.put(record);
      if (changed) done++;
    }
  } catch {
    /* banco indisponível agora: tenta na próxima abertura */
  }
  return done;
}
