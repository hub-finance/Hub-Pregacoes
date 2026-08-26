import { db, now, uid } from '../db/db';
import { sanitizeHtml } from '../sanitizeHtml';
import { SQLiteFile } from '../sqlite/reader';
import { isStrongDictionary, moduleKind, moduleName, readDictionary } from '../bible/mybible';
import { LEXICON_CREDIT, LEXICON_NAME, lookupLexicon, type LexiconEntry } from '../bible/lexicon';
import type { DictionaryEntry, DictionaryInfo } from '../db/types';

/**
 * Dicionários importados pelo usuário.
 *
 * O aplicativo já traz o léxico de Strong embutido (ver `bible/lexicon.ts`),
 * mas em inglês — é o único com licença que permite distribuir. Nenhum léxico
 * em português tem, todos derivam de edições protegidas. Quem já possui um
 * módulo do MyBible tem o conteúdo, e o app sabe ler esse formato: como as
 * traduções, fica no aparelho, e aparece antes do embutido.
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

export interface StrongDefinition {
  dictionary: string;
  topic: string;
  definition: string;
  /** verbete do léxico embutido; a tela o desenha campo a campo */
  lexicon?: LexiconEntry;
  /** crédito exigido pela licença da fonte, quando houver */
  credit?: string;
}

/**
 * Procura um código Strong nos dicionários importados e no léxico embutido.
 *
 * Devolve lista, e não um só: quem tem dois léxicos quer ver os dois, e é assim
 * que se compara uma definição curta com uma extensa.
 *
 * Os importados vêm primeiro de propósito. O léxico embutido é em inglês —
 * quem se deu ao trabalho de instalar um em português quer ler o dele antes.
 */
export async function lookupStrong(code: string): Promise<StrongDefinition[]> {
  const keys = candidateKeys(code);
  const [rows, entry] = await Promise.all([
    db.dictionaryEntries.where('topicKey').anyOf(keys).toArray(),
    lookupLexicon(code),
  ]);

  const names = new Map((await listDictionaries()).map((d) => [d.id, d.name]));
  const imported = rows.map((r) => ({
    dictionary: names.get(r.dictionaryId) ?? 'Dicionário',
    topic: r.topic,
    definition: r.definition,
  }));

  if (!entry) return imported;
  return [
    ...imported,
    {
      dictionary: LEXICON_NAME,
      topic: entry.code,
      definition: '',
      lexicon: entry,
      credit: LEXICON_CREDIT,
    },
  ];
}

/**
 * Há léxico para consultar?
 *
 * Sempre há: o de Strong vem dentro do aplicativo. A função continua existindo
 * porque a tela usa a resposta para decidir se vale convidar o leitor a
 * importar um léxico em português — o que só faz sentido para quem ainda não
 * tem nenhum importado.
 */
export async function hasStrongDictionary(): Promise<boolean> {
  const all = await listDictionaries();
  return all.some((d) => d.isStrong);
}
