import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getBook } from '../../core/bible/repository';
import { verseWords } from '../../core/bible/mybible';
import { hasStrongDictionary, lookupStrong } from '../../core/data/dictionaries';
import type { LexiconEntry } from '../../core/bible/lexicon';
import type { StrongTag } from '../../core/db/types';

/**
 * O verbete do léxico embutido, campo a campo.
 *
 * Vem em dados separados, e não num bloco de texto, então desenhar é melhor do
 * que emendar tudo numa frase: o termo original em corpo grande, a pronúncia ao
 * lado, e a definição em seguida. É a ordem em que se lê um léxico impresso.
 */
function LexiconBody({ entry }: { entry: LexiconEntry }) {
  return (
    <div className="stack" style={{ gap: 'var(--sp-1)' }}>
      {entry.lemma && (
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)', alignItems: 'baseline' }}>
          <span className="lexicon-lemma">{entry.lemma}</span>
          {entry.translit && <span style={{ fontStyle: 'italic' }}>{entry.translit}</span>}
          {entry.pron && <span className="small dim">{entry.pron}</span>}
        </div>
      )}
      {entry.definition && <p className="strong-definition">{entry.definition}</p>}
      {entry.derivation && (
        <p className="small dim">
          <strong>Derivação:</strong> {entry.derivation}
        </p>
      )}
      {entry.kjv && (
        <p className="small dim">
          <strong>Na King James:</strong> {entry.kjv}
        </p>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
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
export function StrongSheet({ open, onClose, translation, book, chapter, verse, reference }: Props) {
  const [picked, setPicked] = useState<number | null>(null);

  const data = useAsync(async () => {
    const record = await getBook(translation, book);
    const text = record.chapters[chapter - 1]?.[verse - 1] ?? '';
    const tags: StrongTag[] = record.strongs?.[chapter - 1]?.[verse - 1] ?? [];
    return { words: verseWords(text), tags, hasDictionary: await hasStrongDictionary() };
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
  }, [open]);

  const codes = picked === null ? [] : (codesByWord.get(picked) ?? []);
  const definitions = useAsync(
    async () => (codes.length ? (await Promise.all(codes.map(lookupStrong))).flat() : []),
    [codes.join(','), open],
  );

  return (
    <Sheet open={open} title={`${reference} — no original`} onClose={onClose} size="lg">
      {data.loading && <Spinner />}

      {data.data && !codesByWord.size && (
        <p className="dim">Este versículo não traz números de Strong nesta tradução.</p>
      )}

      {data.data && codesByWord.size > 0 && (
        <>
          <p className="small dim">
            Toque numa palavra destacada para ver o termo original.
          </p>

          <div className="strong-words">
            {data.data.words.map((word, index) => {
              const has = codesByWord.has(index);
              return has ? (
                <button
                  key={index}
                  className={`strong-word${picked === index ? ' active' : ''}`}
                  onClick={() => setPicked(index === picked ? null : index)}
                >
                  {word}
                  <span className="strong-code">{codesByWord.get(index)![0]}</span>
                </button>
              ) : (
                <span key={index} className="strong-plain">
                  {word}
                </span>
              );
            })}
          </div>

          {picked !== null && (
            <div className="stack" style={{ gap: 'var(--sp-2)' }}>
              <div className="row" style={{ gap: 'var(--sp-2)' }}>
                <strong style={{ fontSize: '1.05rem' }}>{data.data.words[picked]}</strong>
                {codes.map((c) => (
                  <span key={c} className="badge">
                    {c}
                  </span>
                ))}
              </div>

              {definitions.loading && <Spinner />}

              {definitions.data?.map((d, i) => (
                <div key={i} className="card stack" style={{ gap: 'var(--sp-1)' }}>
                  <span className="list-meta">
                    {d.dictionary} · {d.topic}
                  </span>

                  {d.lexicon ? (
                    <LexiconBody entry={d.lexicon} />
                  ) : (
                    <div
                      className="strong-definition"
                      dangerouslySetInnerHTML={{ __html: d.definition }}
                    />
                  )}

                  {/* crédito exigido pela licença da fonte; não é enfeite */}
                  {d.credit && <span className="small dim">{d.credit}</span>}
                </div>
              ))}

              {definitions.data && !definitions.data.length && (
                <div className="notice">
                  <span>Nenhum léxico traz este verbete.</span>
                </div>
              )}

              {/* Convite, não aviso de falta: o léxico embutido já respondeu.
                  Só faz sentido para quem ainda não tem um em português. */}
              {definitions.data?.length && !data.data.hasDictionary ? (
                <p className="small dim">
                  O léxico que vem no aplicativo é em inglês.{' '}
                  <Link to="/config" onClick={onClose} style={{ fontWeight: 600 }}>
                    Importe um em português
                  </Link>{' '}
                  se você tiver um — ele passa a aparecer primeiro.
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
