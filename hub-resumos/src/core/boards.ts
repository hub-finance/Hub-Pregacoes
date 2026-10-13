import { suggestCards } from './cards';
import { readMaterial, sentences, type MaterialReading, type SectionReading } from './text';
import type { ActionItem, Material } from './types';

/**
 * Quadros visuais do material, no formato dos exemplos que o usuário trouxe
 * (DNA do livro, folha de consulta, mapa de conceitos, painel completo,
 * fluxograma e cartões). Aqui só se escolhe O QUE entra, sempre tirado do
 * próprio texto; o desenho fica na tela. Nada é escrito pelo app: quando o
 * texto não tem um elemento, o quadro mostra outro que ele tem.
 */

export type BoardKind = 'dna' | 'consulta' | 'conceitos' | 'painel' | 'fluxo' | 'cartoes';

export const BOARDS: Array<{ id: BoardKind; label: string; lead: string }> = [
  { id: 'dna', label: 'DNA do livro', lead: 'Ideia central, palavras-chave, base bíblica e aplicações.' },
  { id: 'consulta', label: 'Folha de consulta', lead: 'Cada parte com o ponto-chave e um exemplo do texto, e o principal ensinamento.' },
  { id: 'conceitos', label: 'Mapa de conceitos', lead: 'O material no centro, ligado aos conceitos de cada parte.' },
  { id: 'painel', label: 'Painel completo', lead: 'Ideias principais, conceitos, aplicações e base bíblica num só quadro.' },
  { id: 'fluxo', label: 'Fluxograma', lead: 'O material em passos numerados, do primeiro ao último.' },
  { id: 'cartoes', label: 'Cartões', lead: 'Cartões de revisão para imprimir ou compartilhar.' },
];

export interface BoardPart {
  n: number;
  title: string;
  /** O ponto-chave da parte: destaque, definição ou a primeira frase. */
  key: string;
  /** Um segundo trecho da parte (exemplo, item ou versículo), se houver. */
  extra?: string;
}

export interface BoardContent {
  title: string;
  author: string;
  /** Ideia central escrita pelo autor; se não houver, o primeiro destaque. */
  central: string;
  centralLabel: 'Ideia central' | 'Texto-chave' | '';
  parts: BoardPart[];
  ideas: string[];
  concepts: Array<{ term: string; meaning: string }>;
  applications: string[];
  applicationsLabel: string;
  references: string[];
  questions: string[];
  keywords: string[];
  cards: Array<{ front: string; back: string }>;
}

const APPLICATION_TITLE = /aplica|pr[aá]tic|desafio|a[cç][aã]o|a[cç][oõ]es|tarefa|compromisso|exerc[ií]cio|passos/i;

function keyOf(s: SectionReading): string {
  return s.highlights[0] ?? (s.definitions[0] && `${s.definitions[0].term}: ${s.definitions[0].meaning}`) ?? sentences(s.paragraphs[0] ?? '')[0] ?? s.listItems[0] ?? s.questions[0] ?? '';
}

function extraOf(s: SectionReading, key: string): string | undefined {
  const options = [
    ...s.definitions.map((d) => `${d.term}: ${d.meaning}`),
    ...s.listItems,
    ...s.highlights,
    ...s.paragraphs.flatMap(sentences),
    ...s.references.map((r) => r.label),
  ];
  return options.find((o) => o && o !== key && !key.includes(o));
}

export function boardContent(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): BoardContent {
  const r = reading ?? readMaterial(material);
  const parts = r.sections
    .map((s, i) => {
      const key = keyOf(s);
      return { n: i + 1, title: s.section.title || `Parte ${i + 1}`, key, extra: extraOf(s, key) };
    })
    .filter((p) => p.key || p.title);

  const open = actions.filter((a) => a.status !== 'feito').map((a) => a.text);
  const fromText = r.sections.filter((s) => APPLICATION_TITLE.test(s.section.title)).flatMap((s) => s.listItems);
  const applications = open.length ? open : fromText.length ? fromText : r.questions.map((q) => q.text);
  const applicationsLabel = open.length || fromText.length ? 'Aplicações' : applications.length ? 'Para refletir' : '';

  const central = material.centralIdea.trim() || r.highlights[0]?.text || '';
  return {
    title: material.title,
    author: material.author,
    central,
    centralLabel: material.centralIdea.trim() ? 'Ideia central' : central ? 'Texto-chave' : '',
    parts,
    ideas: r.highlights.length ? r.highlights.map((h) => h.text) : parts.map((p) => p.key).filter(Boolean),
    concepts: r.definitions.map((d) => ({ term: d.term, meaning: d.meaning })),
    applications,
    applicationsLabel,
    references: r.references.map((x) => x.label),
    questions: r.questions.map((q) => q.text),
    keywords: r.keywords.map((k) => k.word),
    cards: suggestCards(material).map((c) => ({ front: c.front, back: c.back })),
  };
}
