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
  onPickHighlight,
}: {
  reference: string;
  actions: VerseAction[];
  onClear: () => void;
  onPickHighlight: (categoryId: string | null) => void;
}) {
  const { categories } = useSettings();

  return (
    <div className="verse-actions" role="toolbar" aria-label={`Ações para ${reference}`}>
      <button
        className="hl-dot hl-dot-clear"
        onClick={() => onPickHighlight(null)}
        title="Remover marcação"
        aria-label="Remover marcação"
      >
        <Icon name="close" size={12} />
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          className="hl-dot"
          onClick={() => onPickHighlight(c.id)}
          title={c.label}
          aria-label={`Marcar ${c.label}`}
          style={{ background: c.color }}
        />
      ))}
      <span className="verse-actions-sep" aria-hidden="true" />
      {actions.map((a) => (
        <button key={a.id} className="verse-action" onClick={a.onClick} title={a.label} aria-label={a.label}>
          <span className="ico">
            <Icon name={a.icon} size={20} />
          </span>
          <span className="action-label">{a.label}</span>
        </button>
      ))}
      <button className="verse-action" onClick={onClear} aria-label="Fechar">
        <span className="ico">
          <Icon name="close" size={19} />
        </span>
        <span className="action-label">Fechar</span>
      </button>
    </div>
  );
}
