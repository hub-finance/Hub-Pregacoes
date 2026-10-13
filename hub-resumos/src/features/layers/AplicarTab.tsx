import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { addActions } from '../../core/actions';
import type { MaterialReading } from '../../core/text';
import type { BriefCard, Material } from '../../core/types';
import { KindHead } from './AprofundarTab';
import { BriefBar } from './BriefBar';
import { LayerHead, OriginBadge, RefChip, SeeInText, useBrief } from './common';

/** Camada 4 — Aplicar e recordar: como vou usar o que compreendi. */
export function AplicarTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { brief, badRefs } = useBrief(material, reading);
  const navigate = useNavigate();
  const { notify } = useToast();
  const review = brief.cards.filter((c) => c.kind === 'revisao');
  return (
    <div className="stack xr-layer">
      <BriefBar material={material} brief={brief} />
      <LayerHead tone="orange" icon="check" title="Aplicar e recordar" question="Como vou utilizar o que compreendi?" />

      <section className="stack" style={{ gap: 'var(--sp-2)' }}>
        <KindHead kind="revisao" />
        {review.length ? (
          <div className="xr-cardgrid">
            {review.map((c, i) => (
              <FlipCard key={i} card={c} material={material} badRefs={badRefs} />
            ))}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>Nenhum cartão de revisão ainda.</p>
        )}
        <div>
          <button className="btn btn-sm no-print" onClick={() => navigate(`/m/${material.id}?aba=cartoes`)}>
            Revisar com repetição espaçada ›
          </button>
        </div>
      </section>

      {brief.applications.length > 0 && (
        <section className="xr-panel">
          <span className="xr-eyebrow">Aplicações</span>
          <ul className="xr-checks">
            {brief.applications.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <div className="row row-wrap no-print">
            <button
              className="btn btn-sm"
              onClick={async () => {
                await addActions(material.id, brief.applications.map((text) => ({ sectionId: material.sections[0]?.id ?? '', text })));
                notify('Aplicações levadas ao plano de ação.');
              }}
            >
              Levar ao plano de ação
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/m/${material.id}?aba=acoes`)}>
              Abrir o plano de ação ›
            </button>
          </div>
        </section>
      )}

      {brief.questions.length > 0 && (
        <section className="xr-panel">
          <span className="xr-eyebrow">Perguntas para reflexão</span>
          <ol className="xr-truths">
            {brief.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/** Cartão de revisão: a pergunta na frente; a resposta aparece ao tocar. */
function FlipCard({ card, material, badRefs }: { card: BriefCard; material: Material; badRefs: Set<string> }) {
  const [shown, setShown] = useState(false);
  return (
    <article className="xr-scard tone-orange">
      <span className="xr-scard-label">Pergunta</span>
      <p className="xr-scard-front">{card.front}</p>
      {shown ? (
        <>
          <span className="xr-scard-label">Resposta</span>
          <p>{card.back}</p>
        </>
      ) : (
        <button className="btn btn-sm no-print" onClick={() => setShown(true)}>
          Ver a resposta
        </button>
      )}
      <span className="xr-meta">
        {card.ref && <RefChip value={card.ref} bad={badRefs} />}
        <OriginBadge origin={card.origin} />
        <SeeInText material={material} section={card.section} />
      </span>
    </article>
  );
}
