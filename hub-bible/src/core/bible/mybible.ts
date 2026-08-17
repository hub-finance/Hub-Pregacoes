import { SQLiteFile } from '../sqlite/reader';
import { CANON, findBook } from './canon';
import type { StrongTag } from '../db/types';

/**
 * Leitura dos módulos do MyBible (`*.SQLite3`).
 *
 * O MyBible guarda cada módulo como um banco SQLite com um punhado de tabelas:
 * `info` (metadados), `books` (os livros presentes), `verses` (o texto) nas
 * Bíblias, e `dictionary` (verbete e definição) nos dicionários. É o formato em
 * que circulam as Bíblias com números Strong em português.
 *
 * Aqui só se **lê** o arquivo que o usuário já tem no aparelho. Nada é baixado
 * e nada é embutido no aplicativo.
 */

export type { StrongTag } from '../db/types';

export type MyBibleKind = 'bible' | 'dictionary' | 'unknown';

export interface MyBibleBible {
  kind: 'bible';
  info: Record<string, string>;
  /** OSIS -> capítulos -> versículos, já sem a marcação do MyBible. */
  books: Record<string, string[][]>;
  /** OSIS -> capítulos -> versículos -> etiquetas Strong. Ausente sem Strong. */
  strongs?: Record<string, StrongTag[][][]>;
  /** Livros do arquivo que não couberam no cânone de 66 (deuterocanônicos). */
  skipped: string[];
}

export interface MyBibleDictionary {
  kind: 'dictionary';
  info: Record<string, string>;
  entries: Array<{ topic: string; definition: string }>;
}

/**
 * Numeração de livros do MyBible, na ordem canônica protestante.
 *
 * O formato numera de dez em dez, com buracos onde ficam os deuterocanônicos
 * (170 Tobias, 180 Judite, 270…): por isso a lista é explícita em vez de
 * calculada. Os 66 números abaixo, em ordem crescente, correspondem um a um
 * a `CANON` — de Gênesis a Apocalipse.
 */
const MYBIBLE_BOOK_NUMBERS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 190, 220, 230, 240, 250,
  260, 290, 300, 310, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450, 460,
  470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650,
  660, 670, 680, 690, 700, 710, 720, 730,
];

if (MYBIBLE_BOOK_NUMBERS.length !== CANON.length) {
  // erro de programação, não de arquivo: melhor falhar alto e cedo
  throw new Error('A numeração do MyBible saiu do tamanho do cânone.');
}

const NUMBER_TO_OSIS = new Map<number, string>(
  MYBIBLE_BOOK_NUMBERS.map((n, i) => [n, CANON[i].osis]),
);

/* --------------------------- que módulo é este --------------------------- */

export function moduleKind(db: SQLiteFile): MyBibleKind {
  if (db.has('verses')) return 'bible';
  if (db.has('dictionary')) return 'dictionary';
  return 'unknown';
}

function readInfo(db: SQLiteFile): Record<string, string> {
  const info: Record<string, string> = {};
  if (!db.has('info')) return info;
  for (const row of db.rows('info')) {
    const name = row.name ?? row.key;
    if (typeof name === 'string') info[name] = String(row.value ?? '');
  }
  return info;
}

/* ------------------------------ a marcação ------------------------------- */

/* O que o MyBible põe no meio do texto:
     <S>430</S>   número Strong da palavra anterior
     <f>…</f>     chamada de nota de rodapé
     <n>…</n>     nota
     <i>…</i>     palavra acrescentada pelo tradutor
     <J>…</J>     palavras de Jesus
     <pb/> <br/>  quebras
   Para ler, o que vale é o texto; as notas saem, o resto fica sem a etiqueta. */
const DROP_WITH_CONTENT = /<(f|n)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Separa o texto limpo das etiquetas Strong, mantendo a ligação com a palavra.
 *
 * No formato, o `<S>` vem **depois** da palavra a que pertence — por isso a
 * varredura é sequencial: conta-se quantas palavras já saíram e o código é
 * amarrado à última delas. Uma palavra pode ter mais de um código.
 */
export function parseVerse(raw: string): { text: string; strongs: StrongTag[] } {
  const cleaned = String(raw ?? '').replace(DROP_WITH_CONTENT, '');
  const strongs: StrongTag[] = [];
  let text = '';
  /** Quantas palavras já começaram. */
  let words = 0;
  /** A última palavra ainda pode continuar depois da etiqueta. */
  let openWord = false;

  /* Uma etiqueta no meio da palavra (`<i>palavra</i>s`) não pode contar como
     duas: o trecho que vem colado continua a palavra anterior. */
  const absorb = (chunk: string) => {
    if (!chunk) return;
    text += chunk;
    const tokens = chunk.split(/\s+/);
    const attached = !/^\s/.test(chunk);
    tokens.forEach((token, i) => {
      if (!token) return;
      if (i === 0 && attached && openWord) return;
      words++;
    });
    openWord = !/\s$/.test(chunk);
  };

  const TOKEN = /<S>\s*([HGhg]?\d+)\s*<\/S>|<[^>]*>/g;
  let at = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN.exec(cleaned))) {
    absorb(cleaned.slice(at, match.index));
    at = match.index + match[0].length;
    const code = match[1];
    if (code && words > 0) strongs.push([words - 1, code.toUpperCase()]);
  }
  absorb(cleaned.slice(at));

  return { text: collapse(text), strongs };
}

