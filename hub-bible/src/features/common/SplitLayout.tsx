import { useCallback, useRef, type ReactNode } from 'react';
import { useSettings } from '../../core/settings/SettingsContext';

interface Props {
  /** Tela dividida ligada. Desligada, só o conteúdo principal ocupa a área. */
  divided: boolean;
  /** Painel da esquerda — a Bíblia. */
  left: ReactNode;
  children: ReactNode;
}

/* Até onde a linha pode ir. Larga o bastante para deixar a apostila quase
   sozinha na tela, ou a Bíblia — quem ensina alterna entre as duas coisas. */
const MIN = 15;
const MAX = 85;

/**
 * Tela dividida com a linha do meio arrastável.
 *
 * Quem prega ou ensina sabe quanto quer de cada lado, e isso muda conforme o
 * material: uma apostila de letra miúda pede mais espaço, uma leitura corrida
 * pede menos. A posição fica gravada nas preferências, então o ajuste é feito
 * uma vez e vale para as próximas vezes.
 *
 * A divisão em colunas só existe a partir de 600px (ver `reader.css`); no
 * celular as duas áreas se empilham e a alça some.
 */
export function SplitLayout({ divided, left, children }: Props) {
  const { settings, update } = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const ratio = useRef(settings.splitRatio);

  /** Escreve direto no DOM enquanto arrasta: re-renderizar a cada pixel
      redesenharia o PDF do lado direito e travaria o movimento. */
  const apply = useCallback((value: number) => {
    const next = Math.min(MAX, Math.max(MIN, value));
    ratio.current = next;
    ref.current?.style.setProperty('--split-a', String(next));
  }, []);

  const fromPointer = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    apply(((clientX - box.left) / box.width) * 100);
  };

  return (
    <div
      ref={ref}
      className={`preach-split${divided ? ' divided' : ''}`}
      style={{ '--split-a': settings.splitRatio } as React.CSSProperties}
    >
      {divided && left}
      {divided && (
        <div
          className="split-handle"
          role="separator"
          aria-label="Ajustar a divisão da tela"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            fromPointer(e.clientX);
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            update({ splitRatio: Math.round(ratio.current) });
          }}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowLeft' ? -3 : e.key === 'ArrowRight' ? 3 : 0;
            if (!step) return;
            e.preventDefault();
            apply(ratio.current + step);
            update({ splitRatio: Math.round(ratio.current) });
          }}
        >
          <span className="split-handle-grip" aria-hidden="true" />
        </div>
      )}
      {children}
    </div>
  );
}
