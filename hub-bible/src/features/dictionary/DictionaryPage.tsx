import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { listDictionaries, lookupTopic } from '../../core/data/dictionaries';

export default function DictionaryPage() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [selectedDict, setSelectedDict] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const dictionaries = useAsync(() => listDictionaries(), []);
  const hasDicts = (dictionaries.data?.length ?? 0) > 0;

  const results = useAsync(
    () => (searched ? lookupTopic(searched, selectedDict ?? undefined) : Promise.resolve([])),
    [searched, selectedDict],
  );

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    setSearched('');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (value.trim().length >= 2) setSearched(value.trim());
    }, 500);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setSearched(query.trim());
  };

  const selectDict = (id: string | null) => {
    setSelectedDict(id);
    if (query.trim().length >= 2) setSearched(query.trim());
  };

  if (!hasDicts && !dictionaries.loading) {
    return (
      <div className="page">
        <h1 className="page-title">Dicionário</h1>
        <EmptyState
          icon="dictionary"
          title="Nenhum dicionário importado"
          description="Importe um dicionário (.dictionary.SQLite3 ou JSON) nas Configurações para poder consultar palavras e termos bíblicos."
          action={
            <Link className="btn btn-primary btn-sm" to="/config">
              Importar dicionário
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Dicionário</h1>

      {dictionaries.data && dictionaries.data.length > 0 && (
        <div className="dict-filters">
          <button
            className={`dict-filter${selectedDict === null ? ' active' : ''}`}
            onClick={() => selectDict(null)}
          >
            Todos
          </button>
          {dictionaries.data.map((d) => (
            <button
              key={d.id}
              className={`dict-filter${selectedDict === d.id ? ' active' : ''}`}
              onClick={() => selectDict(d.id)}
            >
              {d.name}
              <span className="dict-filter-count">{d.entries}</span>
            </button>
          ))}
        </div>
      )}

      <form className="search-bar" onSubmit={handleSubmit} style={{ marginBottom: 'var(--sp-4)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          type="search"
          className="search-input"
          placeholder="Digite uma palavra ou código Strong…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          autoFocus
        />
      </form>

      {searched && results.loading && <Spinner />}

      {searched && results.data && results.data.length > 0 && (
        <div className="stack" style={{ gap: 'var(--sp-4)' }}>
          {results.data.map((entry, i) => (
            <div key={i} className="strong-detail-entry">
              <span className="strong-detail-topic">{entry.topic}</span>
              <span className="strong-detail-source">{entry.dictionary}</span>
              <div
                className="strong-definition"
                dangerouslySetInnerHTML={{ __html: entry.definition }}
              />
            </div>
          ))}
        </div>
      )}

      {searched && results.data && results.data.length === 0 && !results.loading && (
        <EmptyState
          icon="search"
          title="Nenhum resultado"
          description={`Não encontrei "${searched}" nos dicionários${selectedDict ? ' selecionados' : ''}.`}
        />
      )}
    </div>
  );
}
