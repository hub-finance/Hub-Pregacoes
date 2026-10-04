import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, PageHeader, SelectInput } from '../../components/ui';
import { useSettings } from '../../core/settings/SettingsContext';
import { bookName, CANON_BY_OSIS } from '../../core/bible/canon';
import { getChapter, loadAvailableTranslations } from '../../core/bible/repository';
import { useAsync, useDebounced } from '../../hooks';
import {
  hasLocalConcordance,
  getLocalConcordanceIndex,
  getLocalConcordanceLetter,
  buildLocalConcordance,
} from '../../core/data/concordanceBuilder';

interface ConcordanceIndex {
  _total: number;
  _verses: number;
  [letter: string]: number;
}

type WordEntry = [string, number, [string, number, number][]];

const LETTERS_PT = 'abcdefghijlmnopqrstuvxz'.split('');

const KNOWN_CONCORDANCES = ['pt_almeida', 'pt_alm1911', 'pt_blivre', 'pt_tb', 'en_kjv'];

const CONCORDANCE_LABELS: Record<string, string> = {
  pt_almeida: 'Almeida Revisada',
  pt_alm1911: 'Almeida 1911',
  pt_blivre: 'Bíblia Livre',
  pt_tb: 'Tradução Brasileira',
  en_kjv: 'King James (inglês)',
};

