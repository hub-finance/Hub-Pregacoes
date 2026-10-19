import { useToast } from '../../components/Toast';
import { downloadBlob, safeName } from '../../core/backup';
import { turnsInSteps } from '../../core/brief';
import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import { BriefBar } from './BriefBar';
import { LayerHead, OriginBadge, RefChip, SeeInText, STEP_TONES, useBrief } from './common';
import { ChapterTurns } from './Inflection';
import { directionalMapHtml } from './mapHtml';
import { StudyMapView } from './StudyMapView';

/** Camada 2 — Compreender: a progressão do argumento e o conjunto das ideias. */
export function CompreenderTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { brief, badRefs } = useBrief(material, reading);
  const { notify } = useToast();
  // a etapa em que a mensagem vira (mesma parte do ponto de inflexão)
  const turnAt = brief.inflection ? brief.steps.findIndex((s) => s.section === brief.inflection?.section) : -1;
  // a virada de cada capítulo fica dentro da etapa dele, sem uma lista repetindo os capítulos
  const { inline, rest } = turnsInSteps(brief);
  return (
    <div className="stack xr-layer">
      <BriefBar material={material} brief={brief} />
      <LayerHead tone="green" icon="split" title="Compreender" question="Como as ideias se relacionam?" />

      <section className="xr-panel">
        <span className="xr-eyebrow">Progressão lógica do estudo</span>
        {brief.source === 'regras' && (
          <span className="small dim">Sem a IA, as etapas são a introdução e cada capítulo, um por um, com a frase mais forte de cada um e a virada (★) dele. Com a IA, mostram a linha de raciocínio (causa e efeito).</span>
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
                {s.explanation && (
                  <span className="xr-flow-x">
                    {inline[i]?.same && <b className="xr-flow-virada">★ virada: </b>}
                    {s.explanation}
                  </span>
                )}
                {inline[i] && !inline[i]!.same && (
                  <span className="xr-flow-x xr-flow-vline">
                    <b className="xr-flow-virada">★ Virada:</b> {inline[i]!.turn.turn}
                    {inline[i]!.turn.guess && <span className="xr-origin is-guess">sugestão</span>}
                  </span>
                )}
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

      <ChapterTurns material={material} turns={rest} bad={badRefs} />

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
        <StudyMapView material={material} brief={brief} bad={badRefs} />
      </section>
    </div>
  );
}