const collapse = (s: string) =>
  s
    .replace(/\u00a0/g, ' ') // espaço fixo: invisível no fonte se for literal
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?»)\]])/g, '$1')
    .trim();

/**
 * Divide um versículo em palavras do mesmo jeito que `parseVerse` contou, para
 * que o índice das etiquetas Strong caia na palavra certa na hora de exibir.
 */
export function verseWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/* -------------------------------- Bíblia --------------------------------- */

export function readBible(db: SQLiteFile): MyBibleBible {
  const info = readInfo(db);

  /* O número do livro é o caminho normal. O nome só entra quando o número não
     é conhecido — há módulos que numeram fora do padrão. */
  const nameByNumber = new Map<number, string>();
  for (const table of ['books', 'books_all']) {
    if (!db.has(table)) continue;
    for (const row of db.rows(table)) {
      const n = Number(row.book_number);
      const label = String(row.long_name ?? row.short_name ?? '').trim();
      if (Number.isFinite(n) && label && !nameByNumber.has(n)) nameByNumber.set(n, label);
    }
  }

  /* Qual identificação mandar: o número ou o nome.
     A numeração de dez em dez é a do formato, e é exata quando o módulo a
     segue. Mas há módulos numerados 1..66 — e aí o número 10 seria lido como
     Gênesis, calado e errado. Por isso a escolha é feita uma vez, olhando o
     conjunto: se quase todos os números são conhecidos, vale o número; se não,
     vale o nome que o próprio arquivo declara. */
  const numbers = [...nameByNumber.keys()];
  const known = numbers.filter((n) => NUMBER_TO_OSIS.has(n)).length;
  const trustNumbers = !numbers.length || known / numbers.length > 0.8;

  const books: Record<string, string[][]> = {};
  const strongs: Record<string, StrongTag[][][]> = {};
  const skipped = new Set<string>();
  let anyStrong = false;

  for (const row of db.rows('verses')) {
    const number = Number(row.book_number);
    const chapter = Number(row.chapter);
    const verse = Number(row.verse);
    if (!Number.isFinite(number) || !Number.isFinite(chapter) || !Number.isFinite(verse)) continue;

    const byNumber = NUMBER_TO_OSIS.get(number);
    const byName = resolveByName(nameByNumber.get(number));
    const osis = trustNumbers ? (byNumber ?? byName) : (byName ?? byNumber);
    if (!osis) {
      skipped.add(nameByNumber.get(number) ?? `livro ${number}`);
      continue;
    }

    const parsed = parseVerse(String(row.text ?? ''));
    normalizeCodes(parsed.strongs, osis);
    const chapters = (books[osis] ||= []);
    const verses = (chapters[chapter - 1] ||= []);
    verses[verse - 1] = parsed.text;

    if (parsed.strongs.length) {
      anyStrong = true;
      const sChapters = (strongs[osis] ||= []);
      const sVerses = (sChapters[chapter - 1] ||= []);
      sVerses[verse - 1] = parsed.strongs;
    }
  }

  // buracos viram string vazia: o leitor conta versículo pela posição
  for (const osis of Object.keys(books)) {
    books[osis] = books[osis].map((chapter) => Array.from(chapter ?? [], (v) => v ?? ''));
  }

  return {
    kind: 'bible',
    info,
    books,
    strongs: anyStrong ? strongs : undefined,
    skipped: [...skipped],
  };
}

function resolveByName(label: string | undefined): string | undefined {
  if (!label) return undefined;
  return findBook(label)?.osis;
}

const NT = new Set(CANON.filter((b) => b.testament === 'NT').map((b) => b.osis));

/**
 * Muitos módulos gravam o código Strong só com o número — a letra fica
 * implícita no testamento: hebraico no Antigo, grego no Novo. Os dicionários,
 * porém, são indexados por `H430` e `G26`, então a letra tem de entrar aqui,
 * ou nada casa depois.
 */
function normalizeCodes(tags: StrongTag[], osis: string): void {
  const prefix = NT.has(osis) ? 'G' : 'H';
  for (const tag of tags) {
    if (/^\d+$/.test(tag[1])) tag[1] = prefix + tag[1];
  }
}

/* ------------------------------ dicionário -------------------------------- */

export function readDictionary(db: SQLiteFile): MyBibleDictionary {
  const info = readInfo(db);
  const entries: Array<{ topic: string; definition: string }> = [];
  for (const row of db.rows('dictionary')) {
    const topic = String(row.topic ?? '').trim();
    const definition = String(row.definition ?? '').trim();
    if (topic && definition) entries.push({ topic, definition });
  }
  return { kind: 'dictionary', info, entries };
}

/**
 * Um dicionário Strong tem por verbete o próprio código (`H430`, `G26`) — é o
 * que permite ligá-lo às etiquetas do texto.
 */
export function isStrongDictionary(dict: MyBibleDictionary): boolean {
  if (/^(true|1|yes)$/i.test(dict.info.is_strong ?? '')) return true;
  const sample = dict.entries.slice(0, 40);
  if (!sample.length) return false;
  const coded = sample.filter((e) => /^[HG]?\d+$/i.test(e.topic)).length;
  return coded / sample.length > 0.7;
}

/** Nome legível do módulo, para mostrar na lista. */
export function moduleName(info: Record<string, string>, fallback: string): string {
  return (info.description || info.origin || info.name || fallback).trim() || fallback;
}
