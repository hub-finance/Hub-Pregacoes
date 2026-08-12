import { Sheet } from '../../components/Sheet';
import { Icon, type IconName } from '../../components/Icon';
import { RangeInput, SelectInput } from '../../components/ui';
import { MEASURE_PRESETS, useSettings, type ThemeChoice } from '../../core/settings/SettingsContext';

/** Ajustes de leitura (seção 6): fonte, espaçamento, largura, tema e layout. */
export function ReaderSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();

  const themes: Array<{ id: ThemeChoice; label: string; icon: IconName }> = [
    { id: 'light', label: 'Claro', icon: 'sun' as const },
    { id: 'sepia', label: 'Sépia', icon: 'sepia' as const },
    { id: 'dark', label: 'Escuro', icon: 'moon' as const },
    { id: 'system', label: 'Sistema', icon: 'settings' as const },
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
              <span className="ico">
                <Icon name={t.icon} size={22} />
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
      <div className="field">
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)' }}>
          Largura do texto
        </span>
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
          {MEASURE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`chip${settings.measure === preset.value ? ' active' : ''}`}
              onClick={() => update({ measure: preset.value })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <RangeInput
        label="Ajuste fino da largura"
        value={settings.measure}
        min={28}
        max={100}
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
        label="Alinhamento do texto"
        value={settings.textAlign}
        onChange={(v) => update({ textAlign: v as 'left' | 'justify' })}
        options={[
          { value: 'left', label: 'À esquerda (margem irregular)' },
          { value: 'justify', label: 'Justificado' },
        ]}
      />
      <SelectInput
        label="Capitular do capítulo"
        value={settings.dropCap ? 'on' : 'off'}
        onChange={(v) => update({ dropCap: v === 'on' })}
        options={[
          { value: 'on', label: 'Número grande abrindo o texto' },
          { value: 'off', label: 'Sem capitular' },
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
