import { db, now, uid } from '../db/db';
import { sanitizeHtml } from '../sanitizeHtml';
import { SQLiteFile } from '../sqlite/reader';
import { isStrongDictionary, moduleKind, moduleName, readDictionary } from '../bible/mybible';

import type { DictionaryEntry, DictionaryInfo } from '../db/types';

/**
 * Dicionários importados pelo usuário.
 *
 * O app lê módulos MyBible e JSON com verbetes de Strong ou dicionários
 * gerais. O conteúdo fica no aparelho — nenhum léxico é distribuído junto
 * com o aplicativo.
 */

/**
 * Normaliza o verbete para a consulta.
 *
 * Os arquivos discordam na grafia do mesmo código: `H430`, `H0430`, `0430`,
 * `430`. Zeros à esquerda somem e a letra vira maiúscula, de modo que todas
 * essas formas caiam na mesma chave. Verbetes que não são código Strong
 * (dicionários por palavra) ficam em maiúsculas sem acento.
 */
export function topicKey(topic: string): string {
  const raw = topic.trim();
  const strong = raw.match(/^([HGhg])?0*(\d+)$/);
  if (strong) return `${(strong[1] ?? '').toUpperCase()}${strong[2]}`;
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/** A mesma chave, mas assumindo hebraico ou grego quando o arquivo omite a letra. */
function candidateKeys(code: string): string[] {
  const key = topicKey(code);
  const bare = key.replace(/^[HG]/, '');
  return key === bare ? [key] : [key, bare];
}

export async function listDictionaries(): Promise<DictionaryInfo[]> {
  return db.dictionaries.orderBy('createdAt').toArray();
}

export async function removeDictionary(id: string): Promise<void> {
  await db.transaction('rw', [db.dictionaries, db.dictionaryEntries], async () => {
    await db.dictionaryEntries.where('dictionaryId').equals(id).delete();
    await db.dictionaries.delete(id);
  });
}

export interface DictionaryImportResult {
  dictionary: DictionaryInfo;
  entries: number;
}

/** Lê um módulo `*.dictionary.SQLite3` e grava os verbetes no aparelho. */
export async function importDictionaryModule(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<DictionaryImportResult> {
  const file = SQLiteFile.open(buffer);
  if (moduleKind(file) !== 'dictionary') {
    throw new Error('Este módulo não é um dicionário.');
  }

  const module = readDictionary(file);
  if (!module.entries.length) throw new Error('O dicionário está vazio.');

  const base = fileName.replace(/\.SQLite3$/i, '').replace(/\.dictionary$/i, '');
  const info: DictionaryInfo = {
    id: uid('dic_'),
    name: moduleName(module.info, base || 'Dicionário'),
    isStrong: isStrongDictionary(module),
    entries: module.entries.length,
    language: module.info.language,
    createdAt: now(),
  };

  const rows: DictionaryEntry[] = module.entries.map((e) => ({
    id: uid('de_'),
    dictionaryId: info.id,
    topic: e.topic,
    topicKey: topicKey(e.topic),
    // a definição vem com marcação do módulo e vai para a tela: sanear é obrigatório
    definition: sanitizeHtml(e.definition),
  }));

  await db.transaction('rw', [db.dictionaries, db.dictionaryEntries], async () => {
    await db.dictionaries.put(info);
    await db.dictionaryEntries.bulkPut(rows);
  });

  return { dictionary: info, entries: rows.length };
}

/**
 * Importa um dicionário em JSON.
 *
 * Formato esperado:
 * ```json
 * {
 *   "nome": "Dicionário Strong Português",
 *   "tipo": "strong",        // "strong" ou "geral"
 *   "idioma": "pt",
 *   "verbetes": {
 *     "H1": { "definicao": "pai..." },
 *     "G26": { "lemma": "ἀγάπη", "translit": "agapē", "definicao": "amor..." }
 *   }
 * }
 * ```
 *
 * Também aceita array:
 * ```json
 * { "nome": "…", "verbetes": [ { "chave": "H1", "definicao": "…" } ] }
 * ```
 */
export async function importDictionaryJson(
  data: Record<string, unknown>,
): Promise<DictionaryImportResult> {
  const name = String(data.nome ?? data.name ?? 'Dicionário');
  const tipo = String(data.tipo ?? data.type ?? '');
  const idioma = String(data.idioma ?? data.language ?? '');

  const raw = data.verbetes ?? data.entries;
  if (!raw || (typeof raw !== 'object')) {
    throw new Error('O JSON precisa ter uma chave "verbetes" com os verbetes do dicionário.');
  }

  const pairs: Array<{ topic: string; definition: string }> = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const topic = String(obj.chave ?? obj.key ?? obj.topic ?? '').trim();
      const def = String(obj.definicao ?? obj.definition ?? '').trim();
      if (topic && def) pairs.push({ topic, definition: def });
    }
  } else {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      const topic = key.trim();
      if (!topic) continue;
      if (typeof val === 'string') {
        if (val.trim()) pairs.push({ topic, definition: val.trim() });
        continue;
      }
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const parts: string[] = [];
        if (obj.lemma) parts.push(`<strong>${obj.lemma}</strong>`);
        if (obj.translit) parts.push(`<em>${obj.translit}</em>`);
        if (obj.pron ?? obj.pronuncia) parts.push(`(${obj.pron ?? obj.pronuncia})`);
        const def = String(obj.definicao ?? obj.definition ?? '').trim();
        if (def) parts.push(def);
        if (parts.length) pairs.push({ topic, definition: parts.join(' — ') });
      }
    }
  }

  if (!pairs.length) throw new Error('Nenhum verbete encontrado no JSON.');

  const isStrong = tipo === 'strong' || pairs.slice(0, 40).filter((e) => /^[HG]?\d+$/i.test(e.topic)).length / Math.min(pairs.length, 40) > 0.7;

  const info: DictionaryInfo = {
    id: uid('dic_'),
    name,
    isStrong,
    entries: pairs.length,
    language: idioma || undefined,
    createdAt: now(),
  };

  const rows: DictionaryEntry[] = pairs.map((e) => ({
    id: uid('de_'),
    dictionaryId: info.id,
    topic: e.topic,
    topicKey: topicKey(e.topic),
    definition: sanitizeHtml(e.definition),
  }));

  await db.transaction('rw', [db.dictionaries, db.dictionaryEntries], async () => {
    await db.dictionaries.put(info);
    await db.dictionaryEntries.bulkPut(rows);
  });

  return { dictionary: info, entries: rows.length };
}

