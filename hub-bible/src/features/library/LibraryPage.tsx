import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState, PageHeader } from '../../components/ui';
import { LIBRARY_CATEGORIES } from '../../core/categories';
import {
  DOC_LABEL,
  DOC_ROUTE,
  filterLibrary,
  loadLibrary,
  newLibraryDoc,
  saveDoc,
  type LibraryEntry,
} from '../../core/data/documents';

const KIND_ICON = { sermon: 'sermon', study: 'study', devotional: 'pray', doc: 'note' } as const;

/** Biblioteca Ministerial — tudo o que foi preparado, em um só lugar (seção 15). */
export default function LibraryPage() {
  const navigate = useNavigate();
  const entries = useLiveQuery(() => loadLibrary(), [], [] as LibraryEntry[]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');

  const filtered = useMemo(
    () => filterLibrary(entries ?? [], query, category),
    [entries, query, category],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries ?? []) map.set(entry.kind, (map.get(entry.kind) ?? 0) + 1);
    return map;
  }, [entries]);

  const createMaterial = async () => {
    const doc = newLibraryDoc();
    await saveDoc('doc', doc);
    navigate(`/biblioteca/material/${doc.id}`);
  };

  return (
    <div className="page page-wide">
      <PageHeader
        title="Biblioteca Ministerial"
        lead="Sermões, Rhema, devocionais e materiais de liderança reunidos."
        actions={
          <button className="btn btn-primary" onClick={createMaterial}>
            ＋ Novo material
          </button>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: 'var(--sp-4)' }}>
        {(['sermon', 'study', 'devotional', 'doc'] as const).map((kind) => (
          <button
            key={kind}
            className="stat"
            style={{ textAlign: 'left' }}
            onClick={() => navigate(kind === 'doc' ? '/biblioteca' : DOC_ROUTE[kind])}
          >
            <div className="stat-value">{counts.get(kind) ?? 0}</div>
            <div className="stat-label">
              {DOC_LABEL[kind]}
            </div>
          </button>
        ))}
      </div>

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar em toda a biblioteca"
          aria-label="Buscar na biblioteca"
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }}>
        {['Todos', ...LIBRARY_CATEGORIES].map((c) => (
          <button key={c} className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <EmptyState
          icon="library"
          title="Sua biblioteca está vazia"
          description="Tudo o que você criar em sermões, Rhema, devocionais e materiais aparece aqui, com busca e filtros."
          action={
            <button className="btn btn-primary btn-sm" onClick={createMaterial}>
              Criar material
            </button>
          }
        />
      ) : (
        <div className="grid grid-cards">
          {filtered.map((entry) => (
            <button
              key={entry.id}
              className="card card-link stack"
              style={{ textAlign: 'left' }}
              onClick={() =>
                navigate(
                  entry.kind === 'doc'
                    ? `/biblioteca/material/${entry.id}`
                    : `${DOC_ROUTE[entry.kind]}/${entry.id}`,
                )
              }
            >
              <span className="row" style={{ gap: 'var(--sp-2)' }}>
                <Icon name={KIND_ICON[entry.kind]} size={17} className="dim" />
                <span className="badge">{entry.category}</span>
                <span className="spacer" />
                <span className="small dim">{new Date(entry.updatedAt).toLocaleDateString('pt-BR')}</span>
              </span>
              <span className="card-title clamp-2">{entry.title}</span>
              {entry.subtitle && <span className="small dim clamp-2">{entry.subtitle}</span>}
              {entry.tags.length > 0 && (
                <span className="row row-wrap" style={{ gap: 4 }}>
                  {entry.tags.slice(0, 4).map((t) => (
                    <span key={t} className="badge">
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
