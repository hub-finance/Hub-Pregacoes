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

  // cabeçalhos de página: o título da parte e linhas curtas que se repetem
  // (nome do livro, do capítulo) não são conteúdo — viravam "definições" falsas
  const titleK = titleKey(section.title);
  const repeats = new Map<string, number>();
  for (const raw of lines) {
    const t = raw.trim();
    if (t && t.length <= 80) repeats.set(t, (repeats.get(t) ?? 0) + 1);
  }
  const isRunningHeader = (line: string) =>
    (titleK.length >= 3 && titleKey(line) === titleK) || (line.length <= 80 && (repeats.get(line) ?? 0) >= 3) || /^\d{1,4}$/.test(line);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (isRunningHeader(line)) continue;
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

export const STOPWORDS = new Set(
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

type Part = { title: string; text: string };

/** Comparação de títulos: sem acento, sem pontuação, sem "Capítulo 3"/"1." na frente. */
function titleKey(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(capitulo|cap|licao|modulo|parte|aula|unidade|secao|seccao|sessao|topico|livro)\s+[0-9ivxlc]+\s*/, '')
    .replace(/^[0-9ivxlc]{1,4}\s+/, '')
    .trim();
}

const TOC_HEAD = /^(sum[aá]rio|[ií]ndice|conte[uú]do|contents)$/i;
/** "1. A lei do limite ........ 15" → "1. A lei do limite" (sem os pontos e o número da página). */
const tocEntry = (line: string) => line.replace(/[\s.·…_–-]*\d{1,4}\s*$/, '').replace(/\s+/g, ' ').trim();
const CHAPTER_NUMBER = /^(cap[ií]tulo|li[cç][aã]o|m[oó]dulo|parte|aula|unidade|se[cç][cç]?[aã]o|sess[aã]o|t[oó]pico|livro)?\s*[\divxlc]{1,4}\.?$/i;
/** Ficha catalográfica, créditos e números soltos não são capítulos. */
const FRONT_MATTER = /isbn|\bcdd\b|\bcdu\b|\bcip\b|cataloga[cç][aã]o|©|copyright|direitos reservados|editora|tradu[cç][aã]o|impress[aã]o|^\d[\d\s./:-]*$|\d{4,}/i;

/**
 * Sumário do próprio livro: a linha "Sumário"/"Índice" e as entradas logo
 * abaixo. Depois, cada entrada é procurada no corpo, na mesma ordem; o
 * livro é dividido onde os capítulos realmente começam. O que vem antes do
 * primeiro capítulo (capa, ficha catalográfica, o próprio sumário) fica de fora.
 */
/** Termina com o número da página: "…… 29", ". . . 7", "Reino 15". */
const HAS_PAGE = /(?:[.·…_–-]\s?){2,}\s*\d{1,4}\s*$|\s\d{1,4}\s*$/;
/** Começa com o número do capítulo: "1. ", "10 ", "3) ". */
const STARTS_NUMBER = /^\d{1,3}[.)]?\s+\S/;

/**
 * Onde começam as entradas do sumário. Pela linha "Sumário"/"Índice" ou,
 * quando ela não veio no texto do PDF, por um bloco de linhas numeradas com o
 * número da página no fim ("1. Origens … 7", "2. Divisão … 29"…), logo no
 * começo do livro.
 */
function tocStart(lines: string[], limit: number): number {
  const head = lines.findIndex((l, i) => i < limit && TOC_HEAD.test(l.trim()));
  if (head >= 0) return head + 1;
  for (let i = 0; i < limit && i < lines.length; i++) {
    const t = lines[i].trim();
    if (!/^1[.)]?\s+\S/.test(t)) continue;
    let numbered = 0;
    let paged = 0;
    for (let j = i, seen = 0; j < lines.length && seen < 60; j++) {
      const u = lines[j].trim();
      if (!u) continue;
      seen++;
      if (u.length > 160) break;
      if (STARTS_NUMBER.test(u)) numbered++;
      if (HAS_PAGE.test(u)) paged++;
    }
    if (numbered >= 3 && paged >= 3) return i;
  }
  return -1;
}

