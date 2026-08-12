import { useSettings } from '../../core/settings/SettingsContext';
import { Icon, type IconName } from '../../components/Icon';

export interface VerseAction {
  id: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
}

/** Barra flutuante com as ações do(s) versículo(s) selecionado(s). */
export function VerseActionBar({
  reference,
  actions,
  onClear,
  highlightOpen,
  onPickHighlight,
}: {
  reference: string;
  actions: VerseAction[];
  onClear: () => void;
  highlightOpen: boolean;
  onPickHighlight: (categoryId: string | null) => void;
}) {
  const { categories } = useSettings();

  if (highlightOpen) {
    return (
      <div className="verse-actions" role="toolbar" aria-label="Escolher categoria de marcação">
        <button className="verse-action" onClick={() => onPickHighlight(null)}>
          <span className="ico">
            <Icon name="close" size={19} />
          </span>
          <span>Remover</span>
        </button>
        {categories.map((c) => (
          <button key={c.id} className="verse-action" onClick={() => onPickHighlight(c.id)}>
            <span
              className="chip-dot"
              style={{ background: c.color, width: 18, height: 18 }}
              aria-hidden="true"
            />
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="verse-actions" role="toolbar" aria-label={`Ações para ${reference}`}>
      <span
        className="small"
        style={{ padding: '0 var(--sp-2)', fontWeight: 650, color: 'var(--accent-strong)', whiteSpace: 'nowrap' }}
      >
        {reference}
      </span>
      {actions.map((a) => (
        <button key={a.id} className="verse-action" onClick={a.onClick}>
          <span className="ico">
            <Icon name={a.icon} size={19} />
          </span>
          <span>{a.label}</span>
        </button>
      ))}
      <button className="verse-action" onClick={onClear}>
        <span className="ico">
          <Icon name="close" size={19} />
        </span>
        <span>Fechar</span>
      </button>
    </div>
  );
}
