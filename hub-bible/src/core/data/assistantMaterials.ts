/**
 * Materiais importados para o Assistente bíblico — livros, apostilas,
 * estudos e mensagens em PDF ou Word.
 *
 * Ficam só neste aparelho (como as apostilas e a base doutrinária). A leitura
 * teológica é feita sem IA e sem inventar nada: versículos citados, doutrinas
 * do dicionário que aparecem, termos do original e as frases centrais do
 * próprio autor — tudo literal do texto.
 */

import { db, now, uid } from '../db/db';
import { findInlineReferences, formatReference, type ParsedReference } from '../bible/reference';
import { normalize } from '../bible/canon';
import { translitKey } from '../bible/lexicon';
import { getTheologicalDict, type TheologicalEntry } from '../bible/reference-data';
import { countWords, readMaterialFile, type MaterialPart } from './materialImport';

export interface AssistantMaterial {
  id: string;
  title: string;
  fileName: string;
  format: 'pdf' | 'docx';
  parts: MaterialPart[];
  words: number;
  importedAt: number;
}

export interface MaterialSummary {
  id: string;
  title: string;
  format: 'pdf' | 'docx';
  parts: number;
  words: number;
  importedAt: number;
}

/* ─────────────────────────────── guarda ─────────────────────────────── */

/** Cada material numa chave própria: um livro inteiro não pesa nas outras leituras. */
const INDEX_KEY = 'assistant:materials';
const itemKey = (id: string) => `assistant:material:${id}`;

export async function listMaterials(): Promise<MaterialSummary[]> {
  const row = await db.settings.get(INDEX_KEY);
  const list = Array.isArray(row?.value) ? (row!.value as MaterialSummary[]) : [];
  return [...list].sort((a, b) => b.importedAt - a.importedAt);
}

export async function getMaterial(id: string): Promise<AssistantMaterial | null> {
  const row = await db.settings.get(itemKey(id));
  return (row?.value as AssistantMaterial | undefined) ?? null;
}

async function writeIndex(list: MaterialSummary[]): Promise<void> {
  await db.settings.put({ key: INDEX_KEY, value: list });
}

export async function importMaterial(file: File, onProgress?: (message: string) => void): Promise<AssistantMaterial> {
  const read = await readMaterialFile(file, onProgress);
  const material: AssistantMaterial = {
    id: uid('mat_'),
    title: read.title,
    fileName: file.name,
    format: read.format,
    parts: read.parts,
    words: read.words,
    importedAt: now(),
  };
  await db.settings.put({ key: itemKey(material.id), value: material });
  const list = (await listMaterials()).filter((m) => m.id !== material.id);
  list.unshift({
    id: material.id, title: material.title, format: material.format,
    parts: material.parts.length, words: material.words, importedAt: material.importedAt,
  });
  await writeIndex(list);
  return material;
}

export async function renameMaterial(id: string, title: string): Promise<void> {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!clean) return;
  const material = await getMaterial(id);
  if (material) await db.settings.put({ key: itemKey(id), value: { ...material, title: clean } });
  await writeIndex((await listMaterials()).map((m) => (m.id === id ? { ...m, title: clean } : m)));
}

export async function removeMaterial(id: string): Promise<void> {
  await db.settings.delete(itemKey(id));
  await writeIndex((await listMaterials()).filter((m) => m.id !== id));
}

/* ─────────────────────────── leitura teológica ─────────────────────────── */

export interface CitedRef {
  ref: ParsedReference;
  label: string;
  count: number;
}

export interface FoundTerm {
  entry: TheologicalEntry;
  count: number;
}

export interface FoundOriginal {
  translit: string;
  word: string;
  strong?: string;
  term: string;
}

export interface PartReading {
  title: string;
  words: number;
  refs: CitedRef[];
  terms: FoundTerm[];
  /** Frases do próprio autor que carregam a parte. */
  central: string[];
}

export interface MaterialReading {
  material: AssistantMaterial;
  parts: PartReading[];
  refs: CitedRef[];
  terms: FoundTerm[];
  originals: FoundOriginal[];
  strongCodes: string[];
}

/** Frases de um parágrafo (sem quebrar em "Jo 3.16" nem em "Sr."). */
function sentences(paragraph: string): string[] {
  return paragraph
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ“"(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

/** Marcas de tese e conclusão — onde o autor diz o que quer dizer. */
const THESIS = /\b(portanto|por isso|assim sendo|isto significa|isso significa|ou seja|a verdade [ée]|precisamos|devemos|deus quer|a palavra diz|a b[ií]blia diz|note que|observe que|o segredo|a chave|em outras palavras|concluindo|conclus[aã]o)\b/i;

const plain = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, ' ').trim();

