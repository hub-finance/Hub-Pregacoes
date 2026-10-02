import { useMemo } from 'react';
import { Sheet } from '../../components/Sheet';
import { SidePanel } from '../../components/SidePanel';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getCrossReferences } from '../../core/bible/reference-data';
import { getChapter } from '../../core/bible/repository';
import { CANON_BY_OSIS } from '../../core/bible/canon';

function formatRef(key: string): string {
  const [b, c, v] = key.split('.');
  const canon = CANON_BY_OSIS.get(b);
  const name = canon?.abbrev ?? b;
  return `${name} ${c}:${v}`;
}

/* ─── conteúdo reutilizável (VersePanel e CrossRefSheet) ─── */

interface CrossRefContentProps {
  book: string;
  chapter: number;
  verse: number;
  translation: string;
  onNavigate?: () => void;
}

export function CrossRefContent({ book, chapter, verse, translation }: CrossRefContentProps) {
  const data = useAsync(
    () => getCrossReferences(book, chapter, verse),
    [book, chapter, verse],
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

  const verseTexts = useAsync(
    async () => {
      if (!refs.length) return new Map<string, string>();
      const result = new Map<string, string>();
      const byChapter = new Map<string, { book: string; chapter: number; verses: { key: string; verse: number }[] }>();
      for (const ref of refs) {
        const [b, c, v] = ref.split('.');
        const ch = parseInt(c, 10);
        const vs = parseInt(v, 10);
        const chKey = `${b}.${c}`;
        if (!byChapter.has(chKey)) {
          byChapter.set(chKey, { book: b, chapter: ch, verses: [] });
        }
        byChapter.get(chKey)!.verses.push({ key: ref, verse: vs });
      }
      await Promise.all(
        [...byChapter.values()].map(async (group) => {
          try {
            const chapterText = await getChapter(translation, group.book, group.chapter);
            for (const { key, verse: v } of group.verses) {
              const text = chapterText[v - 1];
              if (text) result.set(key, text);
            }
          } catch { /* livro pode não existir nesta tradução */ }
        }),
      );
      return result;
    },
    [refs.join(','), translation],
  );

  const empty = data.data && !refs.length;

  const renderGroup = (title: string, items: string[]) => (
    <div>
      <h4 className="list-meta" style={{ marginBottom: 'var(--sp-2)' }}>{title}</h4>
      <div className="crossref-verses">
        {items.map((r) => {
          const label = formatRef(r);
          const text = verseTexts.data?.get(r);
          return (
            <div key={r} className="crossref-verse-card">
              <span className="crossref-verse-ref">
                <Icon name="link" size={13} />
                {label}
              </span>
              {text && <p className="crossref-verse-text">{text}</p>}
              {!text && verseTexts.loading && <span className="dim small">…</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
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

          {grouped.at.length > 0 && renderGroup('Antigo Testamento', grouped.at)}
          {grouped.nt.length > 0 && renderGroup('Novo Testamento', grouped.nt)}
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
  translation: string;
  inline?: boolean;
}

export function CrossRefSheet({ open, onClose, book, chapter, verse, reference, translation, inline }: Props) {
  const panelTitle = `${reference} — referências`;

  const content = open ? (
    <CrossRefContent book={book} chapter={chapter} verse={verse} translation={translation} onNavigate={onClose} />
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
