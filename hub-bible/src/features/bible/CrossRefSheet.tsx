import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getCrossReferences } from '../../core/bible/reference-data';
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

export function CrossRefSheet({ open, onClose, book, chapter, verse, reference }: Props) {
  const data = useAsync(
    () => getCrossReferences(book, chapter, verse),
    [book, chapter, verse, open],
  );

  const refs = data.data ?? [];

  const grouped = useMemo(() => {
    if (!refs.length) return null;
    const at: string[] = [];
    const nt: string[] = [];
    for (const ref of refs) {
      const b = ref.split('.')[0];
      const canon = CANON_BY_OSIS.get(b);
      if (canon?.testament === 'AT') at.push(ref);
      else nt.push(ref);
    }
    return { at, nt };
  }, [refs]);

  const empty = data.data && !refs.length;

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
            {refs.length} referência{refs.length > 1 ? 's' : ''} cruzada{refs.length > 1 ? 's' : ''}
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

    </Sheet>
  );
}
