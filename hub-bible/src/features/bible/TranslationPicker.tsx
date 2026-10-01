import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useTranslationImport } from './useTranslationImport';
import type { TranslationInfo } from '../../core/db/types';

interface Props {
  open: boolean;
  translations: TranslationInfo[];
  current: string;
  compareTranslations: string[];
  compareLayout: 'stacked' | 'columns';
  onClose: () => void;
  onSelect: (id: string) => void;
  onCompareToggle: (id: string) => void;
  onCompareLayout: (layout: 'stacked' | 'columns') => void;
  onImported?: () => void;
}

export function TranslationPicker({
  open,
  translations,
  current,
  compareTranslations,
  compareLayout,
  onClose,
  onSelect,
  onCompareToggle,
  onCompareLayout,
  onImported,
}: Props) {
  const available = translations.filter((t) => t.bundled || t.imported);
  const licensed = translations.filter((t) => !t.bundled && !t.imported);
  const { input, pick, busy } = useTranslationImport({
    catalog: translations,
    onImported: (info) => {
      onImported?.();
      if (!info) return;
      onSelect(info.id);
      onClose();
    },
  });

  const comparables = available.filter((t) => t.id !== current);

  return (
    <Sheet open={open} title="Tradução" onClose={onClose}>
      {input}

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
                {t.hasStrong ? ' · números Strong' : ''}
              </span>
            </span>
            {current === t.id && <Icon name="check" size={18} style={{ color: 'var(--accent-strong)' }} />}
          </button>
        ))}
      </div>

      <div>
        <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
          Comparar com{compareTranslations.length > 0 ? ` (${compareTranslations.length})` : ''}
        </p>
        <div className="chip-row">
          {comparables.map((t) => (
            <button
              key={t.id}
              className={`chip${compareTranslations.includes(t.id) ? ' active' : ''}`}
              onClick={() => onCompareToggle(t.id)}
            >
              {t.abbrev}
            </button>
          ))}
        </div>
        {compareTranslations.length > 0 && (
          <div className="chip-row" style={{ marginTop: 'var(--sp-2)' }}>
            <button
              className={`chip${compareLayout === 'stacked' ? ' active' : ''}`}
              onClick={() => onCompareLayout('stacked')}
            >
              <Icon name="list" size={14} />
              <span>Empilhada</span>
            </button>
            <button
              className={`chip${compareLayout === 'columns' ? ' active' : ''}`}
              onClick={() => onCompareLayout('columns')}
            >
              <Icon name="columns" size={14} />
              <span>Colunas</span>
            </button>
          </div>
        )}
      </div>

      {licensed.length > 0 && (
        <div>
          <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
            Importar do seu arquivo
          </p>
          <div className="list">
            {licensed.map((t) => (
              <button
                key={t.id}
                className="list-item"
                disabled={!!busy}
                onClick={() => pick(t)}
              >
                <span className="badge">{t.abbrev}</span>
                <span className="list-body">
                  <span className="list-title">{t.name}</span>
                  <span className="list-meta">{t.publisher}</span>
                </span>
                <span className="small dim">{busy === t.id ? 'importando…' : 'Importar'}</span>
              </button>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 'var(--sp-2)' }}>
            Estas traduções são das editoras e não vêm com o aplicativo. Escolha o arquivo JSON da
            sua cópia: ele fica somente neste aparelho.
          </p>
        </div>
      )}
    </Sheet>
  );
}
