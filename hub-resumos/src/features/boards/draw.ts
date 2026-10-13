import type { BoardContent, BoardKind } from '../../core/boards';

/**
 * Desenho dos quadros visuais em <canvas>, no estilo dos exemplos do usuário:
 * papel claro, título com marca-texto, etiquetas coloridas, números em
 * círculo e setas. A largura é fixa (1080 px, a do Instagram); a altura
 * acompanha o conteúdo. Textos longos são encurtados com "…" só no desenho —
 * o texto inteiro continua nas outras abas.
 */

export type BoardPalette = 'papel' | 'noite';

interface Colors {
  bg: string;
  ink: string;
  soft: string;
  rule: string;
  title: string;
  accent: string;
  marker: string;
  card: string;
  tags: string[];
  tagInk: string;
}

const PALETTES: Record<BoardPalette, Colors> = {
  papel: {
    bg: '#FBF7EE',
    ink: '#24262B',
    soft: '#5D6169',
    rule: '#D9534F',
    title: '#1E2A4A',
    accent: '#C8372D',
    marker: 'rgba(246, 205, 70, 0.75)',
    card: '#FFFFFF',
    tags: ['#F6CD46', '#F4A8A0', '#A9D2F2', '#B6E2AE', '#D5C3F2', '#F8C79A', '#9EE0D6', '#F2B5D4'],
    tagInk: '#1B1D22',
  },
  noite: {
    bg: '#0D1B2A',
    ink: '#E3E8EF',
    soft: '#9AAABD',
    rule: '#C9973A',
    title: '#E8B96A',
    accent: '#E8B96A',
    marker: 'rgba(201, 151, 58, 0.45)',
    card: '#132538',
    tags: ['#C9973A', '#8B1A2E', '#1A5E3A', '#2A4060', '#5A3E8B', '#8B5A0A', '#0D5F7A', '#7A2E5E'],
    tagInk: '#FFFFFF',
  },
};

export const BOARD_WIDTH = 1080;
const PAD = 64;
const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const COND = "'Arial Narrow', 'Roboto Condensed', 'Segoe UI', Arial, sans-serif";

type Ctx = CanvasRenderingContext2D;

/* -------------------------------- utilitários ----------------------------- */

function font(c: Ctx, size: number, weight = 400, family = SANS) {
  c.font = `${weight} ${size}px ${family}`;
}

/** Quebra em linhas que cabem em `width`; corta com "…" depois de `max` linhas. */
function wrap(c: Ctx, text: string, width: number, max = 99): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    let w = words[i];
    while (c.measureText(w).width > width && w.length > 2) w = w.slice(0, -2);
    if (w !== words[i]) w += '…';
    const test = line ? `${line} ${w}` : w;
    if (c.measureText(test).width > width && line) {
      lines.push(line);
      line = w;
      if (lines.length === max) break;
    } else line = test;
  }
  if (lines.length < max && line) {
    lines.push(line);
    i = words.length;
  }
  if (i < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (c.measureText(`${last}…`).width > width && last.length) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
  }
  return lines;
}

/** Escreve um parágrafo; devolve o y logo abaixo dele. */
function para(c: Ctx, text: string, x: number, y: number, width: number, size: number, color: string, max = 99, opts: { weight?: number; align?: CanvasTextAlign; lh?: number; family?: string } = {}) {
  font(c, size, opts.weight ?? 400, opts.family);
  c.fillStyle = color;
  c.textAlign = opts.align ?? 'left';
  c.textBaseline = 'top';
  const lh = size * (opts.lh ?? 1.3);
  const lines = wrap(c, text, width, max);
  const ax = opts.align === 'center' ? x + width / 2 : opts.align === 'right' ? x + width : x;
  lines.forEach((l, i) => c.fillText(l, ax, y + i * lh));
  return y + lines.length * lh;
}

function measurePara(c: Ctx, text: string, width: number, size: number, max = 99, weight = 400, lh = 1.3, family = SANS) {
  font(c, size, weight, family);
  return wrap(c, text, width, max).length * size * lh;
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Etiqueta colorida (como as de marca-texto dos exemplos). */
function tag(c: Ctx, text: string, x: number, y: number, color: string, ink: string, size = 26, maxW = 900) {
  font(c, size, 800, COND);
  const label = wrap(c, text.toUpperCase(), maxW - 28, 1)[0] ?? '';
  const w = c.measureText(label).width + 28;
  const h = size + 16;
  c.save();
  c.translate(x, y);
  c.rotate(-0.012);
  roundRect(c, 0, 0, w, h, 8);
  c.fillStyle = color;
  c.fill();
  c.fillStyle = ink;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  c.fillText(label, 14, h / 2 + 1);
  c.restore();
  return { w, h };
}

function circleNum(c: Ctx, n: number, x: number, y: number, r: number, fill: string, ink: string) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  font(c, r * 1.05, 800);
  c.fillStyle = ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(n), x, y + 1);
}