/**
 * Sumário do próprio livro: as entradas logo abaixo de "Sumário"/"Índice"
 * (ou o bloco numerado com páginas). Títulos que são perguntas e títulos
 * quebrados em duas linhas ("4. Fazendo Distinção entre Opressão, /
 * Obsessão e Possessão . . . 83") entram inteiros. Depois, cada entrada é
 * procurada no corpo, na mesma ordem; o livro é dividido onde os capítulos
 * realmente começam. O que vem antes do primeiro capítulo (capa, ficha
 * catalográfica, o próprio sumário) fica de fora.
 */
function readToc(lines: string[]): { entries: string[]; end: number } | null {
  const limit = Math.max(400, Math.floor(lines.length * 0.4));
  const start = tocStart(lines, limit);
  if (start < 0) return null;
  const entries: string[] = [];
  let misses = 0;
  let end = start - 1;
  let pending = '';
  const push = (raw: string, at: number) => {
    const e = tocEntry(raw);
    if (e.length >= 3 && e.length <= 160 && /\p{L}{2}/u.test(e) && !TOC_HEAD.test(e)) {
      entries.push(e);
      end = at;
      misses = 0;
      return true;
    }
    return false;
  };
  for (let j = start; j < lines.length && j < start + 400 && misses < 4; j++) {
    let raw = lines[j].trim();
    if (!raw) continue;
    // o texto corrido começou: o sumário acabou
    if (raw.length > 160) break;
    // o primeiro título do sumário reaparece: é o começo do livro, não outra entrada
    if (entries.length >= 3 && entries.some((x) => titleKey(x) === titleKey(tocEntry(raw)))) break;
    if (pending) {
      // continuação do título da linha anterior (não começa com número)
      if (!STARTS_NUMBER.test(raw)) {
        raw = `${pending} ${raw}`;
        pending = '';
      } else {
        push(pending, j - 1);
        pending = '';
      }
    }
    // sumário numerado ("1.", "2."…): a primeira linha sem número encerra o sumário
    const numbered = entries.filter((x) => STARTS_NUMBER.test(x)).length;
    if (entries.length >= 3 && numbered >= entries.length * 0.7 && !STARTS_NUMBER.test(raw)) break;
    // título numerado sem página: pode continuar na linha de baixo
    if (STARTS_NUMBER.test(raw) && !HAS_PAGE.test(raw)) {
      pending = raw;
      continue;
    }
    if (!push(raw, j)) misses++;
  }
  if (pending) push(pending, end + 1);
  return entries.length >= 3 ? { entries, end } : null;
}

function splitByToc(lines: string[]): Part[] | null {
  const toc = readToc(lines);
  if (!toc) return null;
  const { entries, end } = toc;

  return locateChapters(lines, entries, end + 1);
}

/**
 * Procura cada título no corpo, a partir da linha `from` e na mesma ordem, e
 * divide ali. Aceita o título com ou sem "Capítulo 3"/"3." na frente, em
 * maiúsculas ou não, e quebrado em até três linhas. Só divide se achar a
 * maioria dos títulos.
 */
function locateChapters(lines: string[], entries: string[], from: number): Part[] | null {
  const starts: Array<{ line: number; body: number; title: string }> = [];
  let cursor = from;
  for (const entry of entries) {
    const key = titleKey(entry);
    if (key.length < 3) continue;
    for (let k = cursor; k < lines.length; k++) {
      const t = lines[k].trim();
      if (!t || t.length > key.length + 40) continue;
      const lk = titleKey(t);
      const two = k + 1 < lines.length ? titleKey(`${t} ${lines[k + 1].trim()}`) : '';
      const three = k + 2 < lines.length ? titleKey(`${t} ${lines[k + 1].trim()} ${lines[k + 2].trim()}`) : '';
      let body = -1;
      if (lk === key) body = k + 1;
      else if (two === key && lines[k + 1].trim().length <= key.length + 40) body = k + 2;
      else if (three === key && lines[k + 1].trim().length + lines[k + 2].trim().length <= key.length + 40) body = k + 3;
      if (body < 0) continue;
      // "CAPÍTULO 1" numa linha e o título na seguinte: o capítulo começa no número
      let line = k;
      for (let b = k - 1; b >= cursor && k - b <= 2; b--) {
        const prev = lines[b].trim();
        if (!prev) continue;
        if (CHAPTER_NUMBER.test(prev)) line = b;
        break;
      }
      starts.push({ line, body, title: entry });
      cursor = body;
      break;
    }
  }
  if (starts.length < 3 || starts.length < entries.length * 0.5) return null;
  return starts.map((s, i) => ({
    title: s.title,
    text: lines.slice(s.body, i + 1 < starts.length ? starts[i + 1].line : lines.length).join('\n'),
  }));
}

