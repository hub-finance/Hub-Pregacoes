import { useMemo, useState } from 'react';
import { answerCard, type Answer } from '../core/cards';
import type { Card } from '../core/types';

/**
 * Sessão de revisão: frente → mostrar resposta → errei / difícil / acertei.
 * A ordem é a dos cartões mais atrasados primeiro. Errou, o cartão volta no
 * fim da sessão.
 */
export function ReviewSession({ cards, onClose, titleOf }: { cards: Card[]; onClose: () => void; titleOf?: (card: Card) => string }) {
  const initial = useMemo(() => [...cards].sort((a, b) => a.due - b.due), [cards]);
  const [queue, setQueue] = useState<Card[]>(initial);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ acertei: 0, dificil: 0, errei: 0 });

  const card = queue[0];
  const total = initial.length;

  if (!card) {
    return (
      <section className="card stack center">
        <strong>Revisão concluída</strong>
        <span className="small muted">
          {stats.acertei} acerto(s) · {stats.dificil} difícil(eis) · {stats.errei} erro(s)
        </span>
        <div>
          <button className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    );
  }

  const answer = async (a: Answer) => {
    const next = await answerCard(card, a);
    setStats((s) => ({ ...s, [a]: s[a] + 1 }));
    setFlipped(false);
    setQueue((q) => (a === 'errei' ? [...q.slice(1), next] : q.slice(1)));
  };

  return (
    <section className="stack" aria-live="polite">
      <div className="row">
        <span className="small dim">
          {Math.min(total, total - queue.length + 1)} de {total}
          {queue.length > total ? ' (com repetições)' : ''}
        </span>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Encerrar
        </button>
      </div>
      <button className={`xr-flash${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Resposta' : 'Pergunta; toque para ver a resposta'}>
        {titleOf && <span className="small dim">{titleOf(card)}</span>}
        <span className="xr-flash-face">{flipped ? card.back : card.front}</span>
        {!flipped && <span className="small dim">Toque para ver a resposta</span>}
      </button>
      {flipped ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button className="btn xr-btn-wrong" onClick={() => answer('errei')}>
            Errei
          </button>
          <button className="btn" onClick={() => answer('dificil')}>
            Difícil
          </button>
          <button className="btn btn-primary" onClick={() => answer('acertei')}>
            Acertei
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => setFlipped(true)}>
          Mostrar resposta
        </button>
      )}
    </section>
  );
}
