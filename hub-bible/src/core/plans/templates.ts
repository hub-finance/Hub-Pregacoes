import type { BookMeta, PlanDay } from '../db/types';
import { CANON } from '../bible/canon';

/**
 * Geração de planos de leitura.
 * Os planos são calculados a partir da estrutura real da tradução (nº de
 * capítulos por livro), e não de tabelas fixas — assim continuam corretos para
 * qualquer tradução instalada.
 */

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  days: number;
  /** Livros incluídos (OSIS) — vazio significa "toda a Bíblia". */
  books: string[];
  build: (meta: BookMeta[], days?: number) => PlanDay[];
}

type ChapterRef = [string, number];

const chapterList = (meta: BookMeta[], books: string[]): ChapterRef[] => {
  const wanted = books.length ? books : CANON.map((b) => b.osis);
  const order = new Map(CANON.map((b, i) => [b.osis, i]));
  const list: ChapterRef[] = [];
  for (const osis of [...wanted].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))) {
    const info = meta.find((m) => m.osis === osis);
    if (!info) continue;
    for (let c = 1; c <= info.chapters; c++) list.push([osis, c]);
  }
  return list;
};

/** Agrupa capítulos consecutivos do mesmo livro em intervalos. */
function toRanges(chapters: ChapterRef[]): Array<[string, number, number]> {
  const ranges: Array<[string, number, number]> = [];
  for (const [book, chapter] of chapters) {
    const last = ranges[ranges.length - 1];
    if (last && last[0] === book && last[2] === chapter - 1) last[2] = chapter;
    else ranges.push([book, chapter, chapter]);
  }
  return ranges;
}

/** Distribui a lista de capítulos ao longo dos dias, sem sobras. */
function distribute(list: ChapterRef[], days: number): PlanDay[] {
  const total = list.length;
  const result: PlanDay[] = [];
  let cursor = 0;
  for (let day = 1; day <= days; day++) {
    const end = Math.round((day * total) / days);
    const slice = list.slice(cursor, Math.max(end, cursor + (cursor < total ? 1 : 0)));
    cursor += slice.length;
    result.push({ day, ranges: toRanges(slice) });
  }
  return result;
}

const simple = (books: string[]) => (meta: BookMeta[], days = 365) =>
  distribute(chapterList(meta, books), days);

const NT_BOOKS = CANON.filter((b) => b.testament === 'NT').map((b) => b.osis);
const GOSPELS = ['MAT', 'MRK', 'LUK', 'JHN'];

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'biblia-1-ano',
    name: 'Bíblia em 1 ano',
    description: 'Toda a Bíblia, de Gênesis a Apocalipse, em 365 dias.',
    days: 365,
    books: [],
    build: simple([]),
  },
  {
    id: 'nt-90-dias',
    name: 'Novo Testamento em 90 dias',
    description: 'De Mateus a Apocalipse em três meses de leitura.',
    days: 90,
    books: NT_BOOKS,
    build: simple(NT_BOOKS),
  },
  {
    id: 'evangelhos-30',
    name: 'Evangelhos em 30 dias',
    description: 'Mateus, Marcos, Lucas e João em um mês.',
    days: 30,
    books: GOSPELS,
    build: simple(GOSPELS),
  },
  {
    id: 'salmos-proverbios',
    name: 'Salmos e Provérbios',
    description: 'Um capítulo de Provérbios e cinco Salmos por dia, em 31 dias.',
    days: 31,
    books: ['PSA', 'PRO'],
    build: (meta) => {
      const psalms = meta.find((m) => m.osis === 'PSA')?.chapters ?? 150;
      const proverbs = meta.find((m) => m.osis === 'PRO')?.chapters ?? 31;
      const days: PlanDay[] = [];
      const perDay = Math.ceil(psalms / proverbs);
      let psalm = 1;
      for (let day = 1; day <= proverbs; day++) {
        const chapters: ChapterRef[] = [['PRO', day]];
        for (let i = 0; i < perDay && psalm <= psalms; i++, psalm++) chapters.push(['PSA', psalm]);
        days.push({ day, ranges: toRanges(chapters) });
      }
      return days;
    },
  },
  {
    id: 'at-180',
    name: 'Antigo Testamento em 180 dias',
    description: 'A história da aliança, de Gênesis a Malaquias, em seis meses.',
    days: 180,
    books: CANON.filter((b) => b.testament === 'AT').map((b) => b.osis),
    build: simple(CANON.filter((b) => b.testament === 'AT').map((b) => b.osis)),
  },
  {
    id: 'personalizado',
    name: 'Plano personalizado',
    description: 'Escolha os livros e a quantidade de dias.',
    days: 30,
    books: [],
    build: (meta, days = 30) => distribute(chapterList(meta, []), days),
  },
];

export function buildCustomPlan(meta: BookMeta[], books: string[], days: number): PlanDay[] {
  return distribute(chapterList(meta, books), Math.max(1, days));
}

export const getTemplate = (id: string) => PLAN_TEMPLATES.find((t) => t.id === id);

/** Total de capítulos de um dia. */
export const dayChapterCount = (day: PlanDay): number =>
  day.ranges.reduce((sum, [, from, to]) => sum + (to - from + 1), 0);