function arrow(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 3) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - 16 * Math.cos(a - 0.45), y2 - 16 * Math.sin(a - 0.45));
  c.lineTo(x2 - 16 * Math.cos(a + 0.45), y2 - 16 * Math.sin(a + 0.45));
  c.closePath();
  c.fill();
}

/** Sublinhado de caneta, levemente torto. */
function underline(c: Ctx, x: number, y: number, w: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + w / 2, y + 4, x + w, y - 1);
  c.stroke();
}

/** Cabeçalho: título com marca-texto, autor à direita e uma linha de apoio. */
function header(c: Ctx, k: Colors, d: BoardContent, subtitle?: string): number {
  const authorW = d.author ? 230 : 0;
  const titleW = BOARD_WIDTH - PAD * 2 - authorW - (authorW ? 24 : 0);
  font(c, 66, 900, COND);
  const lines = wrap(c, d.title.toUpperCase(), titleW, 3);
  const lh = 74;
  let y = PAD;
  lines.forEach((l, i) => {
    const w = c.measureText(l).width;
    c.fillStyle = k.marker;
    c.fillRect(PAD - 6, y + i * lh + 44, w + 12, 22);
    c.fillStyle = i === 0 ? k.accent : k.title;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText(l, PAD, y + i * lh);
  });
  if (d.author) {
    const ax = BOARD_WIDTH - PAD - authorW;
    const end = para(c, d.author.toUpperCase(), ax + 14, y + 8, authorW - 28, 24, k.title, 3, { weight: 800, align: 'center', family: COND });
    // as marquinhas "> <" dos exemplos, ao lado do autor
    c.strokeStyle = k.soft;
    c.lineWidth = 2;
    const mid = (y + 8 + end) / 2;
    for (const [sx, dir] of [[ax, 1], [ax + authorW, -1]] as const) {
      c.beginPath();
      c.moveTo(sx, mid - 12);
      c.lineTo(sx + 9 * dir, mid - 4);
      c.moveTo(sx, mid + 12);
      c.lineTo(sx + 9 * dir, mid + 4);
      c.stroke();
    }
  }
  y += lines.length * lh + 10;
  c.strokeStyle = k.rule;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(PAD, y);
  c.quadraticCurveTo(BOARD_WIDTH / 2, y + 5, BOARD_WIDTH - PAD, y);
  c.stroke();
  y += 22;
  if (subtitle) y = para(c, subtitle.toUpperCase(), PAD, y, BOARD_WIDTH - PAD * 2, 24, k.soft, 2, { weight: 700, align: 'center', family: COND }) + 10;
  return y + 20;
}

function footer(c: Ctx, k: Colors, y: number): number {
  font(c, 20, 600);
  c.fillStyle = k.soft;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText('Hub Resumos · conteúdo tirado do próprio material', BOARD_WIDTH / 2, y + 16);
  return y + 60;
}

