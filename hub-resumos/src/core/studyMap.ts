import { cleanTitle } from './text';
import type { BriefInflection, BriefLeafKind, BriefOrigin, StudyBrief } from './types';

/**
 * O mapa mental do estudo, montado da estrutura única (sem inventar nada
 * novo): o livro no centro, um ramo por parte e, em cada ramo, a virada, as
 * ideias, os versículos, um conceito e uma pergunta. Cada item tem um tipo,
 * para a cor e os filtros, e a parte de onde veio, para o "ver no texto".
 */
export type MapKind = 'virada' | BriefLeafKind;

export const MAP_KIND_LABEL: Record<MapKind, string> = {
  virada: 'Viradas',
  ideia: 'Ideias',
  versiculo: 'Versículos',
  conceito: 'Conceitos',
  pergunta: 'Perguntas',
};

export interface MapItem {
  kind: MapKind;
  label: string;
  detail: string;
  ref?: string;
  section: string;
  origin?: BriefOrigin;
  guess?: boolean;
}

export interface MapBranch {
  label: string;
  summary: string;
  section: string;
  items: MapItem[];
}

export interface StudyMap {
  title: string;
  thesis: string;
  inflection?: BriefInflection;
  branches: MapBranch[];
  counts: Record<MapKind, number>;
}

const ORDER: MapKind[] = ['virada', 'ideia', 'versiculo', 'conceito', 'pergunta'];

/** Leaves antigos (sem tipo) ganham um pelo conteúdo. */
function kindOf(leaf: { label: string; ref?: string; kind?: BriefLeafKind; detail: string }): BriefLeafKind {
  if (leaf.kind) return leaf.kind;
  if (leaf.ref) return 'versiculo';
  if (leaf.label === 'Pergunta' || leaf.detail.trim().endsWith('?')) return 'pergunta';
  return 'ideia';
}

export function buildStudyMap(title: string, brief: StudyBrief): StudyMap {
  const counts: Record<MapKind, number> = { virada: 0, ideia: 0, versiculo: 0, conceito: 0, pergunta: 0 };
  const branches = brief.branches.map((b) => {
    const items: MapItem[] = [];
    const turn = brief.chapterTurns?.find((t) => t.section === b.section);
    if (turn && turn.turn !== b.summary) items.push({ kind: 'virada', label: 'Ponto de inflexão', detail: turn.turn, ref: turn.ref, section: b.section, origin: turn.origin, guess: turn.guess });
    for (const l of b.leaves) items.push({ kind: kindOf(l), label: l.label, detail: l.detail, ref: l.ref, section: b.section });
    items.sort((x, y) => ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind));
    for (const i of items) counts[i.kind]++;
    return { label: b.label || cleanTitle(b.section), summary: b.summary, section: b.section, items };
  });
  return { title, thesis: brief.thesis, inflection: brief.inflection, branches, counts };
}
