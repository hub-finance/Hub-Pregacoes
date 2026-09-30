/**
 * Referências cruzadas, dicionário teológico e famílias semânticas.
 *
 * Arquivos JSON sob `public/reference/`, carregados sob demanda. O custo é pago
 * só por quem usa: a maioria dos leitores não abre o painel de referências em
 * cada capítulo, então carregar tudo na abertura do app seria desperdício.
 */

/* ───────────────── Referências cruzadas ───────────────── */

type CrossRefMap = Record<string, string[]>;

let crossRefs: CrossRefMap | null = null;
let crossRefsPromise: Promise<CrossRefMap> | null = null;

async function loadCrossRefs(): Promise<CrossRefMap> {
  if (crossRefs) return crossRefs;
  if (crossRefsPromise) return crossRefsPromise;
  crossRefsPromise = fetch(`${import.meta.env.BASE_URL}reference/cross-references.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Referências indisponíveis (${r.status}).`);
      return r.json() as Promise<CrossRefMap>;
    })
    .then((data) => {
      crossRefs = data;
      return data;
    })
    .catch((err) => {
      crossRefsPromise = null;
      throw err;
    });
  return crossRefsPromise;
}

/**
 * Busca referências cruzadas para um versículo.
 *
 * A chave segue o formato OSIS: `ROM.5.1` (livro.capítulo.versículo).
 */
export async function getCrossReferences(
  book: string,
  chapter: number,
  verse: number,
): Promise<string[]> {
  try {
    const data = await loadCrossRefs();
    return data[`${book}.${chapter}.${verse}`] ?? [];
  } catch {
    return [];
  }
}

/**
 * Busca referências cruzadas para um capítulo inteiro.
 *
 * Retorna um mapa versículo → lista de referências, só com os versículos que
 * têm alguma entrada — a tela pode decidir mostrar um indicador ao lado.
 */
export async function getChapterCrossRefs(
  book: string,
  chapter: number,
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  try {
    const data = await loadCrossRefs();
    const prefix = `${book}.${chapter}.`;
    for (const key of Object.keys(data)) {
      if (key.startsWith(prefix)) {
        const verse = parseInt(key.slice(prefix.length), 10);
        if (verse > 0) result.set(verse, data[key]);
      }
    }
  } catch {
    /* sem conexão ou arquivo: o indicador simplesmente não aparece */
  }
  return result;
}

/* ────────────────── Dicionário teológico ──────────────── */

export interface TheologicalEntry {
  id: string;
  termo: string;
  hebraico?: { palavra: string; translit: string; strong?: string };
  grego?: { palavra: string; translit: string; strong?: string };
  definicao: string;
  distincao?: string;
  textos: string[];
  relacionados: string[];
}

let dictEntries: TheologicalEntry[] | null = null;
let dictPromise: Promise<TheologicalEntry[]> | null = null;

async function loadDict(): Promise<TheologicalEntry[]> {
  if (dictEntries) return dictEntries;
  if (dictPromise) return dictPromise;
  dictPromise = fetch(`${import.meta.env.BASE_URL}reference/theological-dict.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Dicionário indisponível (${r.status}).`);
      return r.json() as Promise<TheologicalEntry[]>;
    })
    .then((data) => {
      dictEntries = data;
      return data;
    })
    .catch((err) => {
      dictPromise = null;
      throw err;
    });
  return dictPromise;
}

export async function getTheologicalDict(): Promise<TheologicalEntry[]> {
  try {
    return await loadDict();
  } catch {
    return [];
  }
}

export async function getTheologicalEntry(id: string): Promise<TheologicalEntry | null> {
  const all = await getTheologicalDict();
  return all.find((e) => e.id === id) ?? null;
}

/**
 * Encontra verbetes do dicionário teológico que citam um versículo.
 */
export async function findEntriesForVerse(
  book: string,
  chapter: number,
  verse: number,
): Promise<TheologicalEntry[]> {
  const key = `${book}.${chapter}.${verse}`;
  const all = await getTheologicalDict();
  return all.filter((e) => e.textos.includes(key));
}

/* ─────────────────── Tipologia AT → NT ─────────────────── */