function countRefs(text: string): CitedRef[] {
  const map = new Map<string, CitedRef>();
  for (const m of findInlineReferences(text)) {
    const r = m.ref;
    const key = `${r.book}.${r.chapter}.${r.verse}.${r.verseEnd ?? ''}`;
    const found = map.get(key);
    if (found) found.count++;
    else map.set(key, { ref: r, label: formatReference(r), count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function termVariants(e: TheologicalEntry): string[] {
  // "fé" tem duas letras e é a doutrina mais citada: entra também
  return e.termo.split(/\s+[—–-]\s+|\s*\/\s*/).map(plain).filter((t) => t.length >= 2);
}

function countTerms(text: string, dict: TheologicalEntry[]): FoundTerm[] {
  const hay = ` ${plain(text)} `;
  const out: FoundTerm[] = [];
  for (const e of dict) {
    let count = 0;
    for (const v of termVariants(e)) {
      let i = hay.indexOf(` ${v} `);
      while (i >= 0) { count++; i = hay.indexOf(` ${v} `, i + v.length + 1); }
    }
    if (count) out.push({ entry: e, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

function centralSentences(text: string, dict: TheologicalEntry[], limit: number): string[] {
  const terms = dict.flatMap(termVariants);
  const scored: Array<{ s: string; score: number; at: number }> = [];
  let at = 0;
  for (const paragraph of text.split(/\n{2,}|\n(?=[-•])/)) {
    for (const s of sentences(paragraph)) {
      at++;
      if (s.length < 50 || s.length > 320) continue;
      let score = 0;
      if (findInlineReferences(s).length) score += 3;
      const p = ` ${plain(s)} `;
      if (terms.some((t) => p.includes(` ${t} `))) score += 2;
      if (THESIS.test(s)) score += 2;
      if (s.length >= 70 && s.length <= 240) score += 1;
      if (score >= 3) scored.push({ s, score, at });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, limit)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.s);
}

/** Palavras do original que o material cita, reconhecidas pelo dicionário teológico. */
function findOriginals(text: string, dict: TheologicalEntry[]): FoundOriginal[] {
  const vocab = new Map<string, FoundOriginal>();
  for (const e of dict) {
    for (const o of [e.hebraico, e.grego]) {
      if (!o?.translit) continue;
      const key = translitKey(o.translit);
      if (key.length >= 4 && !vocab.has(key)) vocab.set(key, { translit: o.translit, word: o.palavra, strong: o.strong, term: e.termo });
    }
  }
  const found = new Map<string, FoundOriginal>();
  for (const w of text.match(/[\p{L}ʼʻ'’]{4,}/gu) ?? []) {
    const hit = vocab.get(translitKey(w));
    if (hit && !found.has(hit.translit)) found.set(hit.translit, hit);
  }
  return [...found.values()];
}

/** A leitura teológica do material inteiro, parte por parte. */
export async function readMaterialTheology(material: AssistantMaterial, centralPerPart = 3): Promise<MaterialReading> {
  const dict = await getTheologicalDict();
  const parts = material.parts.map((p) => ({
    title: p.title,
    words: countWords(p.text),
    refs: countRefs(`${p.title}\n${p.text}`),
    terms: countTerms(p.text, dict),
    central: centralSentences(p.text, dict, centralPerPart),
  }));
  const all = material.parts.map((p) => `${p.title}\n${p.text}`).join('\n\n');
  return {
    material,
    parts,
    refs: countRefs(all),
    terms: countTerms(all, dict),
    originals: findOriginals(all, dict),
    strongCodes: [...new Set((all.match(/\b[HG]\d{1,5}\b/g) ?? []))].slice(0, 12),
  };
}

/* ─────────────────────── trechos para a IA ─────────────────────── */

/**
 * O material inteiro não cabe numa chamada (nem no custo): vai o sumário com
 * todas as partes e o texto das partes mais ligadas ao pedido, até um limite.
 */
export function materialForAi(material: AssistantMaterial, request: string, maxChars = 40000): string {
  const words = new Set(plain(request).split(' ').filter((w) => w.length >= 4));
  const refs = new Set(findInlineReferences(request).map((m) => `${m.ref.book}.${m.ref.chapter}`));
  const scored = material.parts.map((p, i) => {
    const hay = plain(`${p.title} ${p.text}`);
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    for (const m of findInlineReferences(p.text)) if (refs.has(`${m.ref.book}.${m.ref.chapter}`)) score += 3;
    return { p, i, score };
  });
  // sem nada que destaque uma parte, segue a ordem do próprio material
  const ordered = scored.some((x) => x.score > 0)
    ? [...scored].sort((a, b) => b.score - a.score || a.i - b.i)
    : scored;
  const outline = material.parts.map((p, i) => `${i + 1}. ${p.title}`).join('\n');
  const chosen: Array<{ i: number; text: string }> = [];
  let used = outline.length;
  for (const { p, i } of ordered) {
    const block = `### ${i + 1}. ${p.title}\n${p.text.trim()}`;
    const room = maxChars - used;
    if (room < 1500) break;
    const text = block.length > room ? `${block.slice(0, room - 1)}…` : block;
    chosen.push({ i, text });
    used += text.length;
  }
  chosen.sort((a, b) => a.i - b.i);
  const cut = chosen.length < material.parts.length ? '\n(Outras partes do material ficaram de fora por tamanho; peça uma parte específica para estudá-la.)' : '';
  return `PARTES DO MATERIAL:\n${outline}\n\nTEXTO DAS PARTES MAIS LIGADAS AO PEDIDO:\n${chosen.map((c) => c.text).join('\n\n')}${cut}`;
}
