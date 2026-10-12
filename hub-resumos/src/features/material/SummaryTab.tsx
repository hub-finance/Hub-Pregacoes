import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { createMaterial } from '../../core/materials';
import { extractiveSummary, summaryAsSections, type SummaryLength } from '../../core/summary';
import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { WithRefs } from './RichText';

const LENGTH_LABEL: Record<SummaryLength, string> = { curto: 'Curto', medio: 'Médio', longo: 'Longo' };

/**
 * Resumo extrativo: as frases principais do próprio texto, sem reescrever
 * nada. Pode virar um novo material do tipo Resumo, para o usuário completar
 * com as suas palavras.
 */
export function SummaryTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [length, setLength] = useState<SummaryLength>('medio');
  const parts = useMemo(() => extractiveSummary(material, length, reading), [material, length, reading]);
  const total = parts.reduce((n, p) => n + p.sentences.join(' ').split(/\s+/).length, 0);

  return (
    <div className="stack">
      <div className="notice">
        <Icon name="info" size={18} />
        <span>
          Este resumo é feito só com frases do próprio texto — primeiro os seus destaques, depois as frases com mais
          palavras-chave. Nada é reescrito. Revise e complete com as suas palavras.
        </span>
      </div>
      <div className="row row-wrap">
        <div className="chip-row">
          {(Object.keys(LENGTH_LABEL) as SummaryLength[]).map((l) => (
            <button key={l} className={`chip${length === l ? ' active' : ''}`} onClick={() => setLength(l)}>
              {LENGTH_LABEL[l]}
            </button>
          ))}
        </div>
        <span className="small dim">
          ≈ {total} de {reading.words} palavras
        </span>
      </div>

      {!parts.length ? (
        <p className="muted">Ainda não há texto suficiente para resumir.</p>
      ) : (
        <article className="card stack">
          {material.centralIdea && (
            <p style={{ margin: 0 }}>
              <strong>Ideia central:</strong> {material.centralIdea}
            </p>
          )}
          {parts.map((p) => (
            <section key={p.sectionId} className="stack" style={{ gap: 4 }}>
              <strong>{p.title}</strong>
              {p.sentences.map((s, i) => (
                <p key={i} className="xr-p" style={{ margin: 0 }}>
                  <WithRefs text={s} />
                </p>
              ))}
            </section>
          ))}
        </article>
      )}

      <div className="row row-wrap">
        <button
          className="btn"
          disabled={!parts.length}
          onClick={async () => {
            const text = [material.title, '', ...parts.flatMap((p) => [p.title, ...p.sentences, ''])].join('\n');
            try {
              await navigator.clipboard.writeText(text);
              notify('Resumo copiado.');
            } catch {
              notify('Não foi possível copiar neste aparelho.', 'error');
            }
          }}
        >
          Copiar
        </button>
        <button
          className="btn btn-primary"
          disabled={!parts.length}
          onClick={async () => {
            const m = await createMaterial({
              title: `Resumo — ${material.title}`,
              kind: 'resumo',
              author: material.author,
              sections: summaryAsSections(parts),
              source: { type: 'resumo-gerado', materialId: material.id, name: material.title },
            });
            notify('Resumo salvo como novo material. Revise e complete.');
            navigate(`/m/${m.id}?aba=editar`);
          }}
        >
          Salvar como novo resumo
        </button>
      </div>
    </div>
  );
}
