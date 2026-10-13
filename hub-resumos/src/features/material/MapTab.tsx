import { useEffect, useMemo, useRef, useState } from 'react';
import { buildConceptMap, type MapNode } from '../../core/concepts';
import { fold } from '../../core/bible';
import { saveMaterial } from '../../core/materials';
import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';

const COLORS: Record<MapNode['kind'], string> = {
  centro: 'var(--accent)',
  secao: 'var(--xr-map-section)',
  conceito: 'var(--xr-map-concept)',
  referencia: 'var(--xr-map-ref)',
};

const short = (text: string, max = 22) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Mapa de conceitos: tocar num nó mostra em que partes ele aparece. */
export function MapTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const map = useMemo(() => buildConceptMap(material, reading), [material, reading]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newConcept, setNewConcept] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  // em tela estreita o desenho rola de lado; começa centrado no material
  useEffect(() => {
    const el = wrap.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const sel = selected ? byId.get(selected) : undefined;
  const linked = new Set(
    sel ? map.edges.filter((e) => e.from === sel.id || e.to === sel.id).flatMap((e) => [e.from, e.to]) : [],
  );

  const addConcept = async () => {
    const c = newConcept.trim();
    if (!c || material.concepts.some((x) => fold(x) === fold(c))) return;
    await saveMaterial({ ...material, concepts: [...material.concepts, c] });
    setNewConcept('');
  };

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        No centro, o material; em volta, as partes; por fora, os conceitos e versículos, ligados às partes em que aparecem
        no texto. Toque num ponto para ver as ligações.
      </p>
      <div className="xr-map-wrap" ref={wrap}>
        <svg viewBox={`0 0 ${map.width} ${map.height}`} className="xr-map" role="img" aria-label={`Mapa de conceitos de ${material.title}`}>
          {map.edges.map((e, i) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const on = !sel || (linked.has(e.from) && linked.has(e.to) && (e.from === sel.id || e.to === sel.id));
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`xr-edge${on ? '' : ' faded'}`} />;
          })}
          {map.nodes.map((n) => {
            const faded = sel && !linked.has(n.id) && sel.id !== n.id;
            const label = short(n.label, n.kind === 'centro' ? 28 : 22);
            const w = Math.max(70, label.length * (n.kind === 'centro' ? 10 : 8.2) + 24);
            const h = n.kind === 'centro' ? 46 : 34;
            return (
              <g
                key={n.id}
                className={`xr-node ${n.kind}${faded ? ' faded' : ''}${sel?.id === n.id ? ' active' : ''}`}
                transform={`translate(${n.x},${n.y})`}
                onClick={() => setSelected(sel?.id === n.id ? null : n.id)}
                role="button"
                tabIndex={0}
                aria-label={n.label}
                onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && setSelected(sel?.id === n.id ? null : n.id)}
              >
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={n.kind === 'secao' ? 8 : h / 2} fill={COLORS[n.kind]} />
                <text textAnchor="middle" dominantBaseline="central" className="xr-node-text">
                  {label}
                </text>
                <title>{n.label}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="row row-wrap small">
        <span className="xr-legend" style={{ background: COLORS.secao }} /> Partes
        <span className="xr-legend" style={{ background: COLORS.conceito }} /> Conceitos
        <span className="xr-legend" style={{ background: COLORS.referencia }} /> Versículos
      </div>

      {sel && sel.kind !== 'centro' && (
        <section className="card stack" aria-live="polite">
          <strong>{sel.label}</strong>
          {sel.kind === 'secao' ? (
            <span className="small muted">
              Ligado a:{' '}
              {map.edges
                .filter((e) => e.from === sel.id && e.to !== 'centro')
                .map((e) => byId.get(e.to)?.label)
                .join(', ') || 'nenhum conceito'}
            </span>
          ) : (
            <span className="small muted">
              Aparece em:{' '}
              {sel.sections.map((id) => material.sections.find((s) => s.id === id)?.title).filter(Boolean).join(', ') || 'nenhuma parte (conceito fixado por você)'}
            </span>
          )}
          {sel.pinned && (
            <div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={async () => {
                  await saveMaterial({ ...material, concepts: material.concepts.filter((c) => c !== sel.label) });
                  setSelected(null);
                }}
              >
                Tirar este conceito do mapa
              </button>
            </div>
          )}
        </section>
      )}

      <section className="card stack" style={{ gap: 'var(--sp-2)' }}>
        <strong>Ligações</strong>
        <ul className="xr-links">
          {map.nodes
            .filter((n) => n.kind === 'conceito' || n.kind === 'referencia')
            .map((n) => (
              <li key={n.id}>
                <button className={`chip${sel?.id === n.id ? ' active' : ''}`} onClick={() => setSelected(sel?.id === n.id ? null : n.id)}>
                  <span className="chip-dot" style={{ background: COLORS[n.kind] }} />
                  {n.label}
                </button>
                <span className="small muted">
                  {n.sections.map((id) => material.sections.find((s) => s.id === id)?.title).filter(Boolean).join(' · ') || 'fixado por você'}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <div className="row row-wrap">
        <input
          className="input"
          style={{ flex: '1 1 200px', width: 'auto' }}
          value={newConcept}
          onChange={(e) => setNewConcept(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addConcept()}
          placeholder="Acrescentar um conceito ao mapa (ex.: justificação)"
          aria-label="Novo conceito"
        />
        <button className="btn" onClick={addConcept} disabled={!newConcept.trim()}>
          Acrescentar
        </button>
      </div>
    </div>
  );
}
