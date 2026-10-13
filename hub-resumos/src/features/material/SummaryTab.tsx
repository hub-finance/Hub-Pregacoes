import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { EmptyState } from '../../components/ui';
import { downloadText, safeName } from '../../core/backup';
import { createMaterial } from '../../core/materials';
import { extractiveSummary, summaryAsSections, type SummaryLength } from '../../core/summary';
import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { AiPanel } from './AiPanel';
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
      <AiPanel material={material} />

      <h2 className="xr-h2" style={{ marginTop: 'var(--sp-2)' }}>
        Resumo com as frases do próprio texto (sem IA)
      </h2>
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
        <EmptyState
          icon="text"
          title="Ainda não há texto para resumir"
          description="O resumo escolhe as frases mais importantes do próprio texto. Escreva ou cole o conteúdo na aba Editar e volte aqui."
          action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/m/${material.id}?aba=editar`)}>
              Escrever o conteúdo
            </button>
          }
        />
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
          className="btn"
          disabled={!parts.length}
          onClick={() => {
            const md = [`# Resumo — ${material.title}`, '', ...parts.flatMap((p) => [`## ${p.title}`, '', ...p.sentences, ''])].join('\n');
            downloadText(md, `${safeName(material.title)} - resumo.md`);
            notify('Resumo baixado (.md).');
          }}
        >
          Baixar (.md)
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
