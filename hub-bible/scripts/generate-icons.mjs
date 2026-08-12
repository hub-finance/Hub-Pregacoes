#!/usr/bin/env node
/**
 * Gera os ícones PNG do PWA (any + maskable) sem dependências externas.
 * Desenho: gradiente dourado sobre fundo escuro com uma Bíblia aberta.
 *
 * Uso: node scripts/generate-icons.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');

const INK = [15, 17, 21];
const GOLD_A = [231, 199, 143];
const GOLD_B = [138, 106, 47];
const PAGE = [250, 248, 245];

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function roundedRectAlpha(x, y, size, inset, radius) {
  const min = inset;
  const max = size - inset;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  if (x < min || x > max || y < min || y > max) return 0;
  return dist <= radius ? 1 : 0;
}

function draw(size, maskable) {
  const inset = maskable ? 0 : Math.round(size * 0.06);
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const pixels = Buffer.alloc(size * size * 4);

  // páginas do livro (coordenadas relativas)
  const s = (v) => v * size;
  const left = [
    [s(0.2), s(0.37)],
    [s(0.485), s(0.325)],
    [s(0.485), s(0.7)],
    [s(0.2), s(0.665)],
  ];
  const right = [
    [s(0.8), s(0.37)],
    [s(0.515), s(0.325)],
    [s(0.515), s(0.7)],
    [s(0.8), s(0.665)],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const alpha = inset || radius ? roundedRectAlpha(x + 0.5, y + 0.5, size, inset, radius) : 1;
      if (!alpha) {
        pixels[i + 3] = 0;
        continue;
      }

      let color = INK;
      // halo dourado difuso no canto superior direito
      const t = Math.min(1, Math.hypot(x - size * 0.78, y - size * 0.2) / (size * 0.7));
      color = lerp(lerp(GOLD_B, INK, 0.55), INK, t);

      // lombada
      if (Math.abs(x - size * 0.5) < size * 0.008 && y > s(0.325) && y < s(0.705)) {
        color = lerp(GOLD_A, GOLD_B, (y - s(0.325)) / s(0.38));
      } else if (inPolygon(x + 0.5, y + 0.5, left) || inPolygon(x + 0.5, y + 0.5, right)) {
        const shade = 0.06 + 0.16 * (y / size);
        color = lerp(PAGE, GOLD_B, shade);
        // linhas de texto
        const lineIndex = Math.floor((y - s(0.4)) / s(0.052));
        const onLine = y > s(0.4) && y < s(0.64) && (y - s(0.4)) % s(0.052) < s(0.012);
        const inMargin =
          (x > s(0.24) && x < s(0.455)) || (x > s(0.545) && x < s(0.76));
        if (onLine && inMargin && lineIndex % 1 === 0) color = lerp(GOLD_B, PAGE, 0.45);
      }

      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

/* ------------------------------ encoder PNG ------------------------------ */

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro "none"
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------- saída --------------------------------- */

fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const target of targets) {
  const png = encodePng(target.size, draw(target.size, target.maskable));
  fs.writeFileSync(path.join(OUT, target.file), png);
  console.log(`✔ ${target.file} (${target.size}px, ${(png.length / 1024).toFixed(1)} kB)`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Hub Bible">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e7c78f"/><stop offset="1" stop-color="#8a6a2f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#0f1115"/>
  <path d="M102 189 248 166v193L102 341z" fill="url(#g)"/>
  <path d="M410 189 264 166v193l146-18z" fill="url(#g)" opacity=".82"/>
  <rect x="250" y="164" width="12" height="198" rx="6" fill="#e7c78f"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);
console.log('✔ icon.svg');
