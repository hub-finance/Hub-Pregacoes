import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState, PageHeader, ProgressBar } from '../../components/ui';
import { useSettings } from '../../core/settings/SettingsContext';
import { CANON, bookName } from '../../core/bible/canon';
import { formatReference, parseReference } from '../../core/bible/reference';
import { getMeta } from '../../core/bible/repository';
import { ensureSearchable, searchScripture, splitHighlights, type SearchHit } from '../../core/bible/search';
import { useAsync, useDebounced } from '../../hooks';

type Scope = 'all' | 'AT' | 'NT' | string;

/** Busca por palavra, expressão, referência ou livro (seção 10). */
export default function SearchPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [scope, setScope] = useState<Scope>('all');
  const [phrase, setPhrase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const [searching, setSearching] = useState(false);
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const translation = settings.defaultTranslation;
  const meta = useAsync(() => getMeta(translation), [translation]);
  const debounced = useDebounced(query, 320);

  const reference = useMemo(() => parseReference(query), [query]);

  const run = useCallback(
    async (text: string) => {
      abortRef.current.aborted = true;
      const signal = { aborted: false };
      abortRef.current = signal;

      if (text.trim().length < 2) {
        setHits([]);
        setTotal(0);
        return;
      }
      setSearching(true);
      try {
        await ensureSearchable(translation, (p) => setPreparing({ done: p.done, total: p.total }));
        setPreparing(null);
        if (signal.aborted) return;
        const outcome = await searchScripture(text, { translation, scope, phrase, wholeWord, signal });
        if (signal.aborted) return;
        setHits(outcome.hits);
        setTotal(outcome.total);
        setTookMs(outcome.tookMs);
      } finally {
        if (!signal.aborted) setSearching(false);
        setPreparing(null);
      }
    },
    [translation, scope, phrase, wholeWord],
  );

  useEffect(() => {
    run(debounced);
    if (debounced) setParams({ q: debounced }, { replace: true });
  }, [debounced, run, setParams]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.book) ?? [];
      list.push(hit);
      map.set(hit.book, list);
    }
    return [...map.entries()];
  }, [hits]);

  const bookOptions = meta.data?.books ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Buscar"
        lead="Pesquise por palavra, expressão entre aspas, referência ou livro."
      />

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Ex.: fé · "não temas" · João 3:16 · Romanos'
          aria-label="Termo de busca"
          inputMode="search"
        />
        {query && (
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setQuery('')} aria-label="Limpar">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {reference && (
        <button
          className="card card-link row"
          style={{ marginBottom: 'var(--sp-3)' }}
          onClick={() =>
            navigate(
              `/biblia/${reference.book}/${reference.chapter}${reference.verse ? `?v=${reference.verse}` : ''}`,
            )
          }
        >
          <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
            📖
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <strong>Ir para {formatReference(reference)}</strong>
            <span className="small dim" style={{ display: 'block' }}>
              abrir a passagem no leitor
            </span>
          </span>
          <Icon name="chevron-right" size={18} className="dim" />
        </button>
      )}

      <div className="chip-row" style={{ marginBottom: 'var(--sp-3)' }}>
        <button className={`chip${scope === 'all' ? ' active' : ''}`} onClick={() => setScope('all')}>
          Toda a Bíblia
        </button>
        <button className={`chip${scope === 'AT' ? ' active' : ''}`} onClick={() => setScope('AT')}>
          Antigo Testamento
        </button>
        <button className={`chip${scope === 'NT' ? ' active' : ''}`} onClick={() => setScope('NT')}>
          Novo Testamento
        </button>
        <button className={`chip${phrase ? ' active' : ''}`} onClick={() => setPhrase((v) => !v)}>
          Frase exata
        </button>
        <button className={`chip${wholeWord ? ' active' : ''}`} onClick={() => setWholeWord((v) => !v)}>
          Palavra inteira
        </button>
      </div>

      <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
        <select
          className="select"
          value={CANON.some((b) => b.osis === scope) ? scope : ''}
          onChange={(e) => setScope(e.target.value || 'all')}
          aria-label="Filtrar por livro"
        >
          <option value="">Filtrar por livro específico…</option>
          {bookOptions.map((b) => (
            <option key={b.osis} value={b.osis}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {preparing && (
        <div className="card stack" style={{ marginBottom: 'var(--sp-4)' }}>
          <p className="small">
            Preparando a busca offline — baixando o texto de {meta.data?.name ?? translation}.
          </p>
          <ProgressBar value={(preparing.done / preparing.total) * 100} label="Baixando livros" />
        </div>
      )}

      {searching && !preparing && <p className="small dim">Buscando…</p>}

      {!searching && query.trim().length >= 2 && (
        <p className="small dim" style={{ marginBottom: 'var(--sp-3)' }}>
          {total === 0
            ? 'Nenhuma ocorrência encontrada.'
            : `${total} ocorrência(s) em ${grouped.length} livro(s) · ${tookMs} ms${
                total > hits.length ? ` · exibindo as ${hits.length} primeiras` : ''
              }`}
        </p>
      )}

      {!query.trim() && (
        <EmptyState
          icon="search"
          title="O que você quer encontrar hoje?"
          description='Digite uma palavra ("graça"), uma expressão entre aspas ("não temas") ou uma referência (João 3:16).'
        />
      )}

      <div className="stack">
        {grouped.map(([osis, list]) => (
          <section key={osis}>
            <div className="section-head">
              <h2 className="section-title">
                {bookName(osis)} · {list.length}
              </h2>
            </div>
            <div className="stack" style={{ gap: 'var(--sp-2)' }}>
              {list.map((hit) => (
                <button
                  key={`${hit.book}-${hit.chapter}-${hit.verse}`}
                  className="hit"
                  onClick={() => navigate(`/biblia/${hit.book}/${hit.chapter}?v=${hit.verse}`)}
                >
                  <div className="hit-ref">
                    {hit.bookName} {hit.chapter}:{hit.verse}
                  </div>
                  <div className="hit-text">
                    {splitHighlights(hit.text, hit.ranges).map((part, i) =>
                      part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
