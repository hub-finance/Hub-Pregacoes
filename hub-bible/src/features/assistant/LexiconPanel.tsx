import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { lookupLexicon, passageWords, type LexiconHit } from '../../core/data/lexiconLookup';
import type { PreviewTarget } from '../bible/VersePreview';
import '../../styles/assistant.css';

interface Props {
  translation: string;
  /** Consulta aberta de fora (um número de Strong tocado na resposta). */
  query: string;
  onQuery: (query: string) => void;
  onRef: (target: PreviewTarget) => void;
  /** O versículo aberto acima: mostra as palavras do original dele. */
  passage?: PreviewTarget | null;
}

/**
 * Léxico grego e hebraico dentro do assistente. O que está em português vem
 * primeiro; o Strong embutido, em inglês, fica fechado no fim de cada verbete.
 */
export function LexiconPanel({ translation, query, onQuery, onRef, passage }: Props) {
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  const hits = useAsync(
    () => (query.trim() ? lookupLexicon(query, translation) : Promise.resolve([] as LexiconHit[])),
    [query, translation],
  );
  const words = useAsync(
    () => (passage ? passageWords(translation, passage) : Promise.resolve([])),
    [translation, passage?.book, passage?.chapter, passage?.verse, passage?.verseEnd],
  );
  // abaixo do versículo, o verbete escolhido aparece já à vista
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (passage && query && hits.data?.length) resultsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hits.data, passage, query]);

  return (
    <div className={`lexicon stack${passage ? ' lexicon-below' : ''}`} style={{ gap: 'var(--sp-3)' }}>
      {passage && <h3 className="lexicon-title">Léxico grego e hebraico</h3>}
      {passage && words.data && words.data.length > 0 && (
        <div className="stack" style={{ gap: 'var(--sp-2)' }}>
          <p className="small dim" style={{ margin: 0 }}>Palavras do original nesta passagem:</p>
          <div className="crossref-list">
            {words.data.map((w) => (
              <button
                key={w.code}
                type="button"
                className={`crossref-chip${w.code === query ? ' active' : ''}`}
                onClick={() => onQuery(w.code)}
              >
                {w.translit && <span style={{ fontStyle: 'italic' }}>{w.translit}</span>}
                <span className="dim">{w.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {passage && words.data && !words.data.length && !words.loading && (
        <p className="small dim" style={{ margin: 0 }}>
          O aparelho não marca as palavras do original nesta passagem. Consulte uma palavra abaixo.
        </p>
      )}
      <form
        className="search-bar"
        onSubmit={(e) => { e.preventDefault(); onQuery(text.trim()); }}
        role="search"
      >
        <Icon name="search" size={18} className="dim" />
        <input
          type="search"
          className="search-input"
          aria-label="Palavra, transliteração ou número de Strong"
          placeholder="paz, shalom, H7965, ἀγάπη…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-sm btn-primary" disabled={!text.trim()}>
          Consultar
        </button>
      </form>

      {!query.trim() && !passage && (
        <p className="small dim" style={{ margin: 0 }}>
          Escreva a palavra em português ("graça"), a transliteração ("charis"), o número de Strong ("G5485") ou a
          palavra no original ("χάρις"). Os números de Strong que aparecem nas respostas também abrem aqui.
        </p>
      )}

      {query.trim() && hits.loading && <Spinner label="Consultando o léxico…" />}

      {query.trim() && hits.data && !hits.data.length && !hits.loading && (
        <p className="small dim" style={{ margin: 0 }}>
          Não encontrei "{query}". Tente o número de Strong (H7965), a transliteração (shalom) ou a palavra em
          português de uma doutrina (paz, graça, fé).
        </p>
      )}

      <div ref={resultsRef} />
      {hits.data?.map((h) => (
        <LexiconHitCard key={h.code} hit={h} onQuery={onQuery} onRef={onRef} />
      ))}
    </div>
  );
}

/** Um verbete do léxico: o que está em português primeiro, o Strong em inglês fechado no fim. */
export function LexiconHitCard({ hit: h, onQuery, onRef }: { hit: LexiconHit; onQuery: (q: string) => void; onRef: (t: PreviewTarget) => void }) {
  return (
    <article className="card lexicon-hit">
      <header className="lexicon-head">
        {h.word && (
          <span className="lexicon-word" lang={h.language === 'hebraico' ? 'he' : 'grc'} dir={h.language === 'hebraico' ? 'rtl' : 'ltr'}>
            {h.word}
          </span>
        )}
        <span className="lexicon-meta">
          {h.translit && <em>{h.translit}</em>}
          <span className="badge">{h.code}</span>
          <span className="small dim">{h.language === 'hebraico' ? 'Hebraico' : 'Grego'}</span>
          {h.pron && <span className="small dim">pronúncia: {h.pron}</span>}
        </span>
      </header>

      {h.doctrines.map((d) => (
        <p key={d.termo} className="lexicon-doctrine">
          <strong>{d.termo}.</strong> {d.definicao}
        </p>
      ))}

      {h.group && (
        <div className="lexicon-group">
          <p className="small" style={{ margin: 0 }}>
            <strong>{h.group.nome}</strong> — {h.group.descricao}
          </p>
          <div className="crossref-list">
            {h.group.termos.map((t) => (
              <button
                key={t.strong}
                type="button"
                className={`crossref-chip${t.strong === h.code ? ' active' : ''}`}
                onClick={() => onQuery(t.strong)}
                aria-label={`${t.translit}, ${t.sentido}`}
              >
                <span style={{ fontStyle: 'italic' }}>{t.translit}</span>
                <span className="dim">— {t.sentido}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {h.imported.map((d, i) => (
        <div key={i} className="strong-detail-entry">
          {d.topic && <span className="strong-detail-topic">{d.topic}</span>}
          <span className="strong-detail-source">{d.dictionary}</span>
          <div className="strong-definition" dangerouslySetInnerHTML={{ __html: d.definition }} />
        </div>
      ))}

      {h.occurrences.length > 0 && (
        <div className="lexicon-occ">
          <p className="small" style={{ margin: 0, fontWeight: 600 }}>Onde aparece na sua Bíblia</p>
          <ul>
            {h.occurrences.map((o) => (
              <li key={`${o.book}.${o.chapter}.${o.verse}`}>
                <button
                  type="button"
                  className="ref-link"
                  onClick={() => onRef({ book: o.book, chapter: o.chapter, verse: o.verse })}
                >
                  {o.bookName} {o.chapter}:{o.verse}
                </button>{' '}
                <span className="small dim">{o.text.length > 120 ? `${o.text.slice(0, 120)}…` : o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {h.builtin && (
        <details className="lexicon-builtin">
          <summary>Definição de Strong (original em inglês)</summary>
          <div className="strong-definition" dangerouslySetInnerHTML={{ __html: h.builtin }} />
        </details>
      )}
    </article>
  );
}
