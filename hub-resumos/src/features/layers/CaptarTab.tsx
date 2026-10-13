import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { BriefBar } from './BriefBar';
import { LayerHead, OriginBadge, RefChip, SeeInText, useBrief } from './common';
import { InflectionPanel } from './Inflection';

/** Camada 1 — Captar: entender a mensagem em 30 a 60 segundos. */
export function CaptarTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { brief, badRefs } = useBrief(material, reading);
  return (
    <div className="stack xr-layer">
      <BriefBar material={material} brief={brief} />
      <LayerHead tone="blue" icon="text" title="Captar" question="O que preciso entender rapidamente?" />

      <article className="xr-panel">
        <span className="xr-eyebrow">Síntese central</span>
        <h2 className="xr-panel-title">{material.title}</h2>
        {brief.baseText.length > 0 && (
          <span className="small dim">
            Texto-base:{' '}
            {brief.baseText.map((r, i) => (
              <span key={r}>
                {i > 0 && '; '}
                <RefChip value={r} bad={badRefs} />
              </span>
            ))}
          </span>
        )}
        {brief.synthesis && <p className="xr-lead">{brief.synthesis}</p>}
        {brief.thesis && (
          <div className="xr-thesis">
            <span className="xr-eyebrow">Tese</span>
            <p>{brief.thesis}</p>
          </div>
        )}
        {brief.objective && (
          <p className="small" style={{ margin: 0 }}>
            <strong>Objetivo:</strong> {brief.objective}
          </p>
        )}
      </article>

      <InflectionPanel material={material} inflection={brief.inflection} bad={badRefs} />

      {brief.truths.length > 0 && (
        <section className="xr-panel">
          <span className="xr-eyebrow">Principais verdades</span>
          <ol className="xr-truths">
            {brief.truths.map((t, i) => (
              <li key={i}>
                <span>{t.text}</span>
                <span className="xr-meta">
                  <OriginBadge origin={t.origin} />
                  <SeeInText material={material} section={t.section} />
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
