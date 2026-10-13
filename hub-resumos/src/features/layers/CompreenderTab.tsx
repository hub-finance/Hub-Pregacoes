import { useState } from 'react';
import { useToast } from '../../components/Toast';
import { downloadBlob, safeName } from '../../core/backup';
import type { MaterialReading } from '../../core/text';
import type { Material, StudyBrief } from '../../core/types';
import { BriefBar } from './BriefBar';
import { LayerHead, OriginBadge, RefChip, SeeInText, STEP_TONES, useBrief } from './common';
import { ChapterTurns } from './Inflection';
import { directionalMapHtml } from './mapHtml';

/** Camada 2 — Compreender: a progressão do argumento e o conjunto das ideias. */
export function CompreenderTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { brief, badRefs } = useBrief(material, reading);
  const { notify } = useToast();
  // a etapa em que a mensagem vira (mesma parte do ponto de inflexão)
  const turnAt = brief.inflection ? brief.steps.findIndex((s) => s.section === brief.inflection?.section) : -1;
  return (
    <div className="stack xr-layer">
      <BriefBar material={material} brief={brief} />
      <LayerHead tone="green" icon="split" title="Compreender" question="Como as ideias se relacionam?" />

      <section className="xr-panel">
        <span className="xr-eyebrow">Progressão lógica do estudo</span>
        {brief.source === 'regras' && (
          <span className="small dim">Sem a IA, as etapas são a introdução e cada capítulo, um por um, com a frase mais forte de cada um. Com a IA, mostram a linha de raciocínio (causa e efeito).</span>
        )}
        <ol className="xr-flow">
          {brief.steps.map((s, i) => (
            <li key={i}>
              <div className={`xr-flow-step tone-${STEP_TONES[i % STEP_TONES.length]}${turnAt === i ? ' is-inflection' : ''}`}>
                {turnAt === i && <span className="xr-flow-turn">★ Ponto de inflexão</span>}
                <strong>
                  {i + 1}. {s.title}
                </strong>
                {s.question && <span className="xr-flow-q">{s.question}</span>}
                {s.explanation && <span className="xr-flow-x">{s.explanation}</span>}
                <span className="xr-meta">
                  {s.refs.map((r) => (
                    <RefChip key={r} value={r} bad={badRefs} />
                  ))}
                  <OriginBadge origin={s.origin} />
                  <SeeInText material={material} section={s.section} />
                </span>
              </div>
              {i < brief.steps.length - 1 && (
                <span className="xr-flow-arrow" aria-hidden="true">
                  ↓{s.link && <em>{s.link}</em>}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <ChapterTurns material={material} turns={brief.chapterTurns} bad={badRefs} />

      <section className="xr-panel">
        <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
          <span className="xr-eyebrow">Mapa mental</span>
          <button
            className="btn btn-sm no-print"
            onClick={() => {
              downloadBlob(new Blob([directionalMapHtml(material.title, brief)], { type: 'text/html;charset=utf-8' }), `${safeName(material.title)} - mapa mental.html`);
              notify('Mapa baixado. Abre em qualquer navegador, sem internet.');
            }}
          >
            Baixar mapa interativo (.html)
          </button>
        </div>
        <DirectionalMap title={material.title} brief={brief} />
      </section>
    </div>
  );
}

/**
 * Mapa da esquerda para a direita (pedido da auditoria): o material à
 * esquerda, os ramos no meio, as folhas à direita. Nós só com palavras-chave;
 * o texto explicativo aparece ao tocar.
 */
export function DirectionalMap({ title, brief }: { title: string; brief: StudyBrief }) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const [detail, setDetail] = useState<{ title: string; text: string } | null>(null);
  const all = open.size === brief.branches.length;
  const toggle = (i: number) => setOpen((s) => (s.has(i) ? new Set([...s].filter((x) => x !== i)) : new Set([...s, i])));
  if (!brief.branches.length) return <p className="small muted">Ainda não há ramos para o mapa.</p>;
  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
      <div className="row row-wrap no-print">
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(all ? new Set() : new Set(brief.branches.map((_, i) => i)))}>
          {all ? 'Recolher tudo' : 'Abrir todos os ramos'}
        </button>
        <span className="small dim">Toque num ramo para abrir; toque num item para ler a explicação.</span>
      </div>
      <div className="xr-dmap" role="tree" aria-label={`Mapa mental de ${title}`}>
        <button className="xr-dmap-root" onClick={() => setDetail({ title, text: brief.thesis })} aria-label={`${title}: ver a tese`}>
          {title}
        </button>
        <ul className="xr-dmap-branches">
          {brief.branches.map((b, i) => (
            <li key={i} className={`tone-${STEP_TONES[i % STEP_TONES.length]}`} role="treeitem" aria-expanded={open.has(i)}>
              <button className="xr-dmap-branch" onClick={() => toggle(i)}>
                <span>{b.label}</span>
                <span className="xr-dmap-count" aria-hidden="true">
                  {open.has(i) ? '−' : b.leaves.length || '›'}
                </span>
              </button>
              {open.has(i) && (
                <ul className="xr-dmap-leaves" role="group">
                  {b.summary && (
                    <li>
                      <button className="xr-dmap-leaf is-summary" onClick={() => setDetail({ title: b.label, text: b.summary })}>
                        Resumo do ramo
                      </button>
                    </li>
                  )}
                  {b.leaves.map((l, k) => (
                    <li key={k}>
                      <button className="xr-dmap-leaf" onClick={() => setDetail({ title: l.label, text: l.detail + (l.ref && !l.detail.includes(l.ref) ? ` (${l.ref})` : '') })}>
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      {detail && (
        <div className="xr-dmap-detail" role="status" aria-live="polite">
          <strong>{detail.title}</strong>
          <p>{detail.text}</p>
          <button className="btn btn-ghost btn-sm no-print" onClick={() => setDetail(null)}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
