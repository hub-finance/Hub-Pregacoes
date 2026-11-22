/**
 * Edição do aplicativo, escolhida na hora de gerar (`HUB_EDITION`).
 *
 * - `completa`: o Farol da Palavra de sempre (1.0), com Rhema e Escola de
 *   Ministros.
 * - `reduzida`: a versão 2.0, o mesmo app sem Rhema e sem Escola de Ministros
 *   (pedido do usuário). Só os pontos de entrada somem; o código é o mesmo,
 *   para toda correção valer nas duas.
 */
export const EDITION = __HUB_EDITION__;

/** Rhema e Escola de Ministros aparecem nesta edição? */
export const HAS_RHEMA = EDITION !== 'reduzida';

/** Número de versão mostrado em Configurações › Sobre. */
export const APP_VERSION = `${HAS_RHEMA ? '1.0' : '2.0'}.${__HUB_BUILD__}`;