function bullet(c: Ctx, x: number, y: number, color: string) {
  c.beginPath();
  c.arc(x, y, 7, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

/* ------------------------------ os seis quadros --------------------------- */

function drawDna(c: Ctx, k: Colors, d: BoardContent): number {
  let y = header(c, k, d);
  const leftW = 380;
  const rx = PAD + leftW + 40;
  const rw = BOARD_WIDTH - PAD - rx;
  // coluna da esquerda: ideia central (ou texto-chave)
  let ly = y;
  if (d.central) {
    ly += tag(c, d.centralLabel, PAD, ly, k.tags[0], k.tagInk).h + 18;
    const end = para(c, d.central, PAD, ly, leftW, 30, k.ink, 12, { lh: 1.35 });
    underline(c, PAD, end + 6, Math.min(leftW, 260), k.rule);
    ly = end + 30;
  }
  if (d.keywords.length) {
    ly += tag(c, 'Palavras-chave', PAD, ly, k.tags[4], k.tagInk, 22).h + 14;
    ly = para(c, d.keywords.slice(0, 8).join(' · '), PAD, ly, leftW, 24, k.soft, 4) + 20;
  }
  // coluna da direita: a estrutura, parte por parte
  let ry = y;
  ry += tag(c, 'Estrutura', rx, ry, k.tags[1], k.tagInk).h + 16;
  const parts = d.parts.slice(0, 7);
  const boxTop = ry;
  ry += 18;
  parts.forEach((p, i) => {
    const titleW = 190;
    const keyW = rw - 70 - titleW - 40 - 18;
    const th = measurePara(c, p.title, titleW, 25, 2, 800);
    const kh = p.key ? measurePara(c, p.key, keyW, 20, 4) : 0;
    const h = Math.max(th, kh, 48);
    circleNum(c, p.n, rx + 36, ry + Math.min(h, 60) / 2, 22, k.tags[(i + 1) % k.tags.length], k.tagInk);
    para(c, p.title, rx + 70, ry, titleW, 25, k.ink, 2, { weight: 800 });
    if (p.key) {
      arrow(c, rx + 70 + titleW + 6, ry + 18, rx + 70 + titleW + 30, ry + 18, k.soft, 2);
      para(c, p.key, rx + 70 + titleW + 40, ry, keyW, 20, k.soft, 4);
    }
    ry += h + 20;
  });
  if (d.parts.length > parts.length) ry = para(c, `+ ${d.parts.length - parts.length} partes no material`, rx + 70, ry, rw - 80, 20, k.soft, 1, { weight: 700 }) + 12;
  c.strokeStyle = k.ink;
  c.lineWidth = 2.5;
  roundRect(c, rx, boxTop, rw, ry - boxTop, 18);
  c.stroke();
  y = Math.max(ly, ry) + 40;
  // embaixo: aplicações em colunas
  if (d.applications.length) {
    y += tag(c, d.applicationsLabel, PAD, y, k.tags[0], k.tagInk).h + 24;
    const apps = d.applications.slice(0, 3);
    const colW = (BOARD_WIDTH - PAD * 2 - (apps.length - 1) * 30) / apps.length;
    let maxEnd = y;
    apps.forEach((a, i) => {
      const x = PAD + i * (colW + 30);
      // marca de "feito" desenhada, no lugar dos ícones dos exemplos
      c.strokeStyle = k.tags[(i + 2) % k.tags.length];
      c.lineWidth = 5;
      c.beginPath();
      c.arc(x + colW / 2, y + 30, 28, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = k.ink;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x + colW / 2 - 12, y + 31);
      c.lineTo(x + colW / 2 - 3, y + 41);
      c.lineTo(x + colW / 2 + 14, y + 20);
      c.stroke();
      const end = para(c, a, x, y + 76, colW, 24, k.ink, 5, { align: 'center' });
      underline(c, x + colW * 0.2, end + 8, colW * 0.6, k.rule);
      if (i < apps.length - 1) {
        c.strokeStyle = k.soft;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x + colW + 15, y);
        c.lineTo(x + colW + 15, end);
        c.stroke();
      }
      maxEnd = Math.max(maxEnd, end + 16);
    });
    y = maxEnd + 10;
  }
  return footer(c, k, y);
}

function drawConsulta(c: Ctx, k: Colors, d: BoardContent): number {
  let y = header(c, k, d, d.centralLabel === 'Ideia central' ? d.central : undefined);
  const parts = d.parts.slice(0, 8);
  const colW = (BOARD_WIDTH - PAD * 2 - 40) / 2;
  for (let i = 0; i < parts.length; i += 2) {
    const row = parts.slice(i, i + 2);
    let rowEnd = y;
    row.forEach((p, j) => {
      const x = PAD + j * (colW + 40);
      let cy = y + tag(c, `${p.n}. ${p.title}`, x, y, k.tags[(p.n - 1) % k.tags.length], k.tagInk, 24, colW).h + 14;
      if (p.key) cy = para(c, p.key, x + 4, cy, colW - 8, 23, k.ink, 5) + 12;
      if (p.extra) {
        const h = measurePara(c, p.extra, colW - 32, 20, 3) + 22;
        roundRect(c, x, cy, colW, h, 12);
        c.fillStyle = k.tags[1] + '55';
        c.fill();
        cy = para(c, p.extra, x + 16, cy + 11, colW - 32, 20, k.ink, 3) + 22;
      }
      rowEnd = Math.max(rowEnd, cy);
    });
    if (row.length === 2) {
      c.strokeStyle = k.soft + '88';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(PAD + colW + 20, y + 4);
      c.lineTo(PAD + colW + 20, rowEnd - 8);
      c.stroke();
    }
    y = rowEnd + 26;
  }
  const lesson = d.central || d.ideas[0];
  if (lesson) {
    const w = BOARD_WIDTH - PAD * 2;
    const h = measurePara(c, lesson, w - 48, 24, 5) + 70;
    c.strokeStyle = k.rule;
    c.lineWidth = 3;
    roundRect(c, PAD, y + 18, w, h, 16);
    c.stroke();
    tag(c, 'Principal ensinamento', PAD + 24, y, k.tags[1], k.tagInk, 24);
    para(c, lesson, PAD + 24, y + 52, w - 48, 24, k.ink, 5);
    y += h + 30;
  }
  return footer(c, k, y);
}

function drawConceitos(c: Ctx, k: Colors, d: BoardContent): number {
  const top = header(c, k, d);
  const nodes = d.parts.slice(0, 8);
  const n = Math.max(nodes.length, 1);
  const boxW = n > 6 ? 250 : 280;
  const cx = BOARD_WIDTH / 2;
  const rx = BOARD_WIDTH / 2 - PAD - boxW / 2;
  const ry = n > 6 ? 470 : 400;
  const cy = top + ry + 120;
  // centro
  // a letra do centro diminui até a palavra mais longa caber sem corte
  let cs = 30;
  for (; cs > 18; cs -= 2) {
    font(c, cs, 900, COND);
    if (d.title.toUpperCase().split(/\s+/).every((w) => c.measureText(w).width <= 230)) break;
  }
  const centerLines = wrap(c, d.title.toUpperCase(), 230, 4);
  const ew = 140, eh = Math.max(90, centerLines.length * (cs * 0.62) + 50);
  // cada conceito: etiqueta + o ponto-chave embaixo, medidos antes de desenhar
  const placed = nodes.map((p, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    font(c, 24, 800, COND);
    const lines = wrap(c, p.title.toUpperCase(), boxW - 24, 2);
    const bh = lines.length * 28 + 18;
    const th = p.key ? measurePara(c, p.key, boxW, 19, 4) + 10 : 0;
    const x = Math.min(BOARD_WIDTH - PAD - boxW, Math.max(PAD, cx + Math.cos(a) * rx - boxW / 2));
    const y = cy + Math.sin(a) * ry - (bh + th) / 2;
    return { p, a, x, y, lines, bh, th };
  });
  // setas do centro até a borda de cada bloco
  placed.forEach(({ x, y, bh, th }) => {
    const bx = x + boxW / 2, by = y + (bh + th) / 2;
    const ang = Math.atan2(by - cy, bx - cx);
    const sx = cx + Math.cos(ang) * (ew + 8), sy = cy + Math.sin(ang) * (eh + 8);
    // onde a reta encontra o retângulo do bloco (com folga de 12 px)
    const hw = boxW / 2 + 6, hh = (bh + th) / 2 + 6;
    const dx = sx - bx, dy = sy - by;
    const t = Math.min(Math.abs(dx) > 0.01 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 0.01 ? hh / Math.abs(dy) : Infinity);
    const ex = bx + dx * t, ey = by + dy * t;
    if (Math.hypot(ex - sx, ey - sy) > 14) arrow(c, sx, sy, ex, ey, k.ink, 2.5);
  });
  c.beginPath();
  c.ellipse(cx, cy, ew, eh, 0, 0, Math.PI * 2);
  c.fillStyle = k.tags[0] + 'cc';
  c.fill();
  c.strokeStyle = k.ink;
  c.lineWidth = 3;
  c.stroke();
  font(c, cs, 900, COND);
  c.fillStyle = k.tagInk;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  centerLines.forEach((l, i) => c.fillText(l, cx, cy + (i - (centerLines.length - 1) / 2) * cs * 1.13));
  let bottom = cy + eh;
  placed.forEach(({ p, x, y, lines, bh }, i) => {
    roundRect(c, x, y, boxW, bh, 12);
    c.fillStyle = k.tags[(i + 1) % k.tags.length] + '99';
    c.fill();
    c.strokeStyle = k.ink;
    c.lineWidth = 2;
    c.stroke();
    font(c, 24, 800, COND);
    c.fillStyle = k.tagInk === '#FFFFFF' ? k.ink : k.tagInk;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    lines.forEach((l, j) => c.fillText(l, x + boxW / 2, y + 10 + j * 28));
    const end = p.key ? para(c, p.key, x, y + bh + 10, boxW, 19, k.soft, 4, { align: 'center' }) : y + bh;
    bottom = Math.max(bottom, end);
  });
  return footer(c, k, bottom + 30);
}

function drawPainel(c: Ctx, k: Colors, d: BoardContent): number {
  let y = header(c, k, d, d.centralLabel === 'Ideia central' ? d.central : undefined);
  const colW = (BOARD_WIDTH - PAD * 2 - 50) / 2;
  const rx = PAD + colW + 50;
  // esquerda: ideias principais
  let ly = y + tag(c, 'Ideias principais', PAD, y, k.tags[0], k.tagInk).h + 18;
  d.ideas.slice(0, 6).forEach((t) => {
    bullet(c, PAD + 8, ly + 15, k.rule);
    ly = para(c, t, PAD + 28, ly, colW - 28, 23, k.ink, 3) + 14;
  });
  // direita: conceitos (ou palavras-chave)
  let ry = y + tag(c, d.concepts.length ? 'Conceitos' : 'Palavras-chave', rx, y, k.tags[2], k.tagInk).h + 18;
  if (d.concepts.length)
    d.concepts.slice(0, 6).forEach((cpt) => {
      font(c, 23, 800);
      const tw = Math.min(colW, c.measureText(cpt.term).width);
      para(c, cpt.term, rx, ry, colW, 23, k.ink, 1, { weight: 800 });
      underline(c, rx, ry + 30, tw, k.rule);
      ry = para(c, cpt.meaning, rx, ry + 38, colW, 20, k.soft, 3) + 14;
    });
  else ry = para(c, d.keywords.slice(0, 12).join(' · '), rx, ry, colW, 23, k.ink, 6) + 14;
  c.strokeStyle = k.soft + '88';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(PAD + colW + 25, y);
  c.lineTo(PAD + colW + 25, Math.max(ly, ry));
  c.stroke();
  y = Math.max(ly, ry) + 30;
  // embaixo: aplicações e base bíblica (ou perguntas)
  const ytop = y;
  if (d.applications.length) {
    let ay = ytop + tag(c, d.applicationsLabel, PAD, ytop, k.tags[3], k.tagInk).h + 18;
    d.applications.slice(0, 5).forEach((t, i) => {
      circleNum(c, i + 1, PAD + 16, ay + 15, 15, k.tags[3], k.tagInk);
      ay = para(c, t, PAD + 42, ay, colW - 42, 22, k.ink, 3) + 12;
    });
    y = Math.max(y, ay);
  }
  const rightItems = d.references.length ? d.references : d.questions;
  if (rightItems.length) {
    let by = ytop + tag(c, d.references.length ? 'Base bíblica' : 'Perguntas', rx, ytop, k.tags[4], k.tagInk).h + 18;
    rightItems.slice(0, 8).forEach((t) => {
      bullet(c, rx + 8, by + 14, k.tags[4]);
      by = para(c, t, rx + 28, by, colW - 28, 22, k.ink, 2) + 10;
    });
    y = Math.max(y, by);
  }
  return footer(c, k, y + 10);
}

function drawFluxo(c: Ctx, k: Colors, d: BoardContent): number {
  let y = header(c, k, d, d.centralLabel === 'Ideia central' ? d.central : undefined);
  const parts = d.parts.slice(0, 10);
  const leftW = 430;
  const gap = 46;
  const rightX = PAD + leftW + gap;
  const rightW = BOARD_WIDTH - PAD - rightX;
  parts.forEach((p, i) => {
    const color = k.tags[i % k.tags.length];
    const th = measurePara(c, p.title.toUpperCase(), leftW - 120, 25, 2, 800, 1.2, COND);
    const kh = p.key ? measurePara(c, p.key, rightW - 32, 20, 4) : 0;
    const h = Math.max(th + 30, kh + 28, 84);
    roundRect(c, PAD + 30, y, leftW - 30, h, 14);
    c.fillStyle = color + '66';
    c.fill();
    circleNum(c, p.n, PAD + 30, y + h / 2, 30, color, k.tagInk);
    para(c, p.title.toUpperCase(), PAD + 80, y + (h - th) / 2, leftW - 120, 25, k.ink, 2, { weight: 800, lh: 1.2, family: COND });
    if (p.key) {
      arrow(c, PAD + leftW + 6, y + h / 2, rightX - 8, y + h / 2, color, 3);
      roundRect(c, rightX, y, rightW, h, 12);
      c.fillStyle = color + '33';
      c.fill();
      para(c, p.key, rightX + 16, y + (h - kh) / 2, rightW - 32, 20, k.ink, 4);
    }
    y += h;
    if (i < parts.length - 1) {
      arrow(c, PAD + 30 + (leftW - 30) / 2, y + 6, PAD + 30 + (leftW - 30) / 2, y + 34, k.ink, 2.5);
      y += 40;
    }
  });
  if (d.parts.length > parts.length) y = para(c, `+ ${d.parts.length - parts.length} passos no material`, PAD, y + 16, 600, 22, k.soft, 1, { weight: 700 });
  return footer(c, k, y + 20);
}

function drawCartoes(c: Ctx, k: Colors, d: BoardContent): number {
  let y = header(c, k, d, 'Cartões de revisão');
  const cards = d.cards.slice(0, 6);
  const colW = (BOARD_WIDTH - PAD * 2 - 36) / 2;
  if (!cards.length) y = para(c, 'Este texto ainda não tem destaques, definições, listas ou perguntas para virar cartão.', PAD, y, BOARD_WIDTH - PAD * 2, 24, k.soft, 3);
  for (let i = 0; i < cards.length; i += 2) {
    const row = cards.slice(i, i + 2);
    const heights = row.map((cd) => measurePara(c, cd.front, colW - 48, 24, 4, 800) + measurePara(c, cd.back, colW - 48, 22, 6) + 90);
    const h = Math.max(...heights);
    row.forEach((cd, j) => {
      const x = PAD + j * (colW + 36);
      const color = k.tags[(i + j) % k.tags.length];
      c.save();
      c.translate(x + colW / 2, y + h / 2);
      c.rotate(((i + j) % 2 ? 1 : -1) * 0.008);
      c.translate(-(x + colW / 2), -(y + h / 2));
      c.shadowColor = 'rgba(0,0,0,0.18)';
      c.shadowBlur = 18;
      c.shadowOffsetY = 6;
      roundRect(c, x, y, colW, h, 16);
      c.fillStyle = k.card;
      c.fill();
      c.shadowColor = 'transparent';
      roundRect(c, x, y, colW, 14, 8);
      c.fillStyle = color;
      c.fill();
      let cy = para(c, cd.front, x + 24, y + 34, colW - 48, 24, k.ink, 4, { weight: 800 });
      underline(c, x + 24, cy + 8, Math.min(140, colW - 48), color);
      cy = para(c, cd.back, x + 24, cy + 26, colW - 48, 22, k.soft, 6);
      c.restore();
    });
    y += h + 34;
  }
  return footer(c, k, y);
}

const DRAW: Record<BoardKind, (c: Ctx, k: Colors, d: BoardContent) => number> = {
  dna: drawDna,
  consulta: drawConsulta,
  conceitos: drawConceitos,
  painel: drawPainel,
  fluxo: drawFluxo,
  cartoes: drawCartoes,
};

/**
 * Desenha o quadro num canvas alto e devolve outro, cortado na altura que o
 * conteúdo ocupou (no mínimo a de um retrato 4:5).
 */
export function renderBoard(kind: BoardKind, content: BoardContent, palette: BoardPalette = 'papel'): HTMLCanvasElement {
  const k = PALETTES[palette];
  const tall = document.createElement('canvas');
  tall.width = BOARD_WIDTH;
  tall.height = 5200;
  const c = tall.getContext('2d')!;
  c.fillStyle = k.bg;
  c.fillRect(0, 0, tall.width, tall.height);
  const used = Math.min(tall.height, Math.max(900, Math.ceil(DRAW[kind](c, k, content))));
  const out = document.createElement('canvas');
  out.width = BOARD_WIDTH;
  out.height = used;
  const o = out.getContext('2d')!;
  o.drawImage(tall, 0, 0);
  // moldura fina, como a borda do papel nos exemplos
  o.strokeStyle = palette === 'papel' ? '#E6DFCF' : '#1A2E44';
  o.lineWidth = 6;
  o.strokeRect(3, 3, out.width - 6, out.height - 6);
  return out;
}
