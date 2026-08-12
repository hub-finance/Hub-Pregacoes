import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import type { TranslationInfo } from '../../core/db/types';

interface Props {
  open: boolean;
  translations: TranslationInfo[];
  current: string;
  compare: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCompare: (id: string | null) => void;
}

/**
 * Seleção de tradução. Traduções protegidas por direitos autorais aparecem
 * listadas, mas só ficam disponíveis depois que o usuário instala uma cópia
 * licenciada em Configurações › Traduções.
 */
export function TranslationPicker({
  open,
  translations,
  current,
  compare,
  onClose,
  onSelect,
  onCompare,
}: Props) {
  const available = translations.filter((t) => t.bundled || t.imported);
  const licensed = translations.filter((t) => !t.bundled && !t.imported);

  return (
    <Sheet open={open} title="Tradução" onClose={onClose}>
      <div className="list">
        {available.map((t) => (
          <button
            key={t.id}
            className="list-item"
            onClick={() => {
              onSelect(t.id);
              onClose();
            }}
          >
            <span className="badge">{t.abbrev}</span>
            <span className="list-body">
              <span className="list-title">{t.name}</span>
              <span className="list-meta">
                {t.languageLabel} · {t.license}
                {t.imported ? ' · importada' : ''}
              </span>
            </span>
            {current === t.id && <Icon name="check" size={18} style={{ color: 'var(--accent-strong)' }} />}
          </button>
        ))}
      </div>

      <div>
        <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
          Comparar com
        </p>
        <div className="chip-row">
          <button className={`chip${compare ? '' : ' active'}`} onClick={() => onCompare(null)}>
            Desligado
          </button>
          {available
            .filter((t) => t.id !== current)
            .map((t) => (
              <button
                key={t.id}
                className={`chip${compare === t.id ? ' active' : ''}`}
                onClick={() => onCompare(t.id)}
              >
                {t.abbrev}
              </button>
            ))}
        </div>
      </div>

      {licensed.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
            Requer licença
          </p>
          <div className="list">
            {licensed.map((t) => (
              <div key={t.id} className="list-item" style={{ opacity: 0.75 }}>
                <span className="badge">{t.abbrev}</span>
                <span className="list-body">
                  <span className="list-title">{t.name}</span>
                  <span className="list-meta">{t.publisher}</span>
                </span>
                <Icon name="lock" size={17} className="dim" />
              </div>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 'var(--sp-2)' }}>
            Estas traduções são protegidas por direitos autorais e não acompanham o aplicativo.{' '}
            <Link to="/config" onClick={onClose} style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>
              Instalar uma cópia licenciada
            </Link>
            .
          </p>
        </div>
      )}
    </Sheet>
  );
}
