import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getCrossReferences, findEntriesForVerse, findTypologyForVerse } from '../../core/bible/reference-data';
import type { TypologyPair } from '../../core/bible/reference-data';
import { CANON_BY_OSIS } from '../../core/bible/canon';

interface Props {
  open: boolean;
  onClose: () => void;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
}

function formatRef(key: string): { label: string; path: string } {
  const [b, c, v] = key.split('.');
  const canon = CANON_BY_OSIS.get(b);
  const name = canon?.abbrev ?? b;
  return {
    label: `${name} ${c}:${v}`,
    path: `/biblia/${b}/${c}?v=${v}`,
  };
}

function TypologyCard({ pair, onClose }: { pair: TypologyPair; onClose: () => void }) {
  return (
    <div className="card stack" style={{ gap: 'var(--sp-2)' }}>
      <strong style={{ fontSize: '1.05rem' }}>{pair.titulo}</strong>
      <p className="small strong-definition">{pair.explicacao}</p>
      <div className="row" style={{ gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <h4 className="list-meta" style={{ marginBottom: 'var(--sp-1)' }}>Antigo Testamento</h4>
          <p className="small dim" style={{ marginBottom: 'var(--sp-1)' }}>{pair.at.nome}</p>
          <div className="crossref-list">
            {pair.at.textos.map((r) => {
              const { label, path } = formatRef(r);
              return (
                <Link key={r} to={path} className="crossref-chip" onClick={onClose}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <h4 className="list-meta" style={{ marginBottom: 'var(--sp-1)' }}>Novo Testamento</h4>
          <p className="small dim" style={{ marginBottom: 'var(--sp-1)' }}>{pair.nt.nome}</p>
          <div className="crossref-list">
            {pair.nt.textos.map((r) => {
              const { label, path } = formatRef(r);
              return (
                <Link key={r} to={path} className="crossref-chip" onClick={onClose}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrossRefSheet({ open, onClose, book, chapter, verse, reference }: Props) {
  const data = useAsync(async () => {
    const [refs, entries, typology] = await Promise.all([
      getCrossReferences(book, chapter, verse),
      findEntriesForVerse(book, chapter, verse),
      findTypologyForVerse(book, chapter, verse),
    ]);
    return { refs, entries, typology };
  }, [book, chapter, verse, open]);

  const grouped = useMemo(() => {
    if (!data.data?.refs.length) return null;
    const at: string[] = [];
    const nt: string[] = [];
    for (const ref of data.data.refs) {
      const b = ref.split('.')[0];
      const canon = CANON_BY_OSIS.get(b);
      if (canon?.testament === 'AT') at.push(ref);
      else nt.push(ref);
    }
    return { at, nt };
  }, [data.data]);

  const empty = data.data && !data.data.refs.length && !data.data.entries.length && !data.data.typology.length;

  return (
    <Sheet open={open} title={`${reference} — referências`} onClose={onClose} size="lg">
      {data.loading && <Spinner />}

      {empty && (
        <p className="dim">Este versículo não tem referências cruzadas no acervo.</p>
      )}

      {grouped && (
        <div className="stack" style={{ gap: 'var(--sp-3)' }}>
          <p className="small dim">
            <Icon name="link" size={14} style={{ verticalAlign: '-2px' }} />{' '}
            {data.data!.refs.length} referência{data.data!.refs.length > 1 ? 's' : ''} cruzada{data.data!.refs.length > 1 ? 's' : ''}
          </p>

          {grouped.at.length > 0 && (
            <div>
              <h4 className="list-meta" style={{ marginBottom: 'var(--sp-1)' }}>Antigo Testamento</h4>
              <div className="crossref-list">
                {grouped.at.map((r) => {
                  const { label, path } = formatRef(r);
                  return (
                    <Link key={r} to={path} className="crossref-chip" onClick={onClose}>
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {grouped.nt.length > 0 && (
            <div>
              <h4 className="list-meta" style={{ marginBottom: 'var(--sp-1)' }}>Novo Testamento</h4>
              <div className="crossref-list">
                {grouped.nt.map((r) => {
                  const { label, path } = formatRef(r);
                  return (
                    <Link key={r} to={path} className="crossref-chip" onClick={onClose}>
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {data.data?.entries.length ? (
        <div className="stack" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <p className="small dim">
            <Icon name="dictionary" size={14} style={{ verticalAlign: '-2px' }} />{' '}
            Conceitos teológicos neste versículo
          </p>
          {data.data.entries.map((entry) => (
            <div key={entry.id} className="card stack" style={{ gap: 'var(--sp-1)' }}>
              <div className="row" style={{ gap: 'var(--sp-2)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '1.05rem' }}>{entry.termo}</strong>
                {entry.grego && (
                  <span className="small dim" style={{ fontStyle: 'italic' }}>
                    {entry.grego.palavra} ({entry.grego.translit})
                  </span>
                )}
                {entry.hebraico && !entry.grego && (
                  <span className="small dim" style={{ fontStyle: 'italic' }}>
                    {entry.hebraico.palavra} ({entry.hebraico.translit})
                  </span>
                )}
              </div>
              <p className="strong-definition">{entry.definicao}</p>
              {entry.distincao && (
                <p className="small" style={{ color: 'var(--accent-strong)' }}>
                  {entry.distincao}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {data.data?.typology.length ? (
        <div className="stack" style={{ gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <p className="small dim">
            <Icon name="layers" size={14} style={{ verticalAlign: '-2px' }} />{' '}
            Tipologia — Antigo e Novo Testamento
          </p>
          {data.data.typology.map((pair) => (
            <TypologyCard key={pair.id} pair={pair} onClose={onClose} />
          ))}
        </div>
      ) : null}
    </Sheet>
  );
}
