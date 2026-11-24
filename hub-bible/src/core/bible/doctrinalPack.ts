/**
 * Base doutrinária pessoal — guias que o usuário importa de um arquivo .json.
 *
 * Fica só no aparelho, na tabela `settings`. Não entra em `SYNCABLE_TABLES`
 * nem no backup — o usuário guarda o arquivo e importa de novo em cada
 * instalação.
 */

import { db } from '../db/db';
import { CANON_BY_OSIS } from './canon';
import type { ParsedReference } from './reference';

export const PACK_FORMAT = 'hub-bible/base-doutrinaria';
const STORAGE_KEY = 'doctrinal-pack';

export interface OriginalTerm {
  termo: string;
  transliteracao?: string;
  significado: string;
}

export interface PackStep {
  conceito: string;
  resumo: string;
  explicacao: string;
  /** OSIS: "ROM.5.17" ou intervalo "ROM.5.17-19". */
  textos: string[];
  original?: OriginalTerm[];
  aplicacao?: string;
}

export interface PackGuide {
  id: string;
  titulo: string;
  descricao: string;
  fonte?: string;
  passos: PackStep[];
}

export interface DoctrinalPack {
  formato: typeof PACK_FORMAT;
  versao: number;
  nome: string;
  guias: PackGuide[];
}

interface TextRef {
  book: string;
  chapter: number;
  verse: number;
  verseEnd: number;
}

export function parseOsisText(key: string): TextRef | null {
  const m = key.match(/^([1-3]?[A-Z]{2,3})\.(\d{1,3})\.(\d{1,3})(?:-(\d{1,3}))?$/);
  if (!m || !CANON_BY_OSIS.has(m[1])) return null;
  const verse = Number(m[3]);
  return { book: m[1], chapter: Number(m[2]), verse, verseEnd: m[4] ? Number(m[4]) : verse };
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Lança erro com mensagem para o usuário quando o arquivo não serve. */
export function validatePack(raw: unknown): DoctrinalPack {
  const fail = (why: string): never => {
    throw new Error(`Arquivo de base doutrinária inválido: ${why}`);
  };
  if (!raw || typeof raw !== 'object') fail('não é um arquivo JSON de base doutrinária.');
  const pack = raw as Partial<DoctrinalPack>;
  if (pack.formato !== PACK_FORMAT) fail('o arquivo não é do formato esperado.');
  if (!isText(pack.nome)) fail('falta o nome da base.');
  const guias = Array.isArray(pack.guias) ? pack.guias : [];
  if (!guias.length) fail('não há guias no arquivo.');
  for (const g of guias) {
    if (!isText(g?.id) || !isText(g.titulo) || !Array.isArray(g.passos) || !g.passos.length) {
      fail(`um guia está incompleto (${g?.titulo ?? 'sem título'}).`);
    }
    for (const s of g.passos) {
      if (!isText(s?.conceito) || !isText(s.resumo) || !isText(s.explicacao) || !Array.isArray(s.textos)) {
        fail(`um passo de "${g.titulo}" está incompleto.`);
      }
      const bad = s.textos.find((t) => !parseOsisText(t));
      if (bad) fail(`referência não reconhecida em "${g.titulo}": ${bad}.`);
    }
  }
  return pack as DoctrinalPack;
}

export async function getDoctrinalPack(): Promise<DoctrinalPack | null> {
  const row = await db.settings.get(STORAGE_KEY);
  return (row?.value as DoctrinalPack | undefined) ?? null;
}

export interface PackImport {
  pack: DoctrinalPack;
  added: number;
  updated: number;
}

/**
 * Soma os guias do arquivo aos que já estão no aparelho: guia novo entra,
 * guia com o mesmo `id` é atualizado, os outros ficam. O usuário monta a base
 * aos poucos — um livro por dia —, e importar um não pode apagar os outros.
 */
export async function importDoctrinalPack(file: File): Promise<PackImport> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('Não foi possível ler o arquivo. Ele precisa ser o .json da base doutrinária.');
  }
  const incoming = validatePack(raw);
  const current = await getDoctrinalPack();
  if (!current) {
    await db.settings.put({ key: STORAGE_KEY, value: incoming });
    return { pack: incoming, added: incoming.guias.length, updated: 0 };
  }
  const guias = [...current.guias];
  let added = 0;
  let updated = 0;
  for (const g of incoming.guias) {
    const at = guias.findIndex((x) => x.id === g.id);
    if (at >= 0) {
      guias[at] = g;
      updated++;
    } else {
      guias.push(g);
      added++;
    }
  }
  const pack: DoctrinalPack = { ...current, versao: Math.max(current.versao, incoming.versao), guias };
  await db.settings.put({ key: STORAGE_KEY, value: pack });
  return { pack, added, updated };
}

