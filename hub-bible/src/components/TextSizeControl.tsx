import { useSettings } from '../core/settings/SettingsContext';

const MIN = 0.85;
const MAX = 1.6;
const STEP = 0.05;

/**
 * A− / A+ do tamanho da letra do Assistente bíblico e da aba Estudar — o
 * mesmo valor nas duas telas, guardado no aparelho e separado do tamanho da
 * Bíblia. Não mexe no PDF nem no Word.
 */
export function TextSizeControl() {
  const { settings, update } = useSettings();
  const scale = settings.assistantScale ?? 1;
  const set = (v: number) => update({ assistantScale: Math.round(Math.min(MAX, Math.max(MIN, v)) * 100) / 100 });
  const pct = Math.round(scale * 100);
  return (
    <div className="text-size" role="group" aria-label="Tamanho da letra">
      <span className="text-size-label">Tamanho</span>
      <button
        type="button"
        className="btn btn-sm text-size-btn"
        onClick={() => set(scale - STEP)}
        disabled={scale <= MIN + 0.001}
        aria-label="Diminuir a letra"
      >
        A−
      </button>
      <button
        type="button"
        className="text-size-value"
        onClick={() => set(1)}
        aria-label={`Tamanho ${pct}%. Tocar volta para 100%`}
        title="Voltar para 100%"
      >
        {pct}%
      </button>
      <button
        type="button"
        className="btn btn-sm text-size-btn"
        onClick={() => set(scale + STEP)}
        disabled={scale >= MAX - 0.001}
        aria-label="Aumentar a letra"
      >
        A+
      </button>
    </div>
  );
}
