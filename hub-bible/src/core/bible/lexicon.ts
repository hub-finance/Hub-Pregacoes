/**
 * Tipos do léxico de Strong.
 *
 * O léxico embutido em inglês foi removido — o usuário importa o seu próprio
 * módulo de dicionário, que fica no aparelho. Este arquivo mantém apenas o tipo
 * `LexiconEntry`, que descreve a estrutura de um verbete de léxico.
 */

export interface LexiconEntry {
  /** o código consultado, já normalizado: `H430`, `G25` */
  code: string;
  /** o termo em hebraico ou grego */
  lemma?: string;
  /** transliteração */
  translit?: string;
  /** pronúncia figurada */
  pron?: string;
  /** de onde a palavra deriva */
  derivation?: string;
  /** a definição de Strong */
  definition?: string;
  /** como a King James verteu o termo */
  kjv?: string;
}
