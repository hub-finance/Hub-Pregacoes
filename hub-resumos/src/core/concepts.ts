import { fold } from './bible';
import { readMaterial, type MaterialReading } from './text';
import type { Material } from './types';

/**
 * Mapa de conceitos: o material no centro, as seções em volta e, por fora,
 * os conceitos e as referências bíblicas ligados às seções em que aparecem.
 *
 * Os conceitos são os que o usuário fixou mais as palavras-chave do texto.
 * Uma ligação só existe quando o conceito aparece, de fato, naquela seção.
 */

export type NodeKind = 'centro' | 'secao' | 'conceito' | 'referencia';

export interface MapNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  /** Seções onde o conceito/referência aparece. */
  sections: string[];
  pinned?: boolean;
}

export interface MapEdge {
  from: string;
  to: string;
}

export interface ConceptMap {
  nodes: MapNode[];
  edges: MapEdge[];
  width: number;
  height: number;
}

const contains = (haystack: string, needle: string) => {
  const h = ` ${fold(haystack).replace(/[^\p{L}\d]+/gu, ' ')} `;
  const n = fold(needle).replace(/[^\p{L}\d]+/gu, ' ').trim();
  if (!n) return false;
  // aceita o plural simples ("graça" acha "graças")
  return h.includes(` ${n} `) || h.includes(` ${n}s `);
};

export function buildConceptMap(material: Material, reading?: MaterialReading, maxConcepts = 10): ConceptMap {
  const r = reading ?? readMaterial(material);
  const width = 1000;
  const height = 760;
  const cx = width / 2;
  const cy = height / 2;
  const nodes: MapNode[] = [{ id: 'centro', kind: 'centro', label: material.title, x: cx, y: cy, sections: [] }];
  const edges: MapEdge[] = [];

  const sections = material.sections.slice(0, 12);
  const angleOf = new Map<string, number>();
  sections.forEach((s, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(1, sections.length)) * Math.PI * 2;
    angleOf.set(s.id, angle);
    nodes.push({
      id: s.id,
      kind: 'secao',
      label: s.title || `Parte ${i + 1}`,
      x: cx + Math.cos(angle) * 190,
      y: cy + Math.sin(angle) * 170,
      sections: [s.id],
    });
    edges.push({ from: 'centro', to: s.id });
  });

  const pinned = material.concepts.map((c) => c.trim()).filter(Boolean);
  const auto = r.keywords.map((k) => k.word).filter((w) => !pinned.some((p) => fold(p) === fold(w)));
  const concepts = [...pinned, ...auto].slice(0, Math.max(maxConcepts, pinned.length));

  const outer: Array<Omit<MapNode, 'x' | 'y'>> = [];
  for (const c of concepts) {
    const where = sections.filter((s) => contains(`${s.title} ${s.text}`, c)).map((s) => s.id);
    if (!where.length && !pinned.includes(c)) continue;
    outer.push({ id: `c:${c}`, kind: 'conceito', label: c, sections: where, pinned: pinned.includes(c) });
  }
  for (const ref of r.references.slice(0, 6)) {
    const where = r.sections.filter((s) => s.references.some((x) => x.label === ref.label)).map((s) => s.section.id);
    outer.push({ id: `r:${ref.label}`, kind: 'referencia', label: ref.label, sections: where.filter((id) => angleOf.has(id)) });
  }

  // cada nó de fora fica no ângulo médio das seções a que se liga; os que
  // caem no mesmo lugar são espalhados para não se sobreporem
  const placed = outer.map((n, i) => {
    const angles = n.sections.map((id) => angleOf.get(id)).filter((a): a is number => a !== undefined);
    const angle = angles.length
      ? Math.atan2(
          angles.reduce((s, a) => s + Math.sin(a), 0) / angles.length,
          angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length,
        )
      : -Math.PI / 2 + (i / Math.max(1, outer.length)) * Math.PI * 2;
    return { n, angle };
  });
  placed.sort((a, b) => a.angle - b.angle);
  const minGap = (Math.PI * 2) / Math.max(placed.length, 14);
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].angle - placed[i - 1].angle < minGap) placed[i].angle = placed[i - 1].angle + minGap;
  }
  placed.forEach(({ n, angle }, i) => {
    const ring = i % 2 ? 330 : 300;
    nodes.push({ ...n, x: cx + Math.cos(angle) * ring * 1.35, y: cy + Math.sin(angle) * ring * 0.98 });
    for (const s of n.sections) edges.push({ from: s, to: n.id });
    if (!n.sections.length) edges.push({ from: 'centro', to: n.id });
  });

  // dentro da área desenhável
  for (const n of nodes) {
    n.x = Math.min(width - 90, Math.max(90, n.x));
    n.y = Math.min(height - 30, Math.max(30, n.y));
  }
  return { nodes, edges, width, height };
}
