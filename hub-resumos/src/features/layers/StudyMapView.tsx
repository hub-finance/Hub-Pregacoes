import { useMemo, useState } from 'react';
import { buildStudyMap, MAP_KIND_LABEL, type MapItem, type MapKind } from '../../core/studyMap';
import type { Material, StudyBrief } from '../../core/types';
import { OriginBadge, RefChip, SeeInText, STEP_TONES } from './common';

const KIND_ICON: Record<MapKind, string> = { virada: '★', ideia: '●', versiculo: '✚', conceito: '◆', pergunta: '?' };

/**
 * O mapa mental: o livro à esquerda, um ramo por parte no meio e os itens à
 * direita. Cada ramo já mostra a frase principal da parte, para o mapa se ler
 * fechado; ao tocar num item, a explicação abre ali mesmo (sem descer a tela).
 * Os filtros mostram só um tipo em todos os ramos (ex.: só as viradas).
 */
export function StudyMapView({ material, brief, bad }: { material: Material; brief: StudyBrief; bad: Set<string> }) {
  const map = useMemo(() => buildStudyMap(material.title, brief), [material.title, brief]);
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [filter, setFilter] = useState<MapKind | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  if (!map.branches.length) return <p className="small muted">Ainda não há ramos para o mapa.</p>;

  const visible = (items: MapItem[]) => (filter ? items.filter((i) => i.kind === filter) : items);
  const allOpen = open.size === map.branches.length;
  const toggle = (i: number) => setOpen((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])));
  const kinds = (Object.keys(MAP_KIND_LABEL) as MapKind[]).filter((k) => map.counts[k] > 0);

  return (
    <div className="xr-smap">
      <div className="xr-smap-tools no-print">
        <div className="chip-row" role="group" aria-label="Mostrar no mapa">
          <button className={`chip${!filter ? ' active' : ''}`} aria-pressed={!filter} onClick={() => setFilter(null)}>
            Tudo
          </button>
          {kinds.map((k) => (
            <button key={k} className={`chip kind-${k}${filter === k ? ' active' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(filter === k ? null : k)}>
              <span aria-hidden="true">{KIND_ICON[k]}</span> {MAP_KIND_LABEL[k]} ({map.counts[k]})
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(allOpen ? new Set() : new Set(map.branches.map((_, i) => i)))}>
          {allOpen ? 'Recolher tudo' : 'Abrir todos'}
        </button>
      </div>

      <div className="xr-smap-tree" role="tree" aria-label={`Mapa mental de ${map.title}`}>
        <div className="xr-smap-root">
          <strong>{map.title}</strong>
          {map.thesis && <span>{map.thesis}</span>}
          {map.inflection?.turn && (
            <span className="xr-smap-root-turn">
              <b>★ A virada:</b> {map.inflection.turn}
            </span>
          )}
        </div>

        <ol className="xr-smap-branches">
          {map.branches.map((b, i) => {
            const items = visible(b.items);
            if (filter && !items.length) return null;
            const isOpen = filter ? true : open.has(i);
            return (
              <li key={i} className={`xr-smap-branch tone-${STEP_TONES[i % STEP_TONES.length]}`} role="treeitem" aria-expanded={isOpen}>
                <button className="xr-smap-head" onClick={() => (filter ? setFilter(null) : toggle(i))} aria-label={`${b.label}: ${isOpen ? 'fechar' : 'abrir'}`}>
                  <span className="xr-smap-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="xr-smap-headtext">
                    <strong>{b.label}</strong>
                    {b.summary && <span>{b.summary}</span>}
                  </span>
                  <span className="xr-smap-count" aria-hidden="true">
                    {isOpen ? '−' : `${b.items.length} ›`}
                  </span>
                </button>
                {isOpen && (
                  <ul className="xr-smap-items" role="group">
                    {items.map((it, k) => {
                      const id = `${i}-${k}-${it.kind}`;
                      const on = picked === id;
                      return (
                        <li key={id} className={`kind-${it.kind}`}>
                          <button className={`xr-smap-item${on ? ' is-on' : ''}`} aria-expanded={on} onClick={() => setPicked(on ? null : id)}>
                            <span className="xr-smap-icon" aria-hidden="true">
                              {KIND_ICON[it.kind]}
                            </span>
                            <span>{it.label}</span>
                          </button>
                          {on && (
                            <div className="xr-smap-detail" role="status">
                              <p>{it.detail}</p>
                              <span className="xr-meta">
                                {it.ref && <RefChip value={it.ref} bad={bad} />}
                                {it.guess ? <span className="xr-origin is-guess">sugestão</span> : it.origin && <OriginBadge origin={it.origin} />}
                                <SeeInText material={material} section={it.section} />
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
