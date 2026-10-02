import { Sheet } from '../../components/Sheet';
import { SidePanel } from '../../components/SidePanel';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { lookupCommentary } from '../../core/data/commentaries';
import { OSIS_TO_MYBIBLE_NUMBER } from '../../core/bible/mybible';

/* ─── conteúdo reutilizável (VersePanel e CommentarySheet) ─── */

interface CommentaryContentProps {
  book: string;
  chapter: number;
  verse: number;
}

export function CommentaryContent({ book, chapter, verse }: CommentaryContentProps) {
  const bookNumber = OSIS_TO_MYBIBLE_NUMBER.get(book) ?? 0;

  const data = useAsync(
    () => (bookNumber ? lookupCommentary(bookNumber, chapter, verse) : Promise.resolve([])),
    [bookNumber, chapter, verse],
  );

  return (
    <>
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
    </>
  );
}

/* ─── wrapper para mobile (Sheet flutuante) ─── */

interface Props {
  open: boolean;
  onClose: () => void;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  inline?: boolean;
}

export function CommentarySheet({ open, onClose, book, chapter, verse, reference, inline }: Props) {
  const panelTitle = `${reference} — comentários`;

  const content = open ? (
    <CommentaryContent book={book} chapter={chapter} verse={verse} />
  ) : null;

  if (inline) {
    return (
      <SidePanel open={open} title={panelTitle} onClose={onClose}>
        {content}
      </SidePanel>
    );
  }

  return (
    <Sheet open={open} title={panelTitle} onClose={onClose} size="lg">
      {content}
    </Sheet>
  );
}
