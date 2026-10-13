/**
 * Modelo de dados do Hub Resumos.
 *
 * O programa é independente: tem o próprio banco (IndexedDB, no aparelho) e
 * funciona sem internet e sem conta. Com o Hub Bible ele conversa por arquivo
 * (importa a cópia de segurança do Hub e envia estudos para o Rhema) e por
 * link (abre uma referência bíblica no Hub).
 */

export type ID = string;

/** O que o material é. Muda só rótulos e sugestões; a estrutura é a mesma. */
export type MaterialKind = 'livro' | 'estudo' | 'resumo';

export interface MaterialSource {
  type: 'manual' | 'arquivo' | 'hub-bible' | 'resumo-gerado';
  /** Nome do arquivo importado ou do documento de origem. */
  name?: string;
  /** No Hub Bible: de que tabela veio (sermons, studies…) e o id lá. */
  hubTable?: string;
  hubId?: string;
  /** Resumo gerado a partir de outro material. */
  materialId?: ID;
}

/**
 * Uma seção do material: um capítulo do livro, uma parte do estudo.
 *
 * O texto é texto puro com três convenções, que o app usa em tudo:
 *   - linha começando com `> ` é um **destaque** (ideia-chave);
 *   - linha começando com `- ` é item de lista;
 *   - linha `Termo: definição` (termo curto) entra no glossário.
 * Perguntas (linhas terminadas em `?`) e referências bíblicas são achadas
 * sozinhas.
 */
export interface Section {
  id: ID;
  title: string;
  text: string;
}

export interface Material {
  id: ID;
  title: string;
  kind: MaterialKind;
  author: string;
  /** A ideia central, nas palavras do autor do estudo — é ele quem a escreve. */
  centralIdea: string;
  sections: Section[];
  tags: string[];
  /** Conceitos fixados pelo usuário no mapa (além dos achados no texto). */
  concepts: string[];
  source: MaterialSource;
  favorite?: boolean;
  /**
   * Resumos feitos pela IA (opcional), por escopo: 'livro' para o material
   * inteiro ou o id da parte. Ficam separados do texto do autor e sempre
   * marcados como feitos pela IA.
   */
  ai?: Record<string, AiSummary>;
  createdAt: number;
  updatedAt: number;
  openedAt?: number;
}

/** Resumo gerado pela IA para o material inteiro ou para uma parte. */
export interface AiSummary {
  /** Título do que foi resumido (o material ou a parte). */
  scopeTitle: string;
  resumo: string;
  ideias: string[];
  aplicacoes: string[];
  perguntas: string[];
  conceitos: Array<{ termo: string; definicao: string }>;
  /** Qual IA e qual modelo escreveram, para ficar registrado. */
  provider: 'gemini';
  model: string;
  createdAt: number;
}

/** Andamento do passo a passo de um material. */
export interface Progress {
  /** Mesmo id do material. */
  id: ID;
  done: ID[];
  /** Anotação pessoal por seção. */
  notes: Record<ID, string>;
  /** Seção em que o usuário parou. */
  current?: ID;
  updatedAt: number;
}

export type CardOrigin = 'definicao' | 'destaque' | 'pergunta' | 'lista' | 'referencia' | 'manual';

/** Cartão de revisão (frente e verso), com repetição espaçada. */
export interface Card {
  id: ID;
  materialId: ID;
  sectionId?: ID;
  front: string;
  back: string;
  origin: CardOrigin;
  /** Caixa de Leitner: 1 (revê logo) a 5 (revê bem depois). */
  box: number;
  /** Quando volta a aparecer (ms). */
  due: number;
  reviews: number;
  lapses: number;
  createdAt: number;
  updatedAt: number;
}

export type ActionStatus = 'a-fazer' | 'fazendo' | 'feito';

export interface ActionItem {
  id: ID;
  materialId: ID;
  sectionId?: ID;
  text: string;
  owner: string;
  /** Prazo yyyy-mm-dd, ou vazio. */
  due: string;
  status: ActionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface KeyValue<T = unknown> {
  key: string;
  value: T;
}
