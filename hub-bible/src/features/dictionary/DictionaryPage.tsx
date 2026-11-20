import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { SidePanel } from '../../components/SidePanel';
import { EmptyState, Spinner } from '../../components/ui';
import { useAsync, useIsWide } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { listDictionaries, lookupTopic } from '../../core/data/dictionaries';
import { lookupLexicon, type LexiconHit } from '../../core/data/lexiconLookup';
import { LexiconHitCard } from '../assistant/LexiconPanel';
import { VersePreview, previewLabel, type PreviewTarget } from '../bible/VersePreview';

/** Parece código Strong? (H430, G2316, 430, etc.) */
function looksLikeCode(s: string): boolean {
  return /^[HGhg]?\d+$/.test(s.trim());
}

/** O nome com que o Strong embutido (em inglês) aparece entre os dicionários. */
const BUILTIN_NAME = 'Léxico Strong (embutido)';

/**
 * Dicionário: primeiro o léxico grego e hebraico em português (o mesmo do
 * Assistente bíblico), depois o que os dicionários importados dizem. O Strong
 * embutido, em inglês, aparece fechado dentro do verbete, não solto na lista.
 */
export default function DictionaryPage() {
  const { settings } = useSettings();
  const translation = settings.defaultTranslation;
  const isWide = useIsWide();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [selectedDict, setSelectedDict] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const dictionaries = useAsync(() => listDictionaries(), []);
  const hasDicts = (dictionaries.data?.length ?? 0) > 0;

  const selectedIsStrong = dictionaries.data?.find((d) => d.id === selectedDict)?.isStrong ?? false;

  // o léxico só quando a busca é em "Todos": um dicionário escolhido é pedido explícito
  const lexicon = useAsync(
    () => (searched && selectedDict === null ? lookupLexicon(searched, translation) : Promise.resolve([] as LexiconHit[])),
    [searched, selectedDict, translation],
  );
  const results = useAsync(
    () => (searched ? lookupTopic(searched, selectedDict ?? undefined) : Promise.resolve([])),
    [searched, selectedDict],
  );
  // o Strong embutido já está dentro dos verbetes do léxico: não repete
  const shown = (results.data ?? []).filter((r) => !(lexicon.data?.length && r.dictionary === BUILTIN_NAME));

  const search = (value: string) => {
    setQuery(value);
    setSearched(value.trim());
  };

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

  const loading = !!searched && (results.loading || lexicon.loading);
  const noResults = !!searched && !loading && !shown.length && !(lexicon.data?.length);
  const isWordInStrong = noResults && selectedIsStrong && !looksLikeCode(searched);

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

  const previewBody = preview && (
    <VersePreview target={preview} translation={translation} onBack={() => setPreview(null)} onNavigate={() => setPreview(null)} />
  );

  return (
    <div className={`page dict-layout${isWide && preview ? ' has-panel page-wide' : ''}`}>
      <div className="dict-main">
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
            aria-label="Palavra, transliteração ou número de Strong"
            placeholder={selectedIsStrong ? 'Digite um código Strong (ex: G2316, H430)…' : 'paz, shalom, H7965, ἀγάπη…'}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            autoFocus
          />
        </form>

        {!searched && selectedDict === null && (
          <p className="small dim">
            Escreva a palavra em português ("graça"), a transliteração ("charis"), o número de Strong ("G5485") ou a
            palavra no original ("χάρις"). Primeiro vem o léxico grego e hebraico, em português; depois, o que os seus
            dicionários importados dizem.
          </p>
        )}

        {loading && <Spinner />}

        {!!lexicon.data?.length && (
          <section className="stack" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }} aria-label="Léxico grego e hebraico">
            <h2 className="section-title" style={{ margin: 0 }}>Léxico grego e hebraico</h2>
            {lexicon.data.map((h) => (
              <LexiconHitCard key={h.code} hit={h} onQuery={search} onRef={setPreview} />
            ))}
          </section>
        )}

        {searched && shown.length > 0 && (
          <section className="stack" style={{ gap: 'var(--sp-4)' }} aria-label="Nos dicionários">
            {!!lexicon.data?.length && <h2 className="section-title" style={{ margin: 0 }}>Nos dicionários</h2>}
            {shown.map((entry, i) => (
              <div key={i} className="strong-detail-entry">
                <span className="strong-detail-topic">{entry.topic}</span>
                <span className="strong-detail-source">{entry.dictionary}</span>
                <div
                  className="strong-definition"
                  dangerouslySetInnerHTML={{ __html: entry.definition }}
                />
              </div>
            ))}
          </section>
        )}

        {isWordInStrong && (
          <EmptyState
            icon="search"
            title="O Strong usa códigos"
            description={`Para buscar "${searched}" por palavra, use "Todos" ou o Dicionário Português.`}
            action={
              <button className="btn btn-primary btn-sm" onClick={() => selectDict(null)}>
                Buscar em todos
              </button>
            }
          />
        )}

        {noResults && !isWordInStrong && (
          <EmptyState
            icon="search"
            title="Nenhum resultado"
            description={`Não encontrei "${searched}" nos dicionários${selectedDict ? ' selecionados' : ''}. Tente o número de Strong (H7965), a transliteração (shalom) ou a palavra em português de uma doutrina (paz, graça, fé).`}
          />
        )}
      </div>

      {isWide ? (
        <SidePanel open={!!preview} title={preview ? previewLabel(preview) : ''} onClose={() => setPreview(null)}>
          {previewBody}
        </SidePanel>
      ) : (
        <Sheet open={!!preview} title={preview ? previewLabel(preview) : ''} onClose={() => setPreview(null)}>
          {previewBody}
        </Sheet>
      )}
    </div>
  );
}
