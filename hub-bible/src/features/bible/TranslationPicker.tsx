import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useTranslationImport } from './useTranslationImport';
import type { TranslationInfo } from '../../core/db/types';

interface Props {
  open: boolean;
  translations: TranslationInfo[];
  current: string;
  compare: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCompare: (id: string | null) => void;
  /** Recarrega o catálogo depois que uma tradução é importada aqui. */
  onImported?: () => void;
}

/**
 * Seleção de tradução.
 *
 * As traduções protegidas por direitos autorais não acompanham o aplicativo —
 * mas quem já tem uma cópia importa o arquivo aqui mesmo, sem sair da leitura,
 * e a partir daí ela se comporta como qualquer outra: aparece na lista, entra
 * na comparação e vale para a busca.
 */
export function TranslationPicker({
  open,
  translations,
  current,
  compare,
  onClose,
  onSelect,
  onCompare,
  onImported,
}: Props) {
  const available = translations.filter((t) => t.bundled || t.imported);
  const licensed = translations.filter((t) => !t.bundled && !t.imported);
  const { input, pick, busy } = useTranslationImport({
    catalog: translations,
    onImported: (info) => {
      onImported?.();
      // dicionário não é tradução: não há o que selecionar, a folha só recarrega
      if (!info) return;
      onSelect(info.id);
      onClose();
    },
  });

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
