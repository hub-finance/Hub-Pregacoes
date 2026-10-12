import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState, PageHeader } from '../components/ui';
import { db } from '../core/db';
import { ReviewSession } from './ReviewSession';

/** Revisão do dia: os cartões vencidos de todos os materiais, numa sessão só. */
export default function ReviewPage() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const [cards, materials] = await Promise.all([db.cards.where('due').belowOrEqual(Date.now()).toArray(), db.materials.toArray()]);
    return { cards, titles: new Map(materials.map((m) => [m.id, m.title])) };
  }, []);
  // a sessão guarda a lista com que começou; as respostas mudam o banco no meio
  const [session, setSession] = useState<typeof data | null>(null);

  return (
    <div className="page">
      <PageHeader title="Revisar cartões" lead="Poucos minutos por dia: o que você erra volta mais cedo, o que acerta demora mais." />
      {session ? (
        <ReviewSession cards={session.cards} titleOf={(c) => session.titles.get(c.materialId) ?? ''} onClose={() => setSession(null)} />
      ) : !data ? null : data.cards.length ? (
        <section className="card stack center">
          <strong>{data.cards.length} cartão(ões) para hoje</strong>
          <span className="small muted">De {new Set(data.cards.map((c) => c.materialId)).size} material(is).</span>
          <div>
            <button className="btn btn-primary" onClick={() => setSession(data)}>
              Começar a revisão
            </button>
          </div>
        </section>
      ) : (
        <EmptyState
          icon="check"
          title="Tudo revisado por hoje"
          description="Crie cartões na aba Cartões de qualquer material; eles aparecem aqui no dia de revisar."
          action={
            <button className="btn btn-sm" onClick={() => navigate('/')}>
              Ir para a biblioteca
            </button>
          }
        />
      )}
    </div>
  );
}