export interface StrongDefinition {
  dictionary: string;
  topic: string;
  definition: string;
}

/**
 * Procura um código Strong nos dicionários importados pelo usuário.
 *
 * Devolve lista, e não um só: quem tem dois léxicos quer ver os dois, e é assim
 * que se compara uma definição curta com uma extensa.
 */
export async function lookupStrong(code: string): Promise<StrongDefinition[]> {
  const keys = candidateKeys(code);
  const rows = await db.dictionaryEntries.where('topicKey').anyOf(keys).toArray();

  const names = new Map((await listDictionaries()).map((d) => [d.id, d.name]));
  return rows.map((r) => ({
    dictionary: names.get(r.dictionaryId) ?? 'Dicionário',
    topic: r.topic,
    definition: r.definition,
  }));
}

/** Há algum dicionário de Strong importado pelo usuário? */
export async function hasStrongDictionary(): Promise<boolean> {
  const all = await listDictionaries();
  return all.some((d) => d.isStrong);
}

/** Remove tags HTML para buscar no texto puro da definição. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Busca uma palavra em todos os dicionários ou num específico. */
export async function lookupTopic(word: string, dictionaryId?: string): Promise<StrongDefinition[]> {
  const key = topicKey(word);
  if (!key) return [];

  const keys = candidateKeys(word);
  let collection = dictionaryId
    ? db.dictionaryEntries.where('dictionaryId').equals(dictionaryId)
    : db.dictionaryEntries.toCollection();

  let rows = await db.dictionaryEntries.where('topicKey').anyOf(keys).toArray();

  if (!rows.length) {
    rows = await db.dictionaryEntries.where('topicKey').startsWith(key).limit(50).toArray();
  }

  if (dictionaryId) {
    rows = rows.filter((r) => r.dictionaryId === dictionaryId);
  }

  // sem resultado por chave: busca dentro do texto da definição e do tópico
  if (!rows.length && key.length >= 3) {
    const lower = word.trim().toLowerCase();
    const textMatches = await collection
      .filter((r) => {
        const topicLower = r.topic.toLowerCase();
        if (topicLower.includes(lower)) return true;
        return stripHtml(r.definition).toLowerCase().includes(lower);
      })
      .limit(30)
      .toArray();
    rows = textMatches;
  }

  const names = new Map((await listDictionaries()).map((d) => [d.id, d.name]));
  return rows.map((r) => ({
    dictionary: names.get(r.dictionaryId) ?? 'Dicionário',
    topic: r.topic,
    definition: r.definition,
  }));
}

/** Busca por prefixo — para sugestões enquanto digita. */
export async function searchTopics(prefix: string, limit = 20, dictionaryId?: string): Promise<Array<{ topic: string; dictionaryId: string }>> {
  const key = topicKey(prefix);
  if (!key) return [];

  const keys = candidateKeys(prefix);
  let rows = await db.dictionaryEntries.where('topicKey').anyOf(keys).toArray();

  const prefixRows = await db.dictionaryEntries
    .where('topicKey')
    .startsWith(key)
    .limit(dictionaryId ? limit * 3 : limit)
    .toArray();

  const seen = new Set(rows.map((r) => r.id));
  for (const r of prefixRows) {
    if (!seen.has(r.id)) rows.push(r);
  }

  const filtered = dictionaryId ? rows.filter((r) => r.dictionaryId === dictionaryId) : rows;
  return filtered.slice(0, limit).map((r) => ({ topic: r.topic, dictionaryId: r.dictionaryId }));
}
