import { cleanTitle } from '../../core/text';
import type { BriefChapterTurn, BriefInflection, Material } from '../../core/types';
import { OriginBadge, RefChip, SeeInText } from './common';

/** Sugestão das regras (sem IA) ou dito/inferido: o usuário sabe o que confirmar. */
function TurnOrigin({ item }: { item: { origin: BriefInflection['origin']; guess?: boolean } }) {
  return item.guess ? (
    <span className="xr-origin is-guess" title="Escolhida pelas regras do app, sem IA. Confirme ou ajuste em Editar.">
      sugestão
    </span>
  ) : (
    <OriginBadge origin={item.origin} />
  );
}

/** Ponto de inflexão: a virada da mensagem — antes, a virada, depois. */
export function InflectionPanel({ material, inflection, bad }: { material: Material; inflection?: BriefInflection; bad: Set<string> }) {
  if (!inflection?.turn) return null;
  return (
    <section className="xr-inflection" aria-label="Ponto de inflexão">
      <span className="xr-eyebrow">Ponto de inflexão · a virada da mensagem</span>
      <div className={`xr-turn-row cols-${1 + (inflection.before ? 1 : 0) + (inflection.after ? 1 : 0)}`}>
        {inflection.before && (
          <div className="xr-turn-cell">
            <span className="xr-turn-label">Antes</span>
            <p>{inflection.before}</p>
          </div>
        )}
        <div className="xr-turn-cell is-turn">
          <span className="xr-turn-label">A virada</span>
          <p>{inflection.turn}</p>
        </div>
        {inflection.after && (
          <div className="xr-turn-cell">
            <span className="xr-turn-label">Depois</span>
            <p>{inflection.after}</p>
          </div>
        )}
      </div>
      <span className="xr-meta">
        {inflection.ref && <RefChip value={inflection.ref} bad={bad} />}
        <TurnOrigin item={inflection} />
        <SeeInText material={material} section={inflection.section} />
      </span>
    </section>
  );
}

/** As viradas de cada capítulo: a jornada do livro em poucas linhas. */
export function ChapterTurns({ material, turns, bad }: { material: Material; turns?: BriefChapterTurn[]; bad: Set<string> }) {
  if (!turns || turns.length < 2) return null;
  return (
    <section className="xr-panel">
      <span className="xr-eyebrow">As viradas {material.kind === 'livro' ? 'do livro' : 'do estudo'}</span>
      <p className="small dim" style={{ margin: 0 }}>
        A virada de cada parte, em uma frase.{turns.some((t) => t.guess) && ' Sem a IA, são sugestões tiradas do texto: confirme ou ajuste em Editar.'}
      </p>
      <ol className="xr-turns">
        {turns.map((t, i) => (
          <li key={`${t.section}-${i}`}>
            <strong>{cleanTitle(t.section)}</strong>
            <span>{t.turn}</span>
            <span className="xr-meta">
              {t.ref && <RefChip value={t.ref} bad={bad} />}
              <TurnOrigin item={t} />
              <SeeInText material={material} section={t.section} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
