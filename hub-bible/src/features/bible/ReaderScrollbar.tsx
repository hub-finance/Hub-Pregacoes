import { useEffect, useRef, useState } from 'react';

/**
 * Barra de rolagem discreta do leitor, no estilo dos aplicativos de leitura:
 * fica invisível durante a leitura, aparece ao rolar e some sozinha.
 * Arrastar o indicador move a página.
 */
export function ReaderScrollbar() {
  const [ratio, setRatio] = useState(0);
  const [thumb, setThumb] = useState(0.2);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<number>();

  useEffect(() => {
    const measure = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 40) {
        setVisible(false);
        setThumb(1);
        return;
      }
      setRatio(Math.min(1, Math.max(0, doc.scrollTop / scrollable)));
      setThumb(Math.max(0.08, doc.clientHeight / doc.scrollHeight));
    };

    const onScroll = () => {
      measure();
      setVisible(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setVisible(false), 1200);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      observer.disconnect();
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // arrastar o indicador
  useEffect(() => {
    if (!dragging) return;
    const move = (clientY: number) => {
      const doc = document.documentElement;
      const track = doc.clientHeight;
      const fraction = Math.min(1, Math.max(0, clientY / track));
      window.scrollTo({ top: fraction * (doc.scrollHeight - doc.clientHeight) });
    };
    const onMouse = (e: MouseEvent) => move(e.clientY);
    const onTouch = (e: TouchEvent) => move(e.touches[0].clientY);
    const stop = () => setDragging(false);

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchend', stop);
    };
  }, [dragging]);

  const thumbHeight = `${Math.round(thumb * 100)}%`;
  const thumbTop = `${ratio * (100 - thumb * 100)}%`;

  return (
    <div className={`reader-scrollbar${visible || dragging ? ' visible' : ''}`} aria-hidden="true">
      <div
        className="reader-scrollbar-thumb"
        style={{ height: thumbHeight, top: thumbTop }}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onTouchStart={() => setDragging(true)}
      />
    </div>
  );
}

/** Fração já lida da página (0 a 1) — alimenta a linha de progresso do capítulo. */
export function useReadingProgress(): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      // capítulo que cabe na tela ainda não foi percorrido: progresso zero,
      // não cheio — senão a linha nasceria completa ao abrir o texto
      setProgress(scrollable <= 0 ? 0 : Math.min(1, Math.max(0, doc.scrollTop / scrollable)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // o capítulo chega depois da primeira medição: reavalia quando a altura muda
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);
  return progress;
}