async function fetchIndex(translation: string): Promise<ConcordanceIndex | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}concordance/${translation}/index.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchLetter(translation: string, letter: string): Promise<Record<string, WordEntry>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}concordance/${translation}/${letter}.json`);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const PAGE_SIZE = 50;

type TestamentFilter = 'all' | 'AT' | 'NT';

function extractSnippet(text: string, word: string, maxLen = 90): string {
  const lower = text.toLowerCase();
  const target = word.toLowerCase();
  const idx = lower.indexOf(target);
  if (idx < 0) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  const half = Math.floor((maxLen - target.length) / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, idx + target.length + half);
  let snippet = '';
  if (start > 0) snippet += '…';
  snippet += text.slice(start, idx);
  snippet += `<mark>${text.slice(idx, idx + target.length)}</mark>`;
  snippet += text.slice(idx + target.length, end);
  if (end < text.length) snippet += '…';
  return snippet;
}

async function loadIndex(translation: string): Promise<ConcordanceIndex | null> {
  if (KNOWN_CONCORDANCES.includes(translation)) {
    return fetchIndex(translation);
  }
  const local = await getLocalConcordanceIndex(translation);
  if (local) return local;
  return null;
}

async function loadLetterData(translation: string, letter: string): Promise<Record<string, WordEntry>> {
  if (KNOWN_CONCORDANCES.includes(translation)) {
    return fetchLetter(translation, letter);
  }
  return getLocalConcordanceLetter(translation, letter);
}

export default function ConcordancePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [concordanceTranslation, setConcordanceTranslation] = useState(settings.defaultTranslation);
  const [index, setIndex] = useState<ConcordanceIndex | null>(null);
  const [indexReady, setIndexReady] = useState(false);
  const [needsBuild, setNeedsBuild] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState('');
  const [letter, setLetter] = useState('');
  const [words, setWords] = useState<[string, WordEntry][]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [testamentFilter, setTestamentFilter] = useState<TestamentFilter>('all');
  const [snippets, setSnippets] = useState<Map<string, string>>(new Map());

  const debounced = useDebounced(query, 300);
  const cacheRef = useRef<Map<string, Record<string, WordEntry>>>(new Map());

  const translations = useAsync(() => loadAvailableTranslations(), []);

  const translationOptions = useMemo(() => {
    const opts = KNOWN_CONCORDANCES.map((id) => ({
      value: id,
      label: CONCORDANCE_LABELS[id] ?? id,
    }));
    if (translations.data) {
      for (const t of translations.data) {
        if (!KNOWN_CONCORDANCES.includes(t.id) && t.imported) {
          opts.push({ value: t.id, label: t.shortName || t.name });
        }
      }
    }
    return opts;
  }, [translations.data]);

  useEffect(() => {
    cacheRef.current.clear();
    setIndex(null);
    setIndexReady(false);
    setNeedsBuild(false);
    setWords([]);
    setLetter('');
    setSelected(null);

    (async () => {
      let idx = await loadIndex(concordanceTranslation);
      if (idx) {
        setIndex(idx);
        setIndexReady(true);
        return;
      }

      const isImported = !KNOWN_CONCORDANCES.includes(concordanceTranslation);
      if (isImported) {
        const hasLocal = await hasLocalConcordance(concordanceTranslation);
        if (!hasLocal) {
          setNeedsBuild(true);
          setIndexReady(true);
          return;
        }
      }

      for (const fallback of KNOWN_CONCORDANCES) {
        if (fallback === concordanceTranslation) continue;
        idx = await loadIndex(fallback);
        if (idx) {
          setConcordanceTranslation(fallback);
          setIndex(idx);
          setIndexReady(true);
          return;
        }
      }
      setIndexReady(true);
    })();
  }, [concordanceTranslation]);

  const handleBuild = async () => {
    setBuilding(true);
    setBuildProgress('Iniciando…');
    try {
      const idx = await buildLocalConcordance(concordanceTranslation, setBuildProgress);
      setIndex(idx);
      setNeedsBuild(false);
    } catch (err) {
      setBuildProgress(err instanceof Error ? err.message : 'Erro ao gerar concordância.');
    } finally {
      setBuilding(false);
    }
  };

  const loadLetter = useCallback(
    async (l: string) => {
      setLetter(l);
      setSelected(null);
      setPage(1);
      setLoading(true);
      try {
        let data = cacheRef.current.get(l);
        if (!data) {
          data = await loadLetterData(concordanceTranslation, l);
          cacheRef.current.set(l, data);
        }
        const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
        setWords(entries);
      } finally {
        setLoading(false);
      }
    },
    [concordanceTranslation],
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
        data = await loadLetterData(concordanceTranslation, firstChar);
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
  }, [debounced, concordanceTranslation, loadLetter, letter]);

  const selectedEntry = useMemo(() => {
    if (!selected) return null;
    const found = words.find(([key]) => key === selected);
    return found ? found[1] : null;
  }, [selected, words]);

  const filteredRefs = useMemo(() => {
    if (!selectedEntry) return [];
    if (testamentFilter === 'all') return selectedEntry[2];
    return selectedEntry[2].filter(([book]) => CANON_BY_OSIS.get(book)?.testament === testamentFilter);
  }, [selectedEntry, testamentFilter]);

  const visibleRefs = useMemo(() => {
    return expanded ? filteredRefs : filteredRefs.slice(0, 30);
  }, [filteredRefs, expanded]);

  const atCount = useMemo(() => {
    if (!selectedEntry) return 0;
    return selectedEntry[2].filter(([b]) => CANON_BY_OSIS.get(b)?.testament === 'AT').length;
  }, [selectedEntry]);

  const ntCount = useMemo(() => {
    if (!selectedEntry) return 0;
    return selectedEntry[2].filter(([b]) => CANON_BY_OSIS.get(b)?.testament === 'NT').length;
  }, [selectedEntry]);

  useEffect(() => {
    if (!selectedEntry || !visibleRefs.length) {
      setSnippets(new Map());
      return;
    }
    const word = selectedEntry[0];
    let cancelled = false;

    (async () => {
      const byChapter = new Map<string, [string, number, number][]>();
      for (const ref of visibleRefs) {
        const chKey = `${ref[0]}:${ref[1]}`;
        const list = byChapter.get(chKey) ?? [];
        list.push(ref);
        byChapter.set(chKey, list);
      }

      const result = new Map<string, string>();
      for (const [chKey, refs] of byChapter) {
        if (cancelled) return;
        const [book, ch] = chKey.split(':');
        try {
          const verses = await getChapter(concordanceTranslation, book, Number(ch));
          for (const [, , vs] of refs) {
            const text = verses[vs - 1] ?? '';
            if (text) result.set(`${book}-${ch}-${vs}`, extractSnippet(text, word));
          }
        } catch { /* tradução pode não ter esse livro */ }
      }
      if (!cancelled) setSnippets(result);
    })();

    return () => { cancelled = true; };
  }, [selectedEntry, visibleRefs, concordanceTranslation]);

  const visibleWords = words.slice(0, page * PAGE_SIZE);
  const hasMore = words.length > visibleWords.length;

  const handleTranslationChange = (id: string) => {
    cacheRef.current.clear();
    setConcordanceTranslation(id);
    setWords([]);
    setLetter('');
    setSelected(null);
    setQuery('');
  };

  if (!indexReady) {
    return (
      <div className="page">
        <PageHeader title="Concordância" lead="Carregando…" />
      </div>
    );
  }

  if (needsBuild && !index) {
    const translationName = translations.data?.find((t) => t.id === concordanceTranslation)?.shortName ?? concordanceTranslation;
    return (
      <div className="page">
        <PageHeader title="Concordância" lead={`${translationName}`} />

        <div className="card" style={{ marginBottom: 'var(--sp-3)' }}>
          <SelectInput
            label="Tradução"
            value={concordanceTranslation}
            onChange={handleTranslationChange}
            options={translationOptions}
          />
        </div>

        <EmptyState
          icon="list"
          title="Concordância não gerada"
          description={`A concordância para "${translationName}" precisa ser gerada a partir dos versículos importados. Isso leva alguns segundos e só é feito uma vez.`}
          action={
            <button
              className="btn btn-primary btn-sm"
              onClick={handleBuild}
              disabled={building}
            >
              {building ? buildProgress : 'Gerar concordância'}
            </button>
          }
        />
      </div>
    );
  }

  if (!index) {
    return (
      <div className="page">
        <PageHeader title="Concordância" lead="Não foi possível carregar a concordância." />
        <div className="card stack">
          <p className="small dim">
            Verifique sua conexão e tente recarregar a página. Se o problema persistir, limpe o cache do
            navegador nas configurações do app.
          </p>
          <button className="btn btn-sm" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Concordância"
        lead={`${index._total.toLocaleString('pt-BR')} palavras em ${index._verses.toLocaleString('pt-BR')} versículos`}
      />

      <div className="card" style={{ marginBottom: 'var(--sp-3)' }}>
        <SelectInput
          label="Tradução"
          value={concordanceTranslation}
          onChange={handleTranslationChange}
          options={translationOptions}
        />
      </div>

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

            {atCount > 0 && ntCount > 0 && (
              <div className="chip-row" style={{ marginBottom: 'var(--sp-3)' }}>
                <button
                  className={`chip${testamentFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setTestamentFilter('all')}
                >
                  Todos ({selectedEntry[1]})
                </button>
                <button
                  className={`chip${testamentFilter === 'AT' ? ' active' : ''}`}
                  onClick={() => setTestamentFilter('AT')}
                >
                  AT ({atCount})
                </button>
                <button
                  className={`chip${testamentFilter === 'NT' ? ' active' : ''}`}
                  onClick={() => setTestamentFilter('NT')}
                >
                  NT ({ntCount})
                </button>
              </div>
            )}

            <p className="small dim" style={{ marginBottom: 'var(--sp-2)' }}>
              {filteredRefs.length} versículo{filteredRefs.length !== 1 ? 's' : ''}
              {testamentFilter !== 'all' ? ` no ${testamentFilter}` : ''}
            </p>

            <div className="stack" style={{ gap: 'var(--sp-2)' }}>
              {visibleRefs.map(([book, ch, vs], i) => {
                const snippet = snippets.get(`${book}-${ch}-${vs}`);
                return (
                  <button
                    key={`${book}-${ch}-${vs}-${i}`}
                    className="hit"
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--sp-1)' }}
                    onClick={() => navigate(`/biblia/${book}/${ch}?v=${vs}`)}
                  >
                    <div className="hit-ref">
                      {bookName(book)} {ch}:{vs}
                    </div>
                    {snippet && (
                      <div
                        className="small dim"
                        style={{ lineHeight: 1.4 }}
                        dangerouslySetInnerHTML={{ __html: snippet }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {!expanded && filteredRefs.length > 30 && (
              <button
                className="btn btn-sm"
                onClick={() => setExpanded(true)}
                style={{ marginTop: 'var(--sp-3)' }}
              >
                Ver todos os {filteredRefs.length} versículos
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
                  onClick={() => { setSelected(key); setExpanded(false); setTestamentFilter('all'); }}
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
