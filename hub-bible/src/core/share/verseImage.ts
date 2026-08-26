/**
 * Gera a imagem de compartilhamento (texto + referência + nome do app) em
 * <canvas>, sem dependências externas — funciona offline e no WebView Android.
 */

/**
 * Fundos disponíveis para a imagem do versículo.
 *
 * O fundo não é enfeite: a imagem vai para o WhatsApp e para o status, onde
 * dividirá a tela com outras. Cada opção é uma dupla de cores da mesma família,
 * com o texto e o realce já escolhidos para ler bem em cima dela — não são
 * cores soltas que o usuário combina por conta e erra.
 */
export const VERSE_BACKGROUNDS = {
  dark: { label: 'Noite', bg: ['#12151b', '#1d232e'], fg: '#f1f3f7', accent: '#d7b174', dim: '#98a1b0' },
  light: { label: 'Papel', bg: ['#fbf9f6', '#f0eae0'], fg: '#1b1a17', accent: '#8a6a2f', dim: '#6d675f' },
  sepia: { label: 'Sépia', bg: ['#f7edda', '#eadcc0'], fg: '#3f321f', accent: '#8c5a24', dim: '#7b6a4d' },
  azul: { label: 'Azul', bg: ['#0e1a2b', '#1b3a5c'], fg: '#e8eef7', accent: '#7cbcee', dim: '#a2b8d2' },
  oliveira: { label: 'Oliveira', bg: ['#12201a', '#1d362b'], fg: '#e9f2ec', accent: '#8fc9a4', dim: '#9db3a6' },
  purpura: { label: 'Púrpura', bg: ['#1c1230', '#2e1d48'], fg: '#f0eaf8', accent: '#c39ce8', dim: '#b0a3c4' },
  vinho: { label: 'Vinho', bg: ['#25121a', '#3d1d2b'], fg: '#f7e9ed', accent: '#e099ac', dim: '#c2a2ac' },
} as const;

export type VerseBackground = keyof typeof VERSE_BACKGROUNDS;

export const VERSE_BACKGROUND_IDS = Object.keys(VERSE_BACKGROUNDS) as VerseBackground[];

export interface VerseImageOptions {
  text: string;
  reference: string;
  translation?: string;
  background?: VerseBackground;
  width?: number;
  height?: number;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderVerseImage(options: VerseImageOptions): Promise<Blob> {
  const width = options.width ?? 1080;
  const height = options.height ?? 1080;
  const palette = VERSE_BACKGROUNDS[options.background ?? 'dark'];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível neste dispositivo.');

  // fundo
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.bg[0]);
  gradient.addColorStop(1, palette.bg[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // brilho decorativo
  const glow = ctx.createRadialGradient(width * 0.82, height * 0.14, 0, width * 0.82, height * 0.14, width * 0.5);
  glow.addColorStop(0, `${palette.accent}33`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const margin = width * 0.11;
  const maxWidth = width - margin * 2;

  // texto bíblico — reduz a fonte até caber com folga
  const serif = 'Georgia, "Times New Roman", serif';
  let fontSize = Math.round(width * 0.062);
  let lines: string[] = [];
  for (; fontSize > width * 0.026; fontSize -= 2) {
    ctx.font = `${fontSize}px ${serif}`;
    lines = wrap(ctx, `“${options.text}”`, maxWidth);
    if (lines.length * fontSize * 1.42 < height * 0.56) break;
  }

  const lineHeight = fontSize * 1.42;
  const blockHeight = lines.length * lineHeight;
  let y = (height - blockHeight) / 2 - height * 0.03;

  ctx.fillStyle = palette.fg;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (const line of lines) {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }

  // filete
  y += lineHeight * 0.35;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(margin, y, width * 0.09, 4);

  // referência
  y += lineHeight * 0.55;
  ctx.font = `600 ${Math.round(width * 0.034)}px system-ui, sans-serif`;
  ctx.fillStyle = palette.accent;
  ctx.fillText(options.reference.toUpperCase(), margin, y);

  if (options.translation) {
    y += width * 0.05;
    ctx.font = `${Math.round(width * 0.024)}px system-ui, sans-serif`;
    ctx.fillStyle = palette.dim;
    ctx.fillText(options.translation, margin, y);
  }

  // assinatura do aplicativo
  ctx.font = `600 ${Math.round(width * 0.023)}px system-ui, sans-serif`;
  ctx.fillStyle = palette.dim;
  ctx.textAlign = 'center';
  ctx.fillText('HUB BIBLE', width / 2, height - margin * 0.72);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.'))),
      'image/png',
      0.95,
    );
  });
}
