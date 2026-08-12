import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../core/settings/SettingsContext';

/** Durações alvo mais usadas em uma mensagem. */
export const PRESET_MINUTES = [30, 40, 45, 50] as const;

const pad = (n: number) => String(n).padStart(2, '0');

function formatClock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Cronômetro da mensagem, exibido acima do conteúdo no Modo Pregação.
 *
 * Estados visuais, legíveis de relance no púlpito:
 *   normal  — dentro do tempo
 *   atenção — faltam 5 minutos ou menos
 *   acima   — passou do tempo; mostra quanto passou, com sinal de mais
 */
export function SermonTimer() {
  const { settings, update } = useSettings();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const startedAt = useRef<number | null>(null);
  const accumulated = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const base = startedAt.current ? Date.now() - startedAt.current : 0;
      setElapsed(accumulated.current + base);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      accumulated.current += startedAt.current ? Date.now() - startedAt.current : 0;
      startedAt.current = null;
      setRunning(false);
    } else {
      startedAt.current = Date.now();
      setRunning(true);
    }
  };

  const reset = () => {
    accumulated.current = 0;
    startedAt.current = running ? Date.now() : null;
    setElapsed(0);
  };

  const limitMs = settings.preachingMinutes ? settings.preachingMinutes * 60_000 : null;
  const remaining = limitMs === null ? null : limitMs - elapsed;
  const over = remaining !== null && remaining < 0;
  const warning = remaining !== null && remaining >= 0 && remaining <= 5 * 60_000;

  const state = over ? 'over' : warning ? 'warn' : 'ok';
  const progress = limitMs ? Math.min(1, elapsed / limitMs) : 0;

  return (
    <div className={`preach-timer ${state}`}>
      <button
        className="preach-timer-clock"
        onClick={toggle}
        aria-label={running ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
        title={running ? 'Pausar' : 'Iniciar'}
      >
        <span aria-hidden="true">{running ? '⏸' : '▶'}</span>
        <span className="mono-num">{formatClock(elapsed)}</span>
      </button>

      {limitMs !== null && (
        <span className="preach-timer-target mono-num">
          {over ? `+${formatClock(-remaining!)} acima` : `restam ${formatClock(remaining!)}`}
        </span>
      )}
      {limitMs === null && <span className="preach-timer-target">tempo livre</span>}

      <div className="spacer" />

      <button
        className="preach-timer-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Escolher duração"
      >
        {settings.preachingMinutes ? `${settings.preachingMinutes} min` : 'livre'} ▾
      </button>
      <button className="preach-timer-btn" onClick={reset} aria-label="Zerar cronômetro">
        ↺
      </button>

      {limitMs !== null && (
        <div className="preach-timer-bar" aria-hidden="true">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {open && (
        <div className="preach-timer-menu" role="menu">
          {PRESET_MINUTES.map((minutes) => (
            <button
              key={minutes}
              role="menuitem"
              className={`preach-timer-option${settings.preachingMinutes === minutes ? ' active' : ''}`}
              onClick={() => {
                update({ preachingMinutes: minutes });
                setOpen(false);
              }}
            >
              {minutes} min
            </button>
          ))}
          <button
            role="menuitem"
            className={`preach-timer-option${settings.preachingMinutes === null ? ' active' : ''}`}
            onClick={() => {
              update({ preachingMinutes: null });
              setOpen(false);
            }}
          >
            Tempo livre
          </button>
        </div>
      )}
    </div>
  );
}
