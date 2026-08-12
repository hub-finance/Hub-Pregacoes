import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { normalize } from '../../core/bible/canon';
import type { BookMeta } from '../../core/db/types';

interface Props {
  open: boolean;
  books: BookMeta[];
  book: string;
  chapter: number;
  onClose: () => void;
  onSelect: (book: string, chapter: number) => void;
}

/** Seleção de livro e capítulo em dois passos, com filtro por nome. */
export function BookPicker({ open, books, book, chapter, onClose, onSelect }: Props) {
  const [testament, setTestament] = useState<'AT' | 'NT'>('AT');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<BookMeta | null>(null);

  useEffect(() => {
    if (!open) return;
    const current = books.find((b) => b.osis === book);
    setTestament(current?.testament ?? 'AT');
    setPending(current ?? null);
    setQuery('');
  }, [open, book, books]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (q) return books.filter((b) => normalize(b.name).includes(q) || normalize(b.abbrev).includes(q));
    return books.filter((b) => b.testament === testament);
  }, [books, query, testament]);

  const showChapters = pending && !query;

  return (
    <Sheet
      open={open}
      title={showChapters ? pending!.name : 'Escolher livro'}
      onClose={onClose}
      size="lg"
      footer={
        showChapters ? (
          <button className="btn btn-ghost btn-block" onClick={() => setPending(null)}>
            ← Voltar aos livros
          </button>
        ) : undefined
      }
    >
      {!showChapters && (
        <>
          <div className="search-field">
            <span aria-hidden="true">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar livro (ex.: joão, 1co)"
              aria-label="Filtrar livro"
            />
            {query && (
              <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setQuery('')} aria-label="Limpar">
                ✕
              </button>
            )}
          </div>

          {!query && (
            <div className="tabs" role="tablist">
              {(['AT', 'NT'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={testament === t}
                  className={`tab${testament === t ? ' active' : ''}`}
                  onClick={() => setTestament(t)}
                >
                  {t === 'AT' ? 'Antigo Testamento' : 'Novo Testamento'}
                </button>
              ))}
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {filtered.map((b) => (
              <button
                key={b.osis}
                className={`chip${b.osis === book ? ' active' : ''}`}
                style={{ justifyContent: 'space-between', minHeight: 44 }}
                onClick={() => (query ? onSelect(b.osis, 1) : setPending(b))}
              >
                <span className="truncate">{b.name}</span>
                <span className="dim small mono-num">{b.chapters}</span>
              </button>
            ))}
            {!filtered.length && <p className="dim small">Nenhum livro encontrado.</p>}
          </div>
        </>
      )}

      {showChapters && (
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 'var(--sp-2)' }}
        >
          {Array.from({ length: pending!.chapters }, (_, i) => i + 1).map((c) => (
            <button
              key={c}
              className={`chip mono-num${pending!.osis === book && c === chapter ? ' active' : ''}`}
              style={{ justifyContent: 'center', minHeight: 46 }}
              onClick={() => onSelect(pending!.osis, c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
