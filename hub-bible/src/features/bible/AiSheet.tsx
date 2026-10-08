import { Sheet } from '../../components/Sheet';
import { AiContent } from './AiContent';

interface Props {
  open: boolean;
  onClose: () => void;
  book: string;
  chapter: number;
  verse?: number;
  reference: string;
  passage: string;
  translation: string;
  onNavigate: () => void;
  chapterMode?: boolean;
}

export function AiSheet({
  open, onClose, book, chapter, verse, reference, passage, translation, onNavigate, chapterMode,
}: Props) {
  return (
    <Sheet open={open} title={`Análise — ${reference}`} onClose={onClose}>
      <AiContent
        book={book}
        chapter={chapter}
        verse={verse}
        reference={reference}
        passage={passage}
        translation={translation}
        onNavigate={onNavigate}
        chapterMode={chapterMode}
      />
    </Sheet>
  );
}
