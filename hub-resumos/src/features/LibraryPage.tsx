import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../components/Icon';
import { EmptyState, PageHeader } from '../components/ui';
import { fold } from '../core/bible';
import { db } from '../core/db';
import { KIND_LABEL, progressRatio } from '../core/materials';
import type { MaterialKind } from '../core/types';
import { NewMaterialSheet } from './NewMaterialSheet';

/** Biblioteca: todos os livros, estudos e resumos, com andamento e revisões do dia. */
export default function LibraryPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MaterialKind | 'todos'>('todos');

  const data = useLiveQuery(async () => {
    const [materials, progress, cards] = await Promise.all([db.materials.toArray(), db.progress.toArray(), db.cards.toArray()]);
    const now = Date.now();
    return materials
      .map((m) => ({
        m,
        ratio: progressRatio(m, progress.find((p) => p.id === m.id)),
        due: cards.filter((c) => c.materialId === m.id && c.due <= now).length,
        cards: cards.filter((c) => c.materialId === m.id).length,
      }))
      .sort((a, b) => (b.m.openedAt ?? b.m.updatedAt) - (a.m.openedAt ?? a.m.updatedAt));
  }, []);

  const rows = useMemo(() => {
    const q = fold(query);
    return (data ?? []).filter(({ m }) => (kind === 'todos' || m.kind === kind) && (!q || fold(`${m.title} ${m.author} ${m.tags.join(' ')}`).includes(q)));
  }, [data, query, kind]);

  const totalDue = (data ?? []).reduce((n, r) => n + r.due, 0);

  return (
    <div className="page page-wide">
      <PageHeader
        title="Biblioteca"
        lead="Livros, estudos e resumos organizados em painel, passo a passo, DNA, mapa, cartões, consulta rápida, plano de ação e infográfico."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            ＋ Novo material
          </button>
        }
      />

      {totalDue > 0 && (
        <button className="notice notice-accent" style={{ width: '100%', textAlign: 'left', marginBottom: 'var(--sp-4)' }} onClick={() => navigate('/revisar')}>
          <Icon name="layers" size={18} />
          <span>
            <strong>{totalDue} cartão(ões) para revisar hoje.</strong> Toque para começar.
          </span>
        </button>
      )}

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Icon name="search" size={18} className="dim" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por título, autor ou etiqueta" aria-label="Pesquisar materiais" />
      </div>
      <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }}>
        {(['todos', 'livro', 'estudo', 'resumo'] as const).map((k) => (
          <button key={k} className={`chip${kind === k ? ' active' : ''}`} onClick={() => setKind(k)}>
            {k === 'todos' ? 'Todos' : `${KIND_LABEL[k]}s`}
          </button>
        ))}
      </div>

      {data && !data.length ? (
        <EmptyState
          icon="library"
          title="Comece pelo primeiro material"
          description="Cole o texto de um estudo, importe um PDF ou Word, ou traga mensagens e estudos do Hub Bible."
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              Novo material
            </button>
          }
        />
      ) : !rows.length ? (
        <p className="muted">Nada encontrado com esses filtros.</p>
      ) : (
        <div className="grid grid-cards">
          {rows.map(({ m, ratio, due, cards }) => (
            <button key={m.id} className="card card-link stack" style={{ textAlign: 'left', gap: 'var(--sp-2)' }} onClick={() => navigate(`/m/${m.id}`)}>
              <span className="row" style={{ gap: 'var(--sp-2)' }}>
                <span className="badge">{KIND_LABEL[m.kind]}</span>
                {m.source.type === 'hub-bible' && <span className="badge">Hub Bible</span>}
                <span className="spacer" />
                <span className="small dim">{new Date(m.updatedAt).toLocaleDateString('pt-BR')}</span>
              </span>
              <span className="card-title clamp-2">{m.title}</span>
              {m.author && <span className="small dim">{m.author}</span>}
              {m.centralIdea && <span className="small muted clamp-2">{m.centralIdea}</span>}
              <span className="xr-bar" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento">
                <i style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
              <span className="small dim">
                {m.sections.length} parte{m.sections.length === 1 ? '' : 's'} · {Math.round(ratio * 100)}% estudado
                {cards ? ` · ${cards} cartões` : ''}
                {due ? ` · ${due} para revisar` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      <NewMaterialSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