/** Tira um guia só da base; sem guias, a base sai inteira. */
export async function removePackGuide(id: string): Promise<void> {
  const current = await getDoctrinalPack();
  if (!current) return;
  const guias = current.guias.filter((g) => g.id !== id);
  if (guias.length) await db.settings.put({ key: STORAGE_KEY, value: { ...current, guias } });
  else await removeDoctrinalPack();
}

/** O arquivo para passar a outra pessoa, no mesmo formato que se importa. */
export function doctrinalPackFile(pack: DoctrinalPack): { blob: Blob; filename: string } {
  const slug = pack.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    blob: new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' }),
    filename: `${slug || 'base-doutrinaria'}.json`,
  };
}

export async function removeDoctrinalPack(): Promise<void> {
  await db.settings.delete(STORAGE_KEY);
}

/* ───────────── guias que tocam uma passagem ───────────── */

function stepMatches(step: PackStep, ref: ParsedReference, wholeChapter: boolean): boolean {
  return step.textos.some((key) => {
    const t = parseOsisText(key);
    if (!t || t.book !== ref.book || t.chapter !== ref.chapter) return false;
    if (wholeChapter || !ref.verse) return true;
    const end = ref.verseEnd ?? ref.verse;
    return t.verse <= end && t.verseEnd >= ref.verse;
  });
}

export interface GuideMatch {
  guide: PackGuide;
  steps: PackStep[];
}

export function findGuidesForPassage(
  pack: DoctrinalPack,
  ref: ParsedReference,
  wholeChapter: boolean,
  limit = 2,
): GuideMatch[] {
  return pack.guias
    .map((guide) => ({ guide, steps: guide.passos.filter((s) => stepMatches(s, ref, wholeChapter)) }))
    .filter((m) => m.steps.length > 0)
    .sort((a, b) => b.steps.length - a.steps.length)
    .slice(0, limit);
}

/* ───────────── guias que tratam do pedido: passagens e tema ───────────── */

const foldWord = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Raiz simples: "unção/ungido" não se juntam, mas "autoridade/autoridades", "batismo/batismos" sim. */
const stem = (w: string) => (w.length >= 6 ? w.slice(0, 6) : w.replace(/s$/, ''));
const STOP = new Set(
  ('que para com como uma umas uns dos das nos nas pelo pela pelos pelas sobre entre esta este isso isto essa esse ' +
    'qual quais quando onde porque mais menos muito muita seu sua seus suas meu minha nosso nossa voce voces ' +
    'estude estudo estudar explique explicar fale falar mostre mostrar quero queria faca fazer monte montar ' +
    'prepare preparar pregacao mensagem folha apoio resumo resuma diga dizer sobre biblia biblico biblica ' +
    'texto textos versiculo versiculos capitulo livro palavra significado significa ensino ensina tema assunto ' +
    'deus senhor jesus cristo mundo vida todo todos toda todas coisa coisas pessoa pessoas homem homens ' +
    'dentro fora grande outro outra outros outras ainda sempre nunca hoje agora poder pode podemos').split(' '),
);
/** Palavras curtas que são temas por si: "fé", "amor", "cura", "paz". */
const SHORT_THEMES = new Set(['fe', 'amor', 'cura', 'paz', 'graca', 'lei', 'ceu', 'uncao', 'ira']);

