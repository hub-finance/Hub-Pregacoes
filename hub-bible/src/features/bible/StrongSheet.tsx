import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getBook } from '../../core/bible/repository';
import { verseWords } from '../../core/bible/mybible';
import { hasStrongDictionary, lookupStrong } from '../../core/data/dictionaries';
import type { StrongTag } from '../../core/db/types';

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
                  <div
                    className="strong-definition"
                    dangerouslySetInnerHTML={{ __html: d.definition }}
                  />
                </div>
              ))}

              {definitions.data && !definitions.data.length && (
                <div className="notice">
                  <span>
                    {data.data.hasDictionary
                      ? 'Nenhum dicionário instalado traz este verbete.'
                      : 'Você ainda não importou um dicionário, então só o código aparece. '}
                    {!data.data.hasDictionary && (
                      <Link to="/config" onClick={onClose} style={{ fontWeight: 600 }}>
                        Importar um dicionário
                      </Link>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
