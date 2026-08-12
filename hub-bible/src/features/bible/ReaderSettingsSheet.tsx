import { Sheet } from '../../components/Sheet';
import { RangeInput, SelectInput } from '../../components/ui';
import { useSettings, type ThemeChoice } from '../../core/settings/SettingsContext';

/** Ajustes de leitura (seção 6): fonte, espaçamento, largura, tema e layout. */
export function ReaderSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();

  const themes: Array<{ id: ThemeChoice; label: string; icon: string }> = [
    { id: 'light', label: 'Claro', icon: '☀️' },
    { id: 'sepia', label: 'Sépia', icon: '📜' },
    { id: 'dark', label: 'Escuro', icon: '🌙' },
    { id: 'system', label: 'Sistema', icon: '🖥️' },
  ];

  return (
    <Sheet open={open} title="Leitura" onClose={onClose}>
      <div>
        <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
          Tema
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)' }}>
          {themes.map((t) => (
            <button
              key={t.id}
              className={`quick${settings.theme === t.id ? ' active' : ''}`}
              style={{
                minHeight: 74,
                borderColor: settings.theme === t.id ? 'var(--accent)' : undefined,
                background: settings.theme === t.id ? 'var(--accent-soft)' : undefined,
              }}
              onClick={() => update({ theme: t.id })}
            >
              <span className="ico" aria-hidden="true">
                {t.icon}
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <RangeInput
        label="Tamanho da fonte"
        value={Math.round(settings.fontScale * 100)}
        min={80}
        max={190}
        step={5}
        suffix="%"
        onChange={(v) => update({ fontScale: v / 100 })}
      />
      <RangeInput
        label="Espaçamento entre linhas"
        value={settings.leading}
        min={1.4}
        max={2.4}
        step={0.05}
        onChange={(v) => update({ leading: v })}
      />
      <RangeInput
        label="Largura do texto"
        value={settings.measure}
        min={28}
        max={62}
        step={1}
        suffix="rem"
        onChange={(v) => update({ measure: v })}
      />

      <SelectInput
        label="Tipo de letra"
        value={settings.readerFont}
        onChange={(v) => update({ readerFont: v as 'serif' | 'sans' })}
        options={[
          { value: 'serif', label: 'Serifada (leitura clássica)' },
          { value: 'sans', label: 'Sem serifa (moderna)' },
        ]}
      />
      <SelectInput
        label="Disposição dos versículos"
        value={settings.verseLayout}
        onChange={(v) => update({ verseLayout: v as 'paragraph' | 'lines' })}
        options={[
          { value: 'paragraph', label: 'Texto corrido (parágrafo)' },
          { value: 'lines', label: 'Um versículo por linha' },
        ]}
      />
      <SelectInput
        label="Contraste"
        value={settings.contrast}
        onChange={(v) => update({ contrast: v as 'normal' | 'high' })}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'Alto contraste' },
        ]}
      />
    </Sheet>
  );
}
