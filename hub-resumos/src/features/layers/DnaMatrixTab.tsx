import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { BriefBar } from './BriefBar';
import { LayerHead, OriginBadge, RefChip, useBrief } from './common';
import { InflectionPanel } from './Inflection';

/** DNA da mensagem: a essência, a convicção e a direção — em matriz de 3 colunas. */
export function DnaMatrixTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { brief, badRefs } = useBrief(material, reading);
  const dna = brief.dna;
  return (
    <div className="stack xr-layer">
      <BriefBar material={material} brief={brief} />
      <LayerHead tone="pink" icon="sparkle" title="DNA da mensagem" question="Qual é a essência que sustenta todo o estudo?" />

      {dna.thesis && (
        <article className="xr-panel">
          <span className="xr-eyebrow">Tese</span>
          <p className="xr-lead" style={{ margin: 0 }}>
            {dna.thesis}
          </p>
          {dna.convictions.length > 0 && (
            <>
              <span className="xr-eyebrow" style={{ marginTop: 'var(--sp-2)' }}>
                Convicções
              </span>
              <ul className="xr-checks">
                {dna.convictions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </article>
      )}

      <InflectionPanel material={material} inflection={brief.inflection} bad={badRefs} />

      {dna.rows.length > 0 ? (
        <div className="xr-matrix-wrap">
          <table className="xr-matrix">
            <thead>
              <tr>
                <th scope="col">
                  1. Princípio <span>(o quê)</span>
                </th>
                <th scope="col">
                  2. Base bíblica <span>(onde)</span>
                </th>
                <th scope="col">
                  3. Aplicação prática <span>(como)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {dna.rows.map((r, i) => (
                <tr key={i}>
                  <td data-label="Princípio">
                    {r.principle}
                    <span className="xr-meta">
                      <OriginBadge origin={r.origin} />
                    </span>
                  </td>
                  <td data-label="Base bíblica">{r.base ? <RefChip value={r.base} bad={badRefs} /> : <span className="dim">—</span>}</td>
                  <td data-label="Aplicação">{r.application || <span className="dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small muted">A matriz aparece quando o material tem destaques ou quando a IA monta a estrutura.</p>
      )}

      {dna.outcome && (
        <article className="xr-panel xr-outcome">
          <span className="xr-eyebrow">Resultado esperado</span>
          <p style={{ margin: 0 }}>{dna.outcome}</p>
        </article>
      )}
    </div>
  );
}