/**
 * Divide pelos títulos que o usuário informou (um por linha), procurando
 * cada um no texto. Devolve null se não achar a maioria deles.
 */
export function splitByChapterTitles(text: string, titles: string[]): Part[] | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const entries = titles.map((t) => tocEntry(t.trim())).filter((t) => titleKey(t).length >= 3);
  if (!entries.length) return null;
  // o sumário também traz os títulos: a procura começa depois dele
  const from = (readToc(lines)?.end ?? -1) + 1;
  const parts = locateChapters(lines, entries, from) ?? (from > 0 ? locateChapters(lines, entries, 0) : null);
  return parts && parts.map((p) => ({ title: p.title.trim(), text: p.text.replace(/\n{3,}/g, '\n\n').trim() }));
}

/**
 * Texto corrido (colado ou importado) dividido em partes:
 * 1. pelo sumário do livro, quando há um (ver splitByToc);
 * 2. por títulos claros — `# Título` (os marcadores do PDF entram assim) ou
 *    "Capítulo 3 — …", "Seção 2", "Parte I", "Lição 2", "Módulo 1", "Tópico 4";
 * 3. só sem nada disso, por linhas curtas em MAIÚSCULAS — ignorando ficha
 *    catalográfica e cabeçalhos que se repetem em toda página, e juntando à
 *    parte anterior os pedaços pequenos demais para serem capítulo.
 * Sem nenhum título, vira uma parte só.
 */
export function splitIntoSections(text: string, fallbackTitle = 'Conteúdo'): Part[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const clean = (parts: Part[]) =>
    parts
      .map((s) => ({ title: s.title.trim(), text: s.text.replace(/\n{3,}/g, '\n\n').trim() }))
      .filter((s, _, all) => s.text || all.length === 1 || s.title !== fallbackTitle);

  const toc = splitByToc(lines);
  if (toc) return clean(toc);

  const strong = (t: string): string | null => {
    const md = /^#{1,4}\s+(.+?)\s*#*$/.exec(t);
    if (md) return md[1];
    if (/^(cap[ií]tulo|li[cç][aã]o|m[oó]dulo|parte|aula|unidade|semana|dia|se[cç][cç]?[aã]o|sess[aã]o|t[oó]pico|livro)\s+[\divxlc]+\b.{0,80}$/i.test(t)) return t;
    return null;
  };
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l.trim(), (counts.get(l.trim()) ?? 0) + 1);
  const caps = (t: string): string | null =>
    t.length >= 4 &&
    t.length <= 70 &&
    t === t.toUpperCase() &&
    /[A-ZÁÉÍÓÚ]{3}/.test(t) &&
    !/[.!?:]$/.test(t) &&
    !FRONT_MATTER.test(t) &&
    (counts.get(t) ?? 0) < 3 // repete em toda página: é cabeçalho, não capítulo
      ? t.charAt(0) + t.slice(1).toLowerCase()
      : null;
  const useStrong = lines.filter((l) => strong(l.trim())).length >= 2;

  const out: Array<{ title: string; lines: string[] }> = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    let heading = useStrong ? strong(t) : strong(t) ?? caps(t);
    // "CAPÍTULO 1" sozinho: o título vem na linha seguinte
    if (heading && CHAPTER_NUMBER.test(t)) {
      const next = lines[i + 1]?.trim() ?? '';
      if (next && next.length <= 80 && !/[.!?]$/.test(next)) {
        heading = `${t} — ${next}`;
        i++;
      }
    }
    if (heading) out.push({ title: heading, lines: [] });
    else {
      if (!out.length) out.push({ title: fallbackTitle, lines: [] });
      out[out.length - 1].lines.push(lines[i]);
    }
  }
  let parts: Part[] = out.map((s) => ({ title: s.title, text: s.lines.join('\n') }));
  // muitas partes minúsculas: eram títulos falsos — juntam-se à anterior
  if (!useStrong && parts.length > 25) {
    const merged: Part[] = [];
    for (const p of parts) {
      if (merged.length && countWords(p.text) < 80) {
        const last = merged[merged.length - 1];
        last.text = `${last.text}\n${p.title}\n${p.text}`;
      } else merged.push({ ...p });
    }
    parts = merged;
  }
  return clean(parts);
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

