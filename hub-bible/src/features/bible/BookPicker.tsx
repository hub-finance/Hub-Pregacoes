import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { normalize } from '../../core/bible/canon';
import { bookName } from '../../core/bible/canon';
import { parseReference } from '../../core/bible/reference';
import type { BookMeta } from '../../core/db/types';

interface Props {
  open: boolean;
  books: BookMeta[];
  book: string;
  chapter: number;
  onClose: () => void;
  /** `verse` presente quando a referência digitada trouxe o versículo. */
  onSelect: (book: string, chapter: number, verse?: number) => void;
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
  /* "Jo 3:16" digitado no filtro vale como endereço, não como nome de livro:
     em vez de obrigar a passar pelo livro e pela grade de capítulos, o atalho
     leva direto ao versículo. */
  const reference = parseReference(query);

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
            <Icon name="search" size={18} className="dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Livro ou referência (ex.: joão, 1co, Jo 3:16)"
              aria-label="Filtrar livro ou digitar uma referência"
            />
            {query && (
              <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setQuery('')} aria-label="Limpar">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          {reference && (
            <button
              className="btn btn-primary btn-block"
              onClick={() => onSelect(reference.book, reference.chapter, reference.verse)}
            >
              Ir para {bookName(reference.book)} {reference.chapter}
              {reference.verse ? `:${reference.verse}` : ''}
            </button>
          )}

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
