import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmDialog, EmptyState } from '../../components/ui';
import { addCards, listCards, ORIGIN_LABEL, suggestCards, type CardDraft } from '../../core/cards';
import { db } from '../../core/db';
import type { Card, Material } from '../../core/types';
import { ReviewSession } from '../ReviewSession';

const BOX_LABEL = ['', 'Nova', 'Aprendendo', 'Aprendendo', 'Fixando', 'Fixado'];

/** Cartões do material: sugeridos do texto, escritos à mão e a revisão. */
export function CardsTab({ material }: { material: Material }) {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const loaded = useLiveQuery(() => listCards(material.id), [material.id]);
  const cards = loaded ?? [];
  const [drafts, setDrafts] = useState<CardDraft[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [removing, setRemoving] = useState<Card | null>(null);
  const reviewing = params.get('revisar') === '1';
  const due = cards.filter((c) => c.due <= Date.now());
  // a sessão começa com a lista do momento; responder muda o banco no meio dela
  const [session, setSession] = useState<Card[] | null>(null);
  useEffect(() => {
    if (!reviewing) setSession(null);
    else if (!session && loaded) setSession(loaded.filter((c) => c.due <= Date.now()));
  }, [reviewing, loaded, session]);

  const setReviewing = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('revisar', '1');
    else next.delete('revisar');
    setParams(next);
  };

  if (reviewing) {
    if (!session) return null;
    return (
      <ReviewSession
        cards={session}
        onClose={() => setReviewing(false)}
        titleOf={(c) => material.sections.find((s) => s.id === c.sectionId)?.title ?? ORIGIN_LABEL[c.origin]}
      />
    );
  }

  const suggest = () => {
    const all = suggestCards(material);
    const known = new Set(cards.map((c) => `${c.front}|${c.back}`));
    const fresh = all.filter((d) => !known.has(`${d.front}|${d.back}`));
    setDrafts(fresh);
    setChosen(new Set(fresh.map((_, i) => i)));
    if (!fresh.length) notify(all.length ? 'Todas as sugestões já viraram cartões.' : 'O texto não tem destaques, definições, listas ou perguntas para virar cartão.');
  };

  return (
    <div className="stack">
      <div className="row row-wrap">
        <button className="btn btn-primary" onClick={() => setReviewing(true)} disabled={!due.length}>
          {due.length ? `Revisar agora (${due.length})` : 'Nada para revisar hoje'}
        </button>
        <button className="btn" onClick={suggest}>
          Sugerir cartões do texto
        </button>
        <span className="small dim">{cards.length} cartão(ões)</span>
      </div>

      {loaded && !cards.length && !drafts?.length && (
        <EmptyState
          icon="layers"
          title="Nenhum cartão ainda"
          description="Cartões são perguntas e respostas para memorizar. Toque em “Sugerir cartões do texto”: destaques, definições, listas e perguntas viram cartões, e você escolhe quais guardar."
        />
      )}

      {drafts && drafts.length > 0 && (
        <section className="card stack">
          <div className="row row-wrap">
            <strong>Sugestões tiradas do seu texto</strong>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={() => setChosen(chosen.size === drafts.length ? new Set() : new Set(drafts.map((_, i) => i)))}>
              {chosen.size === drafts.length ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          </div>
          <span className="small dim">Escolha quais guardar. Você pode editar ou excluir qualquer cartão depois.</span>
          <div className="xr-pick-list" style={{ maxHeight: 'none' }}>
            {drafts.map((d, i) => (
              <label key={i} className="xr-pick">
                <input
                  type="checkbox"
                  checked={chosen.has(i)}
                  onChange={() =>
                    setChosen((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                <span style={{ minWidth: 0 }}>
                  <span className="badge">{ORIGIN_LABEL[d.origin]}</span>
                  <span className="xr-pre" style={{ display: 'block', marginTop: 4 }}>
                    {d.front}
                  </span>
                  <span className="small dim xr-pre" style={{ display: 'block' }}>
                    → {d.back}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="row row-wrap">
            <button
              className="btn btn-primary"
              disabled={!chosen.size}
              onClick={async () => {
                const added = await addCards(material.id, drafts.filter((_, i) => chosen.has(i)));
                notify(`${added.length} cartão(ões) guardado(s).`);
                setDrafts(null);
              }}
            >
              Guardar {chosen.size} cartão(ões)
            </button>
            <button className="btn btn-ghost" onClick={() => setDrafts(null)}>
              Descartar sugestões
            </button>
          </div>
        </section>
      )}

      <section className="card stack">
        <strong>Novo cartão</strong>
        <div className="grid grid-2">
          <label className="field">
            <span>Frente (pergunta)</span>
            <textarea className="textarea" rows={2} value={front} onChange={(e) => setFront(e.target.value)} />
          </label>
          <label className="field">
            <span>Verso (resposta)</span>
            <textarea className="textarea" rows={2} value={back} onChange={(e) => setBack(e.target.value)} />
          </label>
        </div>
        <div>
          <button
            className="btn"
            disabled={!front.trim() || !back.trim()}
            onClick={async () => {
              await addCards(material.id, [{ front, back, origin: 'manual' }]);
              setFront('');
              setBack('');
              notify('Cartão guardado.');
            }}
          >
            Guardar cartão
          </button>
        </div>
      </section>

      {cards.length > 0 && (
        <section className="stack" style={{ gap: 'var(--sp-2)' }}>
          {[...cards]
            .sort((a, b) => a.due - b.due)
            .map((c) => (
              <CardRow key={c.id} card={c} onRemove={() => setRemoving(c)} />
            ))}
        </section>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Excluir cartão"
        message="O cartão sai da revisão. O texto do material não muda."
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await db.cards.delete(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function CardRow({ card, onRemove }: { card: Card; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const dueText = card.due <= Date.now() ? 'para hoje' : `volta em ${new Date(card.due).toLocaleDateString('pt-BR')}`;
  return (
    <div className="xr-card-row">
      {editing ? (
        <div className="stack" style={{ flex: 1, gap: 'var(--sp-2)' }}>
          <textarea className="textarea" rows={2} value={front} onChange={(e) => setFront(e.target.value)} aria-label="Frente" />
          <textarea className="textarea" rows={2} value={back} onChange={(e) => setBack(e.target.value)} aria-label="Verso" />
          <div className="row">
            <button
              className="btn btn-sm btn-primary"
              onClick={async () => {
                await db.cards.put({ ...card, front: front.trim() || card.front, back: back.trim() || card.back, updatedAt: Date.now() });
                setEditing(false);
              }}
            >
              Salvar
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="xr-pre" style={{ display: 'block', fontWeight: 600 }}>
              {card.front}
            </span>
            <span className="small dim xr-pre" style={{ display: 'block' }}>
              {card.back}
            </span>
            <span className="small dim">
              {BOX_LABEL[card.box]} · {dueText} · {ORIGIN_LABEL[card.origin]}
            </span>
          </span>
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Editar cartão">
            <Icon name="edit" size={16} />
          </button>
          <button className="icon-btn" onClick={onRemove} aria-label="Excluir cartão">
            <Icon name="trash" size={16} />
          </button>
        </>
      )}
    </div>
  );
}