function themeStems(text: string): string[] {
  const words = (text.match(/[\p{L}]+/gu) ?? []).map(foldWord);
  return [...new Set(words.filter((w) => (w.length >= 5 || SHORT_THEMES.has(w)) && !STOP.has(w)).map(stem))];
}

function hits(hay: string, stems: string[]): number {
  const words = new Set((hay.match(/[\p{L}]+/gu) ?? []).map((w) => stem(foldWord(w))));
  return stems.filter((s) => words.has(s)).length;
}

/**
 * Os guias da base que tratam do pedido: os que usam alguma das passagens
 * citadas e os que tratam do tema ("Estude a unção", "o que é a autoridade do
 * crente") — mesmo sem versículo. A base é a linha doutrinária do pregador;
 * ficar de fora num pedido por tema era o ponto fraco.
 */
export function findGuidesForRequest(
  pack: DoctrinalPack,
  refs: ParsedReference[],
  text: string,
  limit = 3,
  stepsPerGuide = 3,
): GuideMatch[] {
  const stems = themeStems(text);
  const scored = pack.guias.map((guide, order) => {
    const byPassage = guide.passos.filter((s) => refs.some((r) => stepMatches(s, r, !r.verse)));
    const titleHits = hits(guide.titulo, stems);
    // uma palavra solta no meio do texto não basta ("mundo" em "o que está no
    // mundo"): o tema precisa estar no título do guia ou em duas palavras do passo
    const stepHits = guide.passos.map((s) => {
      const n = hits(`${s.conceito} ${s.resumo}`, stems);
      // no nome do passo vale mesmo sozinha: "Fé em Deus", "Imposição de mãos"
      const named = hits(s.conceito, stems) > 0;
      return n >= 2 || (n === 1 && (titleHits || named)) ? n * 2 + hits(s.explicacao, stems) : 0;
    });
    const byTheme = guide.passos.filter((_, i) => stepHits[i] > 0);
    const score = byPassage.length * 4 + titleHits * 3 + Math.max(0, ...stepHits);
    const chosen = [...new Set([...byPassage, ...byTheme.sort((a, b) => stepHits[guide.passos.indexOf(b)] - stepHits[guide.passos.indexOf(a)])])];
    // o título bate mas nenhum passo em particular: os primeiros passos dão o panorama
    const steps = (chosen.length ? chosen : titleHits ? guide.passos : []).slice(0, stepsPerGuide);
    return { guide, steps, score, order };
  });
  return scored
    .filter((m) => m.steps.length && m.score > 0)
    // empate: vale a ordem da base, que é a ordem de prioridade do pregador
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ guide, steps }) => ({ guide, steps }));
}

/** Limite para não estourar o contexto nem o custo da chamada. */
const MAX_BLOCK_CHARS = 14000;

export function buildDoctrinalBlock(matches: GuideMatch[]): string {
  if (!matches.length) return '';
  const parts: string[] = [];
  for (const { guide, steps } of matches) {
    parts.push(`GUIA: ${guide.titulo}${guide.fonte ? ` (${guide.fonte})` : ''}\n${guide.descricao}`);
    for (const s of steps) {
      const lines = [`• ${s.conceito} — ${s.resumo}`, s.explicacao];
      if (s.original?.length) {
        lines.push(
          'Original: ' +
            s.original
              .map((o) => `${o.termo}${o.transliteracao ? ` (${o.transliteracao})` : ''} = ${o.significado}`)
              .join('; '),
        );
      }
      if (s.aplicacao) lines.push(`Aplicação: ${s.aplicacao}`);
      lines.push(`Textos: ${s.textos.join(', ')}`);
      parts.push(lines.join('\n'));
    }
    const others = guide.passos.filter((s) => !steps.includes(s));
    if (others.length) {
      parts.push('Demais passos do guia: ' + others.map((s) => `${s.conceito} (${s.resumo})`).join(' | '));
    }
  }
  const block = parts.join('\n\n');
  return block.length > MAX_BLOCK_CHARS ? `${block.slice(0, MAX_BLOCK_CHARS)}…` : block;
}
