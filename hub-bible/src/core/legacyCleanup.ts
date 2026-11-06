import { db } from './db/db';

/**
 * Restos da Concordância, que saiu do app a pedido do usuário (nunca usada).
 *
 * Apaga o cache de arquivos que o service worker guardava e os índices
 * gerados para traduções importadas (`concordance:*` em `settings`). Roda em
 * silêncio a cada abertura; depois da primeira vez não há mais o que apagar.
 */
export async function removeConcordanceLeftovers(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete('hub-bible-concordance');
  } catch { /* sem Cache Storage: nada guardado */ }
  try {
    await db.settings.where('key').startsWith('concordance:').delete();
  } catch { /* banco indisponível agora: tenta na próxima abertura */ }
}
