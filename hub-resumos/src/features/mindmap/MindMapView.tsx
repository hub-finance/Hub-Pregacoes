import { useEffect, useRef, useState } from 'react';
import type { MindMapData } from '../../core/mindmap';
import { createMindMap, type MindHitType, type MindMapHandle, type MindNode } from './engine.js';

/**
 * Onde o mapa pode ficar sem nada por cima. Tela larga: título no alto,
 * botões à direita e, com um assunto aberto, o painel de texto à esquerda.
 * Celular: título no alto, botões embaixo e o painel de texto no alto.
 */
export function mindInsets(focused: boolean, w: number) {
  if (w > 720) return focused ? { t: 90, r: 170, b: 20, l: 410 } : { t: 90, r: 170, b: 20, l: 20 };
  return focused ? { t: 230, r: 10, b: 120, l: 10 } : { t: 80, r: 10, b: 120, l: 10 };
}

interface Hover {
  node: MindNode;
  x: number;
  y: number;
}

/**
 * O mapa mental na tela: o desenho em canvas e, por cima, o título, os
 * controles, a legenda e o texto completo do que foi tocado.
 */
export function MindMapView({ data, onReady }: { data: MindMapData; onReady?: (map: MindMapHandle | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const map = useRef<MindMapHandle | null>(null);
  const [all, setAll] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [picked, setPicked] = useState<{ node: MindNode; type: MindHitType } | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    // o motor grava posições nos objetos: recebe uma cópia, os dados ficam limpos
    const copy = JSON.parse(JSON.stringify(data)) as MindMapData;
    const canHover = window.matchMedia('(hover: hover)').matches;
    const m = createMindMap(canvas.current, copy, {
      onSelect: (node, type) =>
        // tocar de novo no assunto aberto fecha o assunto e o painel
        setPicked((prev) => (type === 'module' && prev?.type === 'module' && prev.node.id === node.id ? null : { node, type })),
      onHover: canHover ? (node, x, y) => setHover(node ? { node, x, y } : null) : undefined,
      insets: mindInsets,
    });
    map.current = m;
    setAll(false);
    setPicked(null);
    onReady?.(m);
    return () => {
      m.destroy();
      map.current = null;
      onReady?.(null);
    };
  }, [data, onReady]);

  useEffect(() => {
    const onChange = () => {
      setFull(document.fullscreenElement === box.current);
      // espera o novo tamanho antes de reenquadrar
      requestAnimationFrame(() => map.current?.reset());
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.current?.requestFullscreen?.();
  };

  const tipStyle = (() => {
    if (!hover || !box.current) return undefined;
    const r = box.current.getBoundingClientRect();
    const left = Math.min(hover.x - r.left + 16, r.width - 340);
    const top = Math.min(hover.y - r.top + 16, r.height - 160);
    return { left: Math.max(8, left), top: Math.max(8, top) };
  })();

  const openId = picked?.type === 'module' ? picked.node.id : undefined;

  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
    <div className="chip-row" role="toolbar" aria-label="Assuntos do mapa">
      {data.modules.map((m) => (
        <button
          key={m.id}
          className={`chip${openId === m.id ? ' active' : ''}`}
          aria-pressed={openId === m.id}
          onClick={() => map.current?.open(m.id)}
        >
          <span className="chip-dot" style={{ background: m.color }} />
          {String(m.id).padStart(2, '0')} · {m.tip.title}
        </button>
      ))}
    </div>
    <div className={`xr-mm${full ? ' is-full' : ''}`} ref={box}>
      <canvas ref={canvas} className="xr-mm-canvas" role="img" aria-label={`Mapa mental de ${data.title}. A lista completa está abaixo do mapa.`} />

      <div className="xr-mm-badge">
        <strong>{data.title}</strong>
        <span>{data.subtitle}</span>
      </div>

      <div className="xr-mm-controls">
        <button className="xr-mm-btn" onClick={toggleFull}>
          ⛶ {full ? 'Sair da tela cheia' : 'Tela cheia'}
        </button>
        <button className="xr-mm-btn" onClick={() => map.current?.reset()}>
          ⟲ Resetar
        </button>
        <button className="xr-mm-btn" onClick={() => map.current?.zoom(1.2)} aria-label="Aproximar">
          ＋ Zoom
        </button>
        <button className="xr-mm-btn" onClick={() => map.current?.zoom(0.8)} aria-label="Afastar">
          － Zoom
        </button>
        <button className="xr-mm-btn" onClick={() => map.current && setAll(map.current.toggleAll())}>
          {all ? '⊟ Recolher tudo' : '⊞ Expandir tudo'}
        </button>
      </div>

      <div className="xr-mm-legend" hidden={!!picked}>
        <h4>LEGENDA</h4>
        {data.legend.map((l) => (
          <div key={l.label} className="xr-mm-li">
            <span className="xr-mm-dot" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
        <div className="xr-mm-hint">Arraste · role ou use os dedos para zoom · toque para abrir</div>
      </div>

      {hover && !picked && (
        <div className="xr-mm-tip" style={tipStyle}>
          <h3>{hover.node.tip.title}</h3>
          <p>{hover.node.tip.body}</p>
          {hover.node.tip.source && <div className="xr-mm-src">{hover.node.tip.source}</div>}
        </div>
      )}

      {picked && (
        <div className="xr-mm-tip is-panel" role="dialog" aria-live="polite" aria-label={picked.node.tip.title}>
          <button className="xr-mm-close" onClick={() => setPicked(null)} aria-label="Fechar">
            ×
          </button>
          <h3>{picked.node.tip.title}</h3>
          <p>{picked.node.tip.body}</p>
          {picked.node.tip.source && <div className="xr-mm-src">{picked.node.tip.source}</div>}
        </div>
      )}
    </div>
    </div>
  );
}
