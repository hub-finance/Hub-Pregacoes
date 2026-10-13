import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { EmptyState } from '../../components/ui';
import { addActions, listActions, STATUS_LABEL, suggestActions, updateAction, type ActionDraft } from '../../core/actions';
import { db } from '../../core/db';
import type { ActionItem, ActionStatus, Material } from '../../core/types';

const STATUSES: ActionStatus[] = ['a-fazer', 'fazendo', 'feito'];

/** Plano de ação: o que fazer, quem faz e até quando. */
export function ActionsTab({ material }: { material: Material }) {
  const { notify } = useToast();
  const actions = useLiveQuery(() => listActions(material.id), [material.id], [] as ActionItem[]);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<ActionStatus | 'todas'>('todas');
  const [drafts, setDrafts] = useState<ActionDraft[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  const shown = [...actions]
    .filter((a) => filter === 'todas' || a.status === filter)
    .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || (a.due || '9').localeCompare(b.due || '9') || a.createdAt - b.createdAt);
  const doneCount = actions.filter((a) => a.status === 'feito').length;

  return (
    <div className="stack">
      <div className="row row-wrap">
        <button
          className="btn"
          onClick={() => {
            const known = new Set(actions.map((a) => a.text));
            const fresh = suggestActions(material).filter((d) => !known.has(d.text));
            setDrafts(fresh);
            setChosen(new Set(fresh.map((_, i) => i)));
            if (!fresh.length) notify('Nenhuma sugestão nova. Partes com título como “Aplicação”, “Desafio” ou linhas “- [ ] …” viram sugestão.');
          }}
        >
          Sugerir a partir das aplicações do texto
        </button>
        {actions.length > 0 && (
          <span className="small dim">
            {doneCount} de {actions.length} feitas
          </span>
        )}
      </div>

      {drafts && drafts.length > 0 && (
        <section className="card stack">
          <strong>Sugestões do texto</strong>
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
                <span>
                  {d.text}
                  <span className="small dim" style={{ display: 'block' }}>
                    {material.sections.find((s) => s.id === d.sectionId)?.title}
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
                await addActions(material.id, drafts.filter((_, i) => chosen.has(i)));
                setDrafts(null);
                notify('Ações acrescentadas ao plano.');
              }}
            >
              Acrescentar {chosen.size}
            </button>
            <button className="btn btn-ghost" onClick={() => setDrafts(null)}>
              Descartar
            </button>
          </div>
        </section>
      )}

      <div className="row row-wrap">
        <input
          className="input"
          style={{ flex: '1 1 220px', width: 'auto' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && text.trim()) {
              await addActions(material.id, [{ sectionId: '', text }]);
              setText('');
            }
          }}
          placeholder="Nova ação (ex.: reunir a liderança para estudar o capítulo 3)"
          aria-label="Nova ação"
        />
        <button
          className="btn btn-primary"
          disabled={!text.trim()}
          onClick={async () => {
            await addActions(material.id, [{ sectionId: '', text }]);
            setText('');
          }}
        >
          Acrescentar
        </button>
      </div>

      <div className="chip-row">
        {(['todas', ...STATUSES] as const).map((s) => (
          <button key={s} className={`chip${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'todas' ? 'Todas' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {!actions.length ? (
        <EmptyState
          icon="check"
          title="Nenhuma ação ainda"
          description="O plano de ação transforma o estudo em prática. Toque em “Sugerir a partir das aplicações do texto” (lê partes como “Aplicação” e linhas “- [ ] …”) ou escreva a sua ação no campo “Nova ação”."
        />
      ) : !shown.length ? (
        <p className="small muted">Nenhuma ação com essa situação.</p>
      ) : (
        shown.map((a) => <ActionRow key={a.id} item={a} />)
      )}
    </div>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const [text, setText] = useState(item.text);
  const [owner, setOwner] = useState(item.owner);
  return (
    <div className={`xr-action${item.status === 'feito' ? ' done' : ''}`}>
      <button
        className="xr-check"
        aria-pressed={item.status === 'feito'}
        aria-label={item.status === 'feito' ? 'Marcar como não feita' : 'Marcar como feita'}
        onClick={() => updateAction(item, { status: item.status === 'feito' ? 'a-fazer' : 'feito' })}
      >
        {item.status === 'feito' && <Icon name="check" size={16} />}
      </button>
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <input className="input xr-action-text" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() && text !== item.text && updateAction(item, { text: text.trim() })} aria-label="Ação" />
        <div className="row row-wrap" style={{ gap: 6 }}>
          <input className="input" style={{ flex: '1 1 140px', width: 'auto' }} value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => owner !== item.owner && updateAction(item, { owner: owner.trim() })} placeholder="Responsável" aria-label="Responsável" />
          <input className="input" style={{ flex: '0 1 170px', width: 'auto' }} type="date" value={item.due} onChange={(e) => updateAction(item, { due: e.target.value })} aria-label="Prazo" />
          <select className="select" style={{ flex: '0 1 140px', width: 'auto' }} value={item.status} onChange={(e) => updateAction(item, { status: e.target.value as ActionStatus })} aria-label="Situação">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => db.actions.delete(item.id)} aria-label="Excluir ação">
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
