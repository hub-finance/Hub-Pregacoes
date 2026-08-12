import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShareSheet } from '../share/ShareSheet';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog, EmptyState, PageHeader, SelectInput, TextArea } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../core/settings/SettingsContext';
import { normalize } from '../../core/bible/canon';
import { categoryColor } from '../../core/categories';
import { listFavorites, removeFavorite, updateFavorite } from '../../core/data/favorites';
import type { Favorite } from '../../core/db/types';

/** Área de favoritos com filtro por categoria, busca e observação. */
export default function FavoritesPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { categories } = useSettings();
  const favorites = useLiveQuery(() => listFavorites(), [], [] as Favorite[]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('todas');
  const [editing, setEditing] = useState<Favorite | null>(null);
  const [sharing, setSharing] = useState<Favorite | null>(null);
  const [removing, setRemoving] = useState<Favorite | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftCategory, setDraftCategory] = useState('promessas');

  const filtered = useMemo(() => {
    const q = normalize(query);
    return (favorites ?? []).filter((f) => {
      if (category !== 'todas' && f.category !== category) return false;
      if (!q) return true;
      return (
        normalize(f.text).includes(q) ||
        normalize(f.reference).includes(q) ||
        normalize(f.note ?? '').includes(q)
      );
    });
  }, [favorites, query, category]);

  const openEditor = (favorite: Favorite) => {
    setEditing(favorite);
    setDraftNote(favorite.note ?? '');
    setDraftCategory(favorite.category);
  };

  return (
    <div className="page">
      <PageHeader title="Favoritos" lead={`${favorites?.length ?? 0} versículo(s) guardados.`} />

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <span aria-hidden="true">🔎</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nos favoritos"
          aria-label="Buscar nos favoritos"
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }}>
        <button className={`chip${category === 'todas' ? ' active' : ''}`} onClick={() => setCategory('todas')}>
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip${category === c.id ? ' active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            <span className="chip-dot" style={{ background: c.color }} aria-hidden="true" />
            {c.label}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <EmptyState
          icon="⭐"
          title="Nenhum favorito por aqui"
          description="Na leitura, toque em um versículo e escolha Favoritar para guardá-lo nesta área."
          action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/biblia')}>
              Abrir a Bíblia
            </button>
          }
        />
      ) : (
        <div className="stack">
          {filtered.map((favorite) => (
            <article key={favorite.id} className="card stack" style={{ gap: 'var(--sp-3)' }}>
              <div className="row">
                <span
                  className="chip-dot"
                  style={{ background: categoryColor(favorite.category) }}
                  aria-hidden="true"
                />
                <button
                  className="card-title"
                  style={{ textAlign: 'left', color: 'var(--accent-strong)' }}
                  onClick={() =>
                    navigate(`/biblia/${favorite.ref.book}/${favorite.ref.chapter}?v=${favorite.ref.verse}`)
                  }
                >
                  {favorite.reference}
                </button>
                <div className="spacer" />
                <span className="badge">{categories.find((c) => c.id === favorite.category)?.label ?? favorite.category}</span>
              </div>

              <p style={{ fontFamily: 'var(--font-reader)', lineHeight: 1.65 }}>{favorite.text}</p>

              {favorite.note && (
                <p className="small muted" style={{ borderLeft: '2px solid var(--border-strong)', paddingLeft: 'var(--sp-3)' }}>
                  {favorite.note}
                </p>
              )}

              <div className="row row-wrap">
                <button className="btn btn-sm btn-ghost" onClick={() => openEditor(favorite)}>
                  ✏️ Editar
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setSharing(favorite)}>
                  📤 Compartilhar
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(favorite)}>
                  🗑️ Excluir
                </button>
                <div className="spacer" />
                <span className="small dim">
                  {new Date(favorite.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet
        open={!!editing}
        title={editing?.reference ?? ''}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={async () => {
                if (!editing) return;
                await updateFavorite(editing.id, { note: draftNote, category: draftCategory });
                setEditing(null);
                notify('Favorito atualizado.');
              }}
            >
              Salvar
            </button>
          </>
        }
      >
        <SelectInput
          label="Categoria"
          value={draftCategory}
          onChange={setDraftCategory}
          options={categories.map((c) => ({ value: c.id, label: c.label }))}
        />
        <TextArea label="Observação" value={draftNote} onChange={setDraftNote} rows={5} />
      </Sheet>

      {sharing && (
        <ShareSheet
          open
          onClose={() => setSharing(null)}
          reference={sharing.reference}
          text={sharing.text}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="Excluir favorito"
        message={`Remover ${removing?.reference} dos favoritos?`}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeFavorite(removing.id);
          setRemoving(null);
          notify('Favorito excluído.');
        }}
      />
    </div>
  );
}
