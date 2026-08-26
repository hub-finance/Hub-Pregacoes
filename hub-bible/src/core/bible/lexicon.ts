/**
 * Léxico de Strong embutido no aplicativo.
 *
 * O texto é de James Strong (grego 1890, hebraico 1894), domínio público; a
 * transcrição em JSON é da Open Scriptures, sob CC-BY-SA. A licença exige
 * crédito — `LEXICON_CREDIT` existe para que a tela não possa esquecer disso.
 *
 * Vem em inglês. É a única opção com licença que permite distribuir: todo
 * léxico de Strong em português que circula deriva de edição protegida. Quem
 * tiver um em português importa o módulo dele, e aí o importado aparece
 * primeiro — ver `lookupStrong`.
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

export const LEXICON_NAME = "Léxico de Strong (Open Scriptures)";

export const LEXICON_CREDIT =
  'Strong (1890/1894), domínio público · transcrição da Open Scriptures, CC BY-SA';

/** O formato compacto do arquivo; ver `scripts/build-lexicon.mjs`. */
interface RawEntry {
  l?: string;
  t?: string;
  p?: string;
  d?: string;
  s?: string;
  k?: string;
}

type RawLexicon = Record<string, RawEntry>;

/**
 * Um arquivo por testamento, buscado só quando alguém abre uma palavra.
 *
 * São 2,6 MB somados — carregar isso na abertura do app puniria todo mundo por
 * um recurso que poucos usam em cada sessão. A promessa fica guardada, e não o
 * resultado, para que dois toques seguidos não disparem duas buscas.
 */
const pending = new Map<'G' | 'H', Promise<RawLexicon>>();

function load(testament: 'G' | 'H'): Promise<RawLexicon> {
  const cached = pending.get(testament);
  if (cached) return cached;

  const file = testament === 'G' ? 'strongs-grego.json' : 'strongs-hebraico.json';
  const request = fetch(`${import.meta.env.BASE_URL}lexicon/${file}`)
    .then((r) => {
      if (!r.ok) throw new Error(`Léxico indisponível (${r.status}).`);
      return r.json() as Promise<RawLexicon>;
    })
    .catch((error) => {
      // uma falha de rede não pode envenenar o cache: a próxima tentativa vale
      pending.delete(testament);
      throw error;
    });

  pending.set(testament, request);
  return request;
}

/**
 * Consulta um código no léxico embutido.
 *
 * Devolve `null` quando o código não existe ou o arquivo não pôde ser lido —
 * um léxico ausente é uma informação a menos na tela, nunca um erro na cara do
 * leitor no meio de um estudo.
 */
export async function lookupLexicon(code: string): Promise<LexiconEntry | null> {
  const match = code.trim().match(/^([HGhg])0*(\d+)$/);
  if (!match) return null;

  const testament = match[1].toUpperCase() as 'G' | 'H';
  const key = `${testament}${match[2]}`;

  try {
    const entry = (await load(testament))[key];
    if (!entry) return null;
    return {
      code: key,
      lemma: entry.l,
      translit: entry.t,
      pron: entry.p,
      derivation: entry.d,
      definition: entry.s,
      kjv: entry.k,
    };
  } catch {
    return null;
  }
}
