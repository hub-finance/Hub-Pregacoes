import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../components/Toast';
import { downloadBlob, safeName } from '../../core/backup';
import { sentences, type MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';

type Format = 'retrato' | 'quadrado';
type Palette = 'verde' | 'azul' | 'vinho' | 'grafite';

const SIZES: Record<Format, [number, number]> = { retrato: [1080, 1350], quadrado: [1080, 1080] };
const PALETTES: Record<Palette, { bg: string; ink: string; accent: string; soft: string; label: string }> = {
  verde: { bg: '#123d33', ink: '#ffffff', accent: '#9fe0c8', soft: 'rgba(255,255,255,0.10)', label: 'Verde' },
  azul: { bg: '#14284b', ink: '#ffffff', accent: '#e6c68f', soft: 'rgba(255,255,255,0.10)', label: 'Azul e dourado' },
  vinho: { bg: '#4a1620', ink: '#ffffff', accent: '#f2c4a0', soft: 'rgba(255,255,255,0.10)', label: 'Vinho' },
  grafite: { bg: '#f6f3ee', ink: '#1b1a17', accent: '#8a6a2f', soft: 'rgba(0,0,0,0.06)', label: 'Papel' },
};

/** Quebra o texto em linhas que cabem na largura; corta com reticências após `maxLines`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > width && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Desenha o infográfico. Tudo vem do material: título, ideia central (se o
 * autor escreveu), números, os pontos de cada parte, palavras-chave e o
 * texto-chave.
 */
export function drawInfographic(canvas: HTMLCanvasElement, material: Material, reading: MaterialReading, format: Format, palette: Palette) {
  const [W, H] = SIZES[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const p = PALETTES[palette];
  const M = 72;
  const font = (size: number, weight = 400, italic = false) =>
    `${italic ? 'italic ' : ''}${weight} ${size}px Inter, 'Segoe UI', system-ui, sans-serif`;

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  let y = M;
  ctx.fillStyle = p.accent;
  ctx.font = font(26, 700);
  ctx.fillText(material.kind.toUpperCase(), M, y);
  y += 48;

  ctx.fillStyle = p.ink;
  ctx.font = font(64, 800);
  for (const line of wrap(ctx, material.title, W - 2 * M, 2)) {
    ctx.fillText(line, M, y);
    y += 74;
  }
  if (material.author) {
    ctx.font = font(28, 500);
    ctx.globalAlpha = 0.75;
    ctx.fillText(material.author, M, y + 4);
    ctx.globalAlpha = 1;
    y += 44;
  }
  y += 18;

  if (material.centralIdea) {
    ctx.font = font(32, 500, true);
    const lines = wrap(ctx, material.centralIdea, W - 2 * M - 40, format === 'quadrado' ? 2 : 3);
    const boxH = lines.length * 42 + 40;
    ctx.fillStyle = p.soft;
    roundRect(ctx, M, y, W - 2 * M, boxH, 20);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.fillRect(M, y, 8, boxH);
    ctx.fillStyle = p.ink;
    lines.forEach((line, i) => ctx.fillText(line, M + 32, y + 20 + i * 42));
    y += boxH + 32;
  }

  // números
  const plural = (n: number, one: string, many: string) => `${n === 1 ? one : many}`;
  const stats: Array<[string, string]> = [
    [String(material.sections.length), plural(material.sections.length, 'parte', 'partes')],
    [String(reading.references.length), plural(reading.references.length, 'versículo', 'versículos')],
    [`${reading.minutes}`, 'min de leitura'],
  ];
  const colW = (W - 2 * M - 2 * 24) / 3;
  stats.forEach(([value, label], i) => {
    const x = M + i * (colW + 24);
    ctx.fillStyle = p.soft;
    roundRect(ctx, x, y, colW, 120, 18);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.font = font(52, 800);
    ctx.fillText(value, x + 24, y + 16);
    ctx.fillStyle = p.ink;
    ctx.font = font(24, 500);
    ctx.fillText(label, x + 24, y + 80);
  });
  y += 152;

  // pontos
  const footerSpace = 150;
  const points = reading.sections
    .map((s) => ({ title: s.section.title, line: s.highlights[0] ?? sentences(s.paragraphs[0] ?? s.listItems[0] ?? '')[0] ?? '' }))
    .filter((pt) => pt.title || pt.line);
  const maxPoints = format === 'quadrado' ? 3 : 5;
  points.slice(0, maxPoints).forEach((pt, i) => {
    if (y > H - footerSpace - 90) return;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(M + 22, y + 22, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.bg;
    ctx.font = font(24, 800);
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), M + 22, y + 9);
    ctx.textAlign = 'left';
    ctx.fillStyle = p.ink;
    ctx.font = font(30, 700);
    ctx.fillText(wrap(ctx, pt.title, W - 2 * M - 70, 1)[0] ?? '', M + 70, y + 4);
    y += 44;
    if (pt.line) {
      ctx.font = font(25, 400);
      ctx.globalAlpha = 0.85;
      for (const line of wrap(ctx, pt.line, W - 2 * M - 70, 2)) {
        ctx.fillText(line, M + 70, y);
        y += 34;
      }
      ctx.globalAlpha = 1;
    }
    y += 22;
  });
  if (points.length > maxPoints) {
    ctx.font = font(24, 500);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = p.ink;
    ctx.fillText(`+ ${points.length - maxPoints} parte(s)`, M + 70, y - 8);
    ctx.globalAlpha = 1;
  }

  // sobrando espaço, os versículos citados e as palavras-chave entram no meio
  const chips = (title: string, items: string[]) => {
    if (!items.length || y > H - footerSpace - 150) return;
    y += 10;
    ctx.fillStyle = p.accent;
    ctx.font = font(24, 700);
    ctx.fillText(title.toUpperCase(), M, y);
    y += 42;
    ctx.font = font(26, 600);
    let x = M;
    for (const item of items) {
      const w = ctx.measureText(item).width + 36;
      if (x + w > W - M) {
        x = M;
        y += 58;
        if (y > H - footerSpace - 60) break;
      }
      ctx.fillStyle = p.soft;
      roundRect(ctx, x, y, w, 46, 23);
      ctx.fill();
      ctx.fillStyle = p.ink;
      ctx.fillText(item, x + 18, y + 9);
      x += w + 12;
    }
    y += 76;
  };
  chips('Versículos citados', reading.references.slice(0, 8).map((r) => r.label));
  const keywordsInMiddle = y <= H - footerSpace - 150;
  chips('Palavras-chave', reading.keywords.slice(0, 8).map((k) => k.word));

  // rodapé: texto-chave (e as palavras, se não couberam no meio)
  const fy = H - footerSpace + 10;
  ctx.fillStyle = p.accent;
  ctx.fillRect(M, fy - 20, W - 2 * M, 2);
  ctx.font = font(26, 700);
  ctx.fillStyle = p.ink;
  const keyRef = reading.references[0]?.label;
  if (keyRef) ctx.fillText(`Texto-chave: ${keyRef}`, M, fy);
  ctx.font = font(24, 500);
  ctx.globalAlpha = 0.8;
  const words = keywordsInMiddle ? '' : reading.keywords.slice(0, 6).map((k) => k.word).join(' · ');
  if (words) ctx.fillText(wrap(ctx, words, W - 2 * M, 1)[0] ?? '', M, fy + (keyRef ? 44 : 0));
  ctx.globalAlpha = 0.55;
  ctx.font = font(20, 500);
  ctx.textAlign = 'right';
  ctx.fillText('Hub Resumos', W - M, H - 48);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

export function InfographicTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { notify } = useToast();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<Format>('retrato');
  const [palette, setPalette] = useState<Palette>('verde');

  useEffect(() => {
    if (canvas.current) drawInfographic(canvas.current, material, reading, format, palette);
  }, [material, reading, format, palette]);

  const toBlob = () =>
    new Promise<Blob>((resolve, reject) => canvas.current?.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem.'))), 'image/png'));

  return (
    <div className="stack">
      <div className="row row-wrap">
        <div className="chip-row">
          {(Object.keys(SIZES) as Format[]).map((f) => (
            <button key={f} className={`chip${format === f ? ' active' : ''}`} onClick={() => setFormat(f)}>
              {f === 'retrato' ? 'Retrato (4:5)' : 'Quadrado'}
            </button>
          ))}
        </div>
        <div className="chip-row">
          {(Object.keys(PALETTES) as Palette[]).map((k) => (
            <button key={k} className={`chip${palette === k ? ' active' : ''}`} onClick={() => setPalette(k)}>
              <span className="chip-dot" style={{ background: PALETTES[k].bg, border: '1px solid var(--border-strong)' }} />
              {PALETTES[k].label}
            </button>
          ))}
        </div>
      </div>
      {!material.centralIdea && <p className="small muted" style={{ margin: 0 }}>Dica: escreva a ideia central no DNA — ela entra em destaque no infográfico.</p>}
      <canvas ref={canvas} className="xr-canvas" aria-label={`Infográfico de ${material.title}`} />
      <div className="row row-wrap">
        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              downloadBlob(await toBlob(), `${safeName(material.title)} - infográfico.png`);
            } catch (err) {
              notify((err as Error).message, 'error');
            }
          }}
        >
          Baixar imagem (PNG)
        </button>
        <button
          className="btn"
          onClick={async () => {
            try {
              const file = new File([await toBlob()], `${safeName(material.title)}.png`, { type: 'image/png' });
              if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: material.title });
              else {
                downloadBlob(file, file.name);
                notify('Este aparelho não compartilha imagens; a imagem foi baixada.');
              }
            } catch (err) {
              if ((err as Error).name !== 'AbortError') notify((err as Error).message, 'error');
            }
          }}
        >
          Compartilhar
        </button>
      </div>
    </div>
  );
}
