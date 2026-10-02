import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

interface SidePanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({ open, title, onClose, children }: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside className="side-panel" role="complementary" aria-label={title}>
      <header className="side-panel-head">
        <h2 className="side-panel-title truncate">{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar painel">
          <Icon name="close" />
        </button>
      </header>
      <div className="side-panel-body">{children}</div>
    </aside>
  );
}