/** Tira "1." / "05 —" / "Capítulo 3 —" do começo do título, para rótulos curtos. */
export const cleanTitle = (title: string) =>
  title
    .replace(/^(cap[ií]tulo|li[cç][aã]o|m[oó]dulo|parte|aula|unidade|se[cç][cç]?[aã]o|sess[aã]o|t[oó]pico|livro)\s+[\divxlc]+\s*[—–:.-]?\s*/i, '')
    .replace(/^\d{1,3}\s*[.)—–:-]?\s+/, '')
    .trim() || title;

/* -------------------- frases de uma parte, separadas uma vez -------------------- */

const SENTENCES = new WeakMap<SectionReading, string[]>();
const REF_SENTENCE = new WeakMap<SectionReading, Map<string, string>>();

/**
 * As frases de uma parte (parágrafos, destaques e listas). Separar o texto em
 * frases a cada versículo deixava o app travando em livros grandes: agora é
 * feito uma vez por parte e reaproveitado.
 */
export function sectionSentences(s: SectionReading): string[] {
  let list = SENTENCES.get(s);
  if (!list) {
    list = [...s.paragraphs, ...s.highlights, ...s.listItems].flatMap(sentences);
    SENTENCES.set(s, list);
  }
  return list;
}

/** A primeira frase da parte em que a referência aparece (vazio se não achar). */
export function referenceSentence(s: SectionReading, ref: { label: string; raw: string }): string {
  let map = REF_SENTENCE.get(s);
  if (!map) {
    map = new Map();
    for (const x of sectionSentences(s)) for (const found of findReferences(x)) if (!map.has(found.label)) map.set(found.label, x);
    REF_SENTENCE.set(s, map);
  }
  return map.get(ref.label) ?? sectionSentences(s).find((x) => x.includes(ref.raw.trim())) ?? '';
}

/**
 * Uma impressão digital do texto das partes: a leitura do livro (que leva
 * centenas de milissegundos num livro grande) só é refeita quando o texto
 * muda — não quando o material é só aberto ou ganha um resumo da IA.
 */
export function sectionsKey(sections: Material['sections']): string {
  let h = 2166136261;
  for (const s of sections) {
    const t = `${s.id}\u0001${s.title}\u0001${s.text}\u0002`;
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  }
  return `${sections.length}:${(h >>> 0).toString(36)}`;
}

/* ------------------------- ideias repetidas (redundância) ------------------------- */

const IDEA_WORDS = new Map<string, Set<string>>();

/** As palavras que carregam a ideia de uma frase (sem ligação, sem plural). */
export function ideaWords(text: string): Set<string> {
  let set = IDEA_WORDS.get(text);
  if (!set) {
    set = new Set(
      (text.match(/[\p{L}]{4,}/gu) ?? [])
        .map((w) => w.toLowerCase())
        .filter((w) => !STOPWORDS.has(w))
        .map((w) => fold(w).replace(/(oes|aes|s)$/, '')),
    );
    if (IDEA_WORDS.size > 20000) IDEA_WORDS.clear();
    IDEA_WORDS.set(text, set);
  }
  return set;
}

/**
 * Duas frases dizem a mesma coisa? Iguais, ou com quase as mesmas palavras
 * principais (mesmo em outra ordem ou com outra pontuação) — o prompt de
 * aprimoramento pede comparar ideias, não só frases idênticas.
 */
export function sameIdea(a: string, b: string, weight: (w: string) => number = () => 1): boolean {
  if (!a || !b) return false;
  if (fold(a).replace(/[^\p{L}\d]+/gu, ' ').trim() === fold(b).replace(/[^\p{L}\d]+/gu, ' ').trim()) return true;
  const x = ideaWords(a);
  const y = ideaWords(b);
  if (Math.min(x.size, y.size) < 3) return false;
  // palavras próprias de um capítulo pesam mais que as do livro inteiro: "a oração
  // transforma a vida" e "o jejum transforma a vida" falam de coisas diferentes
  let shared = 0;
  let wx = 0;
  let wy = 0;
  for (const w of x) {
    const k = weight(w);
    wx += k;
    if (y.has(w)) shared += k;
  }
  for (const w of y) wy += weight(w);
  const small = Math.min(wx, wy);
  return shared / small >= 0.8 || shared / (wx + wy - shared) >= 0.6;
}
