import { Sheet } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { lookupCommentary } from '../../core/data/commentaries';
import { OSIS_TO_MYBIBLE_NUMBER } from '../../core/bible/mybible';

interface Props {
  open: boolean;
  onClose: () => void;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
}

export function CommentarySheet({ open, onClose, book, chapter, verse, reference }: Props) {
  const bookNumber = OSIS_TO_MYBIBLE_NUMBER.get(book) ?? 0;

  const data = useAsync(
    () => (open && bookNumber ? lookupCommentary(bookNumber, chapter, verse) : Promise.resolve([])),
    [bookNumber, chapter, verse, open],
  );

  return (
    <Sheet open={open} title={`${reference} — comentários`} onClose={onClose} size="lg">
      {data.loading && <Spinner />}

      {data.data && !data.data.length && !data.loading && (
        <p className="dim">Nenhum comentário para este versículo nos módulos instalados.</p>
      )}

      {data.data && data.data.length > 0 && (
        <div className="stack" style={{ gap: 'var(--sp-4)' }}>
          {data.data.map((match, i) => (
            <div key={i} className="card stack" style={{ gap: 'var(--sp-2)' }}>
              <div className="row" style={{ gap: 'var(--sp-2)', alignItems: 'center' }}>
                <Icon name="book" size={16} />
                <strong style={{ fontSize: '0.92rem' }}>{match.commentaryName}</strong>
                {match.isFootnotes && (
                  <span className="badge" style={{ fontSize: '0.7rem' }}>nota de rodapé</span>
                )}
              </div>
              {(match.verseFrom !== match.verseTo || match.verseFrom !== verse) && (
                <span className="small dim">
                  v. {match.verseFrom}
                  {match.verseTo !== match.verseFrom ? `–${match.verseTo}` : ''}
                </span>
              )}
              <div
                className="strong-definition"
                dangerouslySetInnerHTML={{ __html: match.text }}
              />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
