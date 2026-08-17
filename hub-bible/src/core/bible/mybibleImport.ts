import { SQLiteFile } from '../sqlite/reader';
import { moduleKind, moduleName, readBible } from './mybible';
import { storeTranslation, type ImportResult } from './repository';
import type { TranslationInfo } from '../db/types';

/**
 * Traz para o app um módulo de Bíblia do MyBible (`.SQLite3`) que já está no
 * aparelho do usuário.
 *
 * É o caminho para as Bíblias com números Strong em português, que circulam
 * nesse formato e não existem em JSON. O arquivo é lido no próprio aparelho e
 * o texto fica no aparelho — como em qualquer outra importação.
 */

export interface MyBibleImportResult extends ImportResult {
  /** Livros do arquivo fora do cânone de 66 (deuterocanônicos), ignorados. */
  skipped: string[];
  /** O módulo trouxe números Strong. */
  strong: boolean;
}

export async function importMyBibleBible(
  buffer: ArrayBuffer,
  slot: TranslationInfo | null,
  fileName: string,
): Promise<MyBibleImportResult> {
  const db = SQLiteFile.open(buffer);
  const kind = moduleKind(db);
  if (kind === 'dictionary') {
    throw new Error('Este módulo é um dicionário, não uma Bíblia.');
  }
  if (kind !== 'bible') {
    throw new Error('O arquivo não parece um módulo de Bíblia do MyBible.');
  }

  const module = readBible(db);
  const info = slot ?? infoFromModule(module.info, fileName);
  const strong = !!module.strongs;

  const result = await storeTranslation({ ...info, hasStrong: strong }, module.books, {
    strongs: module.strongs,
  });

  return { ...result, skipped: module.skipped, strong };
}

/** Sem um espaço escolhido, o módulo se apresenta pelo que ele mesmo declara. */
function infoFromModule(
  moduleInfo: Record<string, string>,
  fileName: string,
): TranslationInfo {
  const base = fileName.replace(/\.SQLite3$/i, '').replace(/\.[^.]+$/, '').trim();
  const name = moduleName(moduleInfo, base || 'Módulo do MyBible');
  const slug =
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'modulo';

  return {
    id: `mybible_${slug}`,
    name,
    shortName: base.slice(0, 24) || name.slice(0, 24),
    // a sigla vira etiqueta na tela: letras, algarismos e o "+" do nome do arquivo
    abbrev: (base.replace(/[^\p{L}\p{N}+]/gu, '').slice(0, 8) || 'MB').toUpperCase(),
    language: moduleInfo.language?.startsWith('pt') === false ? moduleInfo.language : 'pt-BR',
    languageLabel: moduleInfo.language && !moduleInfo.language.startsWith('pt') ? moduleInfo.language : 'Português',
    license: 'Cópia sua, neste aparelho',
    publisher: moduleInfo.origin || moduleInfo.copyright || undefined,
    bundled: false,
  };
}