export interface TypologyPair {
  id: string;
  titulo: string;
  at: { nome: string; textos: string[] };
  nt: { nome: string; textos: string[] };
  explicacao: string;
  textosChave: string[];
}

let typologyEntries: TypologyPair[] | null = null;
let typologyPromise: Promise<TypologyPair[]> | null = null;

async function loadTypology(): Promise<TypologyPair[]> {
  if (typologyEntries) return typologyEntries;
  if (typologyPromise) return typologyPromise;
  typologyPromise = fetch(`${import.meta.env.BASE_URL}reference/typology.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Tipologia indisponível (${r.status}).`);
      return r.json() as Promise<TypologyPair[]>;
    })
    .then((data) => {
      typologyEntries = data;
      return data;
    })
    .catch((err) => {
      typologyPromise = null;
      throw err;
    });
  return typologyPromise;
}

export async function getTypology(): Promise<TypologyPair[]> {
  try {
    return await loadTypology();
  } catch {
    return [];
  }
}

/**
 * Encontra pares tipológicos que citam um versículo (em qualquer lado).
 */
export async function findTypologyForVerse(
  book: string,
  chapter: number,
  verse: number,
): Promise<TypologyPair[]> {
  const key = `${book}.${chapter}.${verse}`;
  const all = await getTypology();
  return all.filter(
    (t) =>
      t.at.textos.includes(key) ||
      t.nt.textos.includes(key) ||
      t.textosChave.includes(key),
  );
}

/* ──────────────── Famílias semânticas ──────────────── */

export interface SemanticTerm {
  strong: string;
  lemma: string;
  translit: string;
  sentido: string;
}

export interface SemanticGroup {
  id: string;
  nome: string;
  descricao: string;
  termos: SemanticTerm[];
  dicionario: string;
}

let groups: SemanticGroup[] | null = null;
let groupsPromise: Promise<SemanticGroup[]> | null = null;

async function loadGroups(): Promise<SemanticGroup[]> {
  if (groups) return groups;
  if (groupsPromise) return groupsPromise;
  groupsPromise = fetch(`${import.meta.env.BASE_URL}reference/semantic-groups.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Famílias semânticas indisponíveis (${r.status}).`);
      return r.json() as Promise<SemanticGroup[]>;
    })
    .then((data) => {
      groups = data;
      return data;
    })
    .catch((err) => {
      groupsPromise = null;
      throw err;
    });
  return groupsPromise;
}

export async function getSemanticGroups(): Promise<SemanticGroup[]> {
  try {
    return await loadGroups();
  } catch {
    return [];
  }
}

/**
 * Encontra a família semântica a que um código Strong pertence.
 */
export async function findGroupForStrong(strong: string): Promise<SemanticGroup | null> {
  const all = await getSemanticGroups();
  const normalized = strong.replace(/^([HG])0*/, '$1');
  return all.find((g) => g.termos.some((t) => t.strong === normalized)) ?? null;
}

/* ─────────────────── Guias doutrinários ─────────────────── */

export interface GuideStep {
  conceito: string;
  resumo: string;
  verbete: string;
  textos: string[];
}

export interface DoctrinalGuide {
  id: string;
  titulo: string;
  descricao: string;
  passos: GuideStep[];
}

let guides: DoctrinalGuide[] | null = null;
let guidesPromise: Promise<DoctrinalGuide[]> | null = null;

async function loadGuides(): Promise<DoctrinalGuide[]> {
  if (guides) return guides;
  if (guidesPromise) return guidesPromise;
  guidesPromise = fetch(`${import.meta.env.BASE_URL}reference/doctrinal-guides.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Guias indisponíveis (${r.status}).`);
      return r.json() as Promise<DoctrinalGuide[]>;
    })
    .then((data) => {
      guides = data;
      return data;
    })
    .catch((err) => {
      guidesPromise = null;
      throw err;
    });
  return guidesPromise;
}

export async function getDoctrinalGuides(): Promise<DoctrinalGuide[]> {
  try {
    return await loadGuides();
  } catch {
    return [];
  }
}

export async function getDoctrinalGuide(id: string): Promise<DoctrinalGuide | null> {
  const all = await getDoctrinalGuides();
  return all.find((g) => g.id === id) ?? null;
}
