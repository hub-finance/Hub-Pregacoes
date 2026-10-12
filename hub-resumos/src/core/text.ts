import { findReferences, fold, type FoundReference } from './bible';
import type { Material, Section } from './types';

/**
 * Leitura do texto das seções — tudo aqui é cálculo sobre o que o autor
 * escreveu, sem internet e sem IA. Nada é inventado: cada destaque, termo,
 * pergunta ou referência apontado pelo app está, literalmente, no texto.
 */

export interface Definition {
  term: string;
  meaning: string;
  sectionId: string;
}

export interface Located {
  text: string;
  sectionId: string;
}

export interface SectionReading {
  section: Section;
  paragraphs: string[];
  highlights: string[];
  listItems: string[];
  definitions: Definition[];
  questions: string[];
  references: FoundReference[];
  words: number;
}

const HIGHLIGHT = /^\s*>\s?(.*)$/;
const LIST = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;
/** "Termo: definição" — termo de até 5 palavras, sem ser referência ("João 3:16"). */
const DEFINITION = /^\s*([\p{L}][\p{L}\s'’-]{1,48}?)\s*[:–—]\s+(.{8,})$/u;

export function readSection(section: Section): SectionReading {
  const lines = section.text.replace(/\r\n?/g, '\n').split('\n');
  const highlights: string[] = [];
  const listItems: string[] = [];
  const definitions: Definition[] = [];
  const questions: string[] = [];
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const p = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (p) paragraphs.push(p);
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = HIGHLIGHT.exec(line);
    if (h) {
      flush();
      if (h[1].trim()) highlights.push(h[1].trim());
      continue;
    }
    const l = LIST.exec(line);
    if (l) {
      flush();
      // caixa de tarefa ("- [ ] …") não é parte do texto do item
      listItems.push(l[1].replace(/^\[\s?[xX]?\]\s*/, '').trim());
      const d = DEFINITION.exec(l[1]);
      if (d && d[1].split(/\s+/).length <= 5) definitions.push({ term: d[1].trim(), meaning: d[2].trim(), sectionId: section.id });
      continue;
    }
    const d = DEFINITION.exec(line);
    if (d && d[1].split(/\s+/).length <= 5 && !/\d/.test(d[1])) {
      flush();
      definitions.push({ term: d[1].trim(), meaning: d[2].trim(), sectionId: section.id });
      continue;
    }
    buffer.push(line);
  }
  flush();

  for (const p of [...paragraphs, ...listItems]) {
    for (const s of sentences(p)) if (s.endsWith('?')) questions.push(s);
  }

  return {
    section,
    paragraphs,
    highlights,
    listItems,
    definitions,
    questions,
    references: findReferences(`${section.title}\n${section.text}`),
    words: countWords(section.text),
  };
}

export const countWords = (text: string) => (text.match(/[\p{L}\d]+/gu) ?? []).length;

/** Frases de um parágrafo (sem quebrar em "Jo 3.16" nem em "Sr."). */
export function sentences(paragraph: string): string[] {
  return paragraph
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ“"(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

/* ------------------------------ palavras-chave ------------------------------ */

const STOPWORDS = new Set(
  `a à às ao aos as o os um uma uns umas de do da dos das em no na nos nas num numa por pelo pela pelos pelas para pra
  com sem sob sobre entre até após ante contra desde e ou mas nem que se porque pois quando como onde enquanto
  também já ainda só apenas mais menos muito muita muitos muitas pouco pouca tão tanto toda todo todos todas tudo
  nada algo alguém ninguém cada outro outra outros outras mesmo mesma mesmos mesmas próprio própria qual quais
  quem cujo cuja este esta estes estas esse essa esses essas aquele aquela aqueles aquelas isto isso aquilo
  eu tu ele ela nós vós eles elas me te lhe nos vos lhes meu minha meus minhas teu tua seu sua seus suas nosso nossa
  nossos nossas vosso vossa dele dela deles delas lo la los las ser é são era eram foi foram será serão seja sejam
  sendo sido estar está estão estava estavam esteve estiveram estará ter tem têm tinha tinham teve tiveram terá
  haver há havia houve fazer faz fazem fez feito pode podem poder deve devem dever vai vão ir vamos vem veio
  não sim aqui ali lá então assim agora sempre nunca bem mal onde porém contudo todavia logo portanto
  disse diz dizer dá dar deu sobre vez vezes dia dias ano anos parte forma maneira modo coisa coisas
  primeiro segunda primeira segundo terceiro ponto pontos capítulo seção texto versículo versículos`.split(/\s+/),
);

export interface Keyword {
  word: string;
  count: number;
  /** Em quantas seções aparece. */
  sections: number;
}

/**
 * Palavras mais presentes no material, sem as palavras de ligação.
 * Plural e singular contam juntos ("graça"/"graças").
 */
export function keywords(material: Material, limit = 12): Keyword[] {
  const counts = new Map<string, { count: number; sections: Set<string>; forms: Map<string, number> }>();
  for (const s of material.sections) {
    for (const raw of `${s.title} ${s.text}`.match(/[\p{L}]{4,}/gu) ?? []) {
      const lower = raw.toLowerCase();
      if (STOPWORDS.has(lower)) continue;
      const stem = fold(lower).replace(/(oes|aes|ais|eis|ns|s)$/, (m) => (m === 'ns' ? 'm' : m === 's' ? '' : m));
      if (stem.length < 4) continue;
      const entry = counts.get(stem) ?? { count: 0, sections: new Set(), forms: new Map() };
      entry.count++;
      entry.sections.add(s.id);
      entry.forms.set(lower, (entry.forms.get(lower) ?? 0) + 1);
      counts.set(stem, entry);
    }
  }
  return [...counts.values()]
    .filter((e) => e.count >= 2)
    .map((e) => ({
      word: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: e.count,
      sections: e.sections.size,
    }))
    .sort((a, b) => b.count * (1 + b.sections * 0.3) - a.count * (1 + a.sections * 0.3))
    .slice(0, limit);
}

/** Palavras-chave de uma seção só. */
export function sectionKeywords(section: Section, limit = 3): string[] {
  return keywords(
    { sections: [section] } as Material,
    limit,
  ).map((k) => k.word);
}

/* --------------------------- divisão em seções --------------------------- */

/**
 * Texto corrido (colado ou importado) dividido em seções pelos títulos:
 * linhas de Markdown (`# Título`), "Capítulo 3 — …", "Lição 2", "Módulo 1"
 * ou linhas curtas em MAIÚSCULAS. Sem nenhum título, vira uma seção só.
 */
export function splitIntoSections(text: string, fallbackTitle = 'Conteúdo'): Array<{ title: string; text: string }> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: Array<{ title: string; lines: string[] }> = [];
  const isHeading = (line: string): string | null => {
    const t = line.trim();
    const md = /^#{1,4}\s+(.+?)\s*#*$/.exec(t);
    if (md) return md[1];
    if (/^(cap[ií]tulo|li[cç][aã]o|m[oó]dulo|parte|aula|unidade|semana|dia)\s+[\divxlc]+\b.{0,80}$/i.test(t)) return t;
    if (t.length >= 4 && t.length <= 70 && t === t.toUpperCase() && /[A-ZÁÉÍÓÚ]{3}/.test(t) && !/[.!?:]$/.test(t)) {
      return t.charAt(0) + t.slice(1).toLowerCase();
    }
    return null;
  };
  for (const line of lines) {
    const heading = isHeading(line);
    if (heading) out.push({ title: heading, lines: [] });
    else {
      if (!out.length) out.push({ title: fallbackTitle, lines: [] });
      out[out.length - 1].lines.push(line);
    }
  }
  return out
    .map((s) => ({ title: s.title.trim(), text: s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() }))
    .filter((s, _, all) => s.text || all.length === 1 || s.title !== fallbackTitle);
}

/* ------------------------------ leitura geral ------------------------------ */

export interface MaterialReading {
  sections: SectionReading[];
  words: number;
  minutes: number;
  highlights: Located[];
  definitions: Definition[];
  questions: Located[];
  references: Array<FoundReference & { sectionId: string; count: number }>;
  keywords: Keyword[];
}

export function readMaterial(material: Material): MaterialReading {
  const sections = material.sections.map(readSection);
  const refMap = new Map<string, FoundReference & { sectionId: string; count: number; order: number }>();
  sections.forEach((s, si) => {
    for (const r of s.references) {
      const found = refMap.get(r.label);
      if (found) found.count++;
      else refMap.set(r.label, { ...r, sectionId: s.section.id, count: 1, order: si * 1e6 + r.index });
    }
  });
  const words = sections.reduce((n, s) => n + s.words, 0);
  return {
    sections,
    words,
    // leitura atenta de estudo: ~180 palavras por minuto
    minutes: Math.max(1, Math.round(words / 180)),
    highlights: sections.flatMap((s) => s.highlights.map((text) => ({ text, sectionId: s.section.id }))),
    definitions: sections.flatMap((s) => s.definitions),
    questions: sections.flatMap((s) => s.questions.map((text) => ({ text, sectionId: s.section.id }))),
    // mais citada primeiro; no empate, a que aponta versículo, depois a que aparece antes
    references: [...refMap.values()].sort(
      (a, b) => b.count - a.count || Number(!!b.verse) - Number(!!a.verse) || a.order - b.order,
    ),
    keywords: keywords(material),
  };
}
