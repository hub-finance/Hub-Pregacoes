import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getBook, findVersesWithStrong } from '../../core/bible/repository';
import { verseWords } from '../../core/bible/mybible';
import { lookupStrong } from '../../core/data/dictionaries';
import { findGroupForStrong, type SemanticGroup } from '../../core/bible/reference-data';
import type { StrongTag } from '../../core/db/types';

interface Props {
  open: boolean;
  onClose: () => void;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  initialWord?: number | null;
}

/**
 * O versículo palavra por palavra, com o número de Strong de cada uma.
 *
 * Abre a partir do versículo selecionado, e não de um toque na palavra: no
 * tablet, palavra é alvo pequeno demais, e tocar no texto já significa
 * selecionar o versículo. Aqui as palavras viram botões do tamanho do dedo.
 *
 * Sem dicionário importado, o código aparece sozinho — e a folha diz onde
 * arrumar um, em vez de mostrar "H430" e deixar o leitor no escuro.
 */
export function StrongSheet({ open, onClose, translation, book, chapter, verse, reference, initialWord }: Props) {
  const [picked, setPicked] = useState<number | null>(null);

  const data = useAsync(async () => {
    const record = await getBook(translation, book);
    const text = record.chapters[chapter - 1]?.[verse - 1] ?? '';
    const tags: StrongTag[] = record.strongs?.[chapter - 1]?.[verse - 1] ?? [];
    return { words: verseWords(text), tags };
  }, [translation, book, chapter, verse, open]);

  /** Palavra -> códigos. Uma palavra pode carregar mais de um. */
  const codesByWord = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const [index, code] of data.data?.tags ?? []) {
      const list = map.get(index) ?? [];
      list.push(code);
      map.set(index, list);
    }
    return map;
  }, [data.data]);

  useEffect(() => {
    if (!open) setPicked(null);
    else if (initialWord != null) setPicked(initialWord);
  }, [open, initialWord]);

  const codes = picked === null ? [] : (codesByWord.get(picked) ?? []);
  const definitions = useAsync(
    async () => (codes.length ? (await Promise.all(codes.map(lookupStrong))).flat() : []),
    [codes.join(','), open],
  );

  const semanticGroup = useAsync(
    async (): Promise<SemanticGroup | null> =>
      codes.length === 1 ? findGroupForStrong(codes[0]) : null,
    [codes.join(','), open],
  );

  const occurrences = useAsync(
    async () => (codes.length ? findVersesWithStrong(translation, codes[0]) : []),
    [codes.join(','), translation, open],
  );

  return (
    <Sheet open={open} title={`${reference} — no original`} onClose={onClose} size="lg">
      {data.loading && <Spinner />}

      {data.data && !codesByWord.size && (
        <p className="dim">Este versículo não traz números de Strong nesta tradução.</p>
      )}

      {data.data && codesByWord.size > 0 && (
        <>
          <div className="strong-words">
            {data.data.words.map((word, index) => {
              const codes = codesByWord.get(index);
              if (codes) {
                return (
                  <button
                    key={index}
                    className={`strong-word${picked === index ? ' active' : ''}`}
                    onClick={() => setPicked(index === picked ? null : index)}
                  >
                    <span className="strong-word-text">{word}</span>
                    <span className="strong-code">{codes[0]}</span>
                  </button>
                );
              }
              return <span key={index}>{index > 0 ? ' ' : ''}{word}</span>;
            })}
          </div>

          {picked !== null && (
            <div className="strong-detail">
              <div className="strong-detail-head">
                <span className="strong-detail-word">{data.data.words[picked]}</span>
                <span className="strong-detail-codes">
                  {codes.map((c) => (
                    <span key={c} className="strong-detail-code">{c}</span>
                  ))}
                </span>
              </div>

              {definitions.loading && <Spinner />}

              {definitions.data?.map((d, i) => (
                <div key={i} className="strong-detail-entry">
                  {d.topic && <span className="strong-detail-topic">{d.topic}</span>}
                  <span className="strong-detail-source">{d.dictionary}</span>
                  <div
                    className="strong-definition"
                    dangerouslySetInnerHTML={{ __html: d.definition }}
                  />
                </div>
              ))}

              {definitions.data && !definitions.data.length && (
                <div className="notice">
                  <span>Nenhum dicionário importado traz este verbete.</span>
                  <Link to="/config" onClick={onClose} className="small" style={{ fontWeight: 600 }}>
                    Importar dicionário
                  </Link>
                </div>
              )}

              {semanticGroup.data && (
                <div className="card stack" style={{ gap: 'var(--sp-2)' }}>
                  <div className="row" style={{ gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <Icon name="layers" size={16} className="dim" />
                    <strong className="small">{semanticGroup.data.nome}</strong>
                  </div>
                  <p className="small dim">{semanticGroup.data.descricao}</p>
                  <div className="crossref-list">
                    {semanticGroup.data.termos.map((t) => (
                      <span
                        key={t.strong}
                        className={`crossref-chip${t.strong === codes[0] ? ' active' : ''}`}
                        style={t.strong === codes[0] ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } : undefined}
                      >
                        <span style={{ fontStyle: 'italic' }}>{t.lemma}</span>
                        <span className="dim">— {t.sentido}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {occurrences.data && occurrences.data.length > 0 && (
                <div className="card stack" style={{ gap: 'var(--sp-2)' }}>
                  <div className="row" style={{ gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <Icon name="book" size={16} className="dim" />
                    <strong className="small">Versículos com este termo</strong>
                  </div>
                  <div className="stack" style={{ gap: 'var(--sp-3)' }}>
                    {occurrences.data.map((o, i) => (
                      <div key={i} style={{ paddingLeft: 'var(--sp-2)', borderLeft: '2px solid var(--border)' }}>
                        <Link
                          to={`/biblia/${o.book}/${o.chapter}`}
                          onClick={onClose}
                          className="small"
                          style={{ fontWeight: 650, color: 'var(--accent)' }}
                        >
                          {o.bookName} {o.chapter}:{o.verse}
                        </Link>
                        <p className="small" style={{ margin: '2px 0 0', color: 'var(--text-2)' }}>{o.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
