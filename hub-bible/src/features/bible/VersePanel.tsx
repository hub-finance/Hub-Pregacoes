import { useEffect } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { StrongContent } from './StrongSheet';
import { CommentaryContent } from './CommentarySheet';
import { CrossRefContent } from './CrossRefSheet';

export type VersePanelTab = 'strong' | 'commentary' | 'crossref';

interface Props {
  verse: number;
  translation: string;
  book: string;
  chapter: number;
  reference: string;
  hasStrong: boolean;
  tab: VersePanelTab;
  onTabChange: (tab: VersePanelTab) => void;
  onClose: () => void;
  onNavigate: () => void;
  initialWord?: number | null;
}

export function VersePanel({
  verse, translation, book, chapter, reference,
  hasStrong, tab, onTabChange, onClose, onNavigate, initialWord,
}: Props) {
  useEffect(() => {
    if (tab === 'strong' && !hasStrong) onTabChange('commentary');
  }, [tab, hasStrong, onTabChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeTab = tab === 'strong' && !hasStrong ? 'commentary' : tab;

  const tabs: { id: VersePanelTab; label: string; icon: IconName }[] = [
    ...(hasStrong ? [{ id: 'strong' as const, label: 'Original', icon: 'search' as const }] : []),
    { id: 'commentary', label: 'Comentários', icon: 'book' },
    { id: 'crossref', label: 'Referências', icon: 'link' },
  ];

  return (
    <aside className="side-panel" role="complementary" aria-label={reference}>
      <header className="side-panel-head">
        <h2 className="side-panel-title truncate">{reference}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar painel">
          <Icon name="close" />
        </button>
      </header>

      <nav className="verse-panel-tabs" aria-label="Recursos do versículo">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`verse-panel-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => onTabChange(t.id)}
            aria-selected={activeTab === t.id}
            role="tab"
          >
            <Icon name={t.icon} size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="side-panel-body">
        {activeTab === 'strong' && hasStrong && (
          <StrongContent
            translation={translation}
            book={book}
            chapter={chapter}
            verse={verse}
            onNavigate={onNavigate}
            initialWord={initialWord}
          />
        )}
        {activeTab === 'commentary' && (
          <CommentaryContent
            book={book}
            chapter={chapter}
            verse={verse}
          />
        )}
        {activeTab === 'crossref' && (
          <CrossRefContent
            book={book}
            chapter={chapter}
            verse={verse}
            translation={translation}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </aside>
  );
}
