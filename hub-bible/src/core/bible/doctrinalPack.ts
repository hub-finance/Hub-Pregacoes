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

export async function importDoctrinalPack(file: File): Promise<DoctrinalPack> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('Não foi possível ler o arquivo. Ele precisa ser o .json da base doutrinária.');
  }
  const pack = validatePack(raw);
  await db.settings.put({ key: STORAGE_KEY, value: pack });
  return pack;
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
