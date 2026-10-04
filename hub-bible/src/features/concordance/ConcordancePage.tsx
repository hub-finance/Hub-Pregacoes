import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, PageHeader } from '../../components/ui';
import { useSettings } from '../../core/settings/SettingsContext';
import { bookName } from '../../core/bible/canon';
import { useDebounced } from '../../hooks';

interface ConcordanceIndex {
  _total: number;
  _verses: number;
  [letter: string]: number;
}

type WordEntry = [string, number, [string, number, number][]];

const LETTERS_PT = 'abcdefghijlmnopqrstuvxz'.split('');

async function fetchIndex(translation: string): Promise<ConcordanceIndex> {
  const res = await fetch(`${import.meta.env.BASE_URL}concordance/${translation}/index.json`);
  if (!res.ok) throw new Error('Concordância não disponível');
  return res.json();
}

async function fetchLetter(translation: string, letter: string): Promise<Record<string, WordEntry>> {
  const res = await fetch(`${import.meta.env.BASE_URL}concordance/${translation}/${letter}.json`);
  if (!res.ok) return {};
  return res.json();
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const PAGE_SIZE = 50;

export default function ConcordancePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const translation = settings.defaultTranslation;

  const [index, setIndex] = useState<ConcordanceIndex | null>(null);
  const [letter, setLetter] = useState('');
  const [words, setWords] = useState<[string, WordEntry][]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);

  const debounced = useDebounced(query, 300);
  const cacheRef = useRef<Map<string, Record<string, WordEntry>>>(new Map());

  useEffect(() => {
    cacheRef.current.clear();
    setIndex(null);
    setWords([]);
    setLetter('');
    setSelected(null);
    fetchIndex(translation).then(setIndex).catch(() => setIndex(null));
  }, [translation]);

  const loadLetter = useCallback(
    async (l: string) => {
      setLetter(l);
      setSelected(null);
      setPage(1);
      setLoading(true);
      try {
        let data = cacheRef.current.get(l);
        if (!data) {
          data = await fetchLetter(translation, l);
          cacheRef.current.set(l, data);
        }
        const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
        setWords(entries);
      } finally {
        setLoading(false);
      }
    },
    [translation],
  );

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      if (letter) {
        loadLetter(letter);
      }
      return;
    }
    const norm = normalize(debounced);
    const firstChar = norm.charAt(0);
    if (!firstChar) return;

    setLoading(true);
    (async () => {
      let data = cacheRef.current.get(firstChar);
      if (!data) {
        data = await fetchLetter(translation, firstChar);
        cacheRef.current.set(firstChar, data);
      }
      const filtered = Object.entries(data)
        .filter(([key]) => key.startsWith(norm) || key.includes(norm))
        .sort(([a], [b]) => {
          const aStarts = a.startsWith(norm) ? 0 : 1;
          const bStarts = b.startsWith(norm) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return a.localeCompare(b, 'pt-BR');
        });
      setWords(filtered);
      setLetter(firstChar);
      setPage(1);
      setLoading(false);
    })();
  }, [debounced, translation, loadLetter, letter]);

  const selectedEntry = useMemo(() => {
    if (!selected) return null;
    const found = words.find(([key]) => key === selected);
    return found ? found[1] : null;
  }, [selected, words]);

  const visibleRefs = useMemo(() => {
    if (!selectedEntry) return [];
    const refs = selectedEntry[2];
    return expanded ? refs : refs.slice(0, 30);
  }, [selectedEntry, expanded]);

  const visibleWords = words.slice(0, page * PAGE_SIZE);
  const hasMore = words.length > visibleWords.length;

  if (!index) {
    return (
      <div className="page">
        <PageHeader title="Concordância" lead="Carregando…" />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Concordância"
        lead={`${index._total.toLocaleString('pt-BR')} palavras em ${index._verses.toLocaleString('pt-BR')} versículos`}
      />

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Buscar palavra na concordância…"
          aria-label="Buscar palavra"
          inputMode="search"
        />
        {query && (
          <button
            className="icon-btn"
            style={{ width: 32, height: 32 }}
            onClick={() => { setQuery(''); setSelected(null); }}
            aria-label="Limpar"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {!query && (
        <div className="chip-row" style={{ marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {LETTERS_PT.map((l) => {
            const count = index[l] ?? 0;
            if (!count) return null;
            return (
              <button
                key={l}
                className={`chip${letter === l ? ' active' : ''}`}
                onClick={() => { loadLetter(l); setQuery(''); }}
                style={{ textTransform: 'uppercase', minWidth: 36 }}
              >
                {l.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {loading && <p className="small dim">Carregando…</p>}

      {!loading && !letter && !query && (
        <EmptyState
          icon="list"
          title="Concordância exaustiva"
          description="Selecione uma letra acima ou busque uma palavra para ver todas as suas ocorrências na Bíblia."
        />
      )}

      {selected && selectedEntry ? (
        <div>
          <button
            className="btn btn-sm"
            onClick={() => setSelected(null)}
            style={{ marginBottom: 'var(--sp-3)' }}
          >
            <Icon name="chevron-left" size={16} /> Voltar à lista
          </button>

          <div className="section">
            <div className="section-head">
              <h2 className="section-title" style={{ textTransform: 'capitalize' }}>
                {selectedEntry[0]}
              </h2>
              <span className="small dim">
                {selectedEntry[1]} ocorrência{selectedEntry[1] !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="stack" style={{ gap: 'var(--sp-2)' }}>
              {visibleRefs.map(([book, ch, vs], i) => (
                <button
                  key={`${book}-${ch}-${vs}-${i}`}
                  className="hit"
                  onClick={() => navigate(`/biblia/${book}/${ch}?v=${vs}`)}
                >
                  <div className="hit-ref">
                    {bookName(book)} {ch}:{vs}
                  </div>
                </button>
              ))}
            </div>

            {!expanded && selectedEntry[2].length > 30 && (
              <button
                className="btn btn-sm"
                onClick={() => setExpanded(true)}
                style={{ marginTop: 'var(--sp-3)' }}
              >
                Ver todas as {selectedEntry[1]} ocorrências
              </button>
            )}
          </div>
        </div>
      ) : (
        !loading && words.length > 0 && (
          <div>
            <p className="small dim" style={{ marginBottom: 'var(--sp-3)' }}>
              {words.length} palavra{words.length !== 1 ? 's' : ''}
              {query ? ` para "${query}"` : ` com "${letter.toUpperCase()}"`}
            </p>

            <div className="stack" style={{ gap: 'var(--sp-1)' }}>
              {visibleWords.map(([key, entry]) => (
                <button
                  key={key}
                  className="hit"
                  onClick={() => { setSelected(key); setExpanded(false); }}
                >
                  <div className="hit-ref" style={{ textTransform: 'capitalize', flex: 1 }}>
                    {entry[0]}
                  </div>
                  <span className="small dim">{entry[1]}×</span>
                  <Icon name="chevron-right" size={16} className="dim" />
                </button>
              ))}
            </div>

            {hasMore && (
              <button
                className="btn btn-sm"
                onClick={() => setPage((p) => p + 1)}
                style={{ marginTop: 'var(--sp-3)', width: '100%' }}
              >
                Mostrar mais palavras
              </button>
            )}
          </div>
        )
      )}

      {!loading && query && words.length === 0 && (
        <EmptyState
          icon="search"
          title="Nenhuma palavra encontrada"
          description={`Não há ocorrências de "${query}" na concordância.`}
        />
      )}
    </div>
  );
}
