#!/usr/bin/env node
/**
 * Gera os ícones PNG do PWA (any + maskable).
 * Desenho: farol branco sobre fundo azul escuro, com feixe de luz.
 *
 * Uso: node scripts/generate-icons.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'public', 'icons');

const BG = [16, 36, 76];
const BLUE_MID = [30, 64, 130];
const BLUE_LIGHT = [70, 130, 210];
const WHITE = [255, 255, 255];
const CREAM = [240, 245, 255];
const LIGHT_BEAM = [180, 210, 255];

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function roundedRectAlpha(x, y, size, inset, radius) {
  const min = inset;
  const max = size - inset;
  if (x < min || x > max || y < min || y > max) return 0;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  return Math.hypot(x - cx, y - cy) <= radius ? 1 : 0;
}

function draw(size, maskable) {
  const inset = maskable ? 0 : Math.round(size * 0.06);
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const pixels = Buffer.alloc(size * size * 4);
  const s = (v) => v * size;

  // centro do farol
  const cx = size * 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const alpha = inset || radius ? roundedRectAlpha(x + 0.5, y + 0.5, size, inset, radius) : 1;
      if (!alpha) { pixels[i + 3] = 0; continue; }

      // fundo: gradiente radial azul
      const distFromCenter = Math.hypot(x - cx, y - size * 0.35) / (size * 0.6);
      let color = lerp(BLUE_MID, BG, Math.min(1, distFromCenter));

      // feixe de luz (cone saindo do topo do farol)
      const beamCx = cx;
      const beamTop = s(0.12);
      const beamBottom = s(0.42);
      if (y >= beamTop && y <= beamBottom) {
        const progress = (y - beamTop) / (beamBottom - beamTop);
        const halfWidth = s(0.02) + progress * s(0.22);
        const dx = Math.abs(x - beamCx);
        if (dx < halfWidth) {
          const intensity = (1 - dx / halfWidth) * (1 - progress * 0.7);
          color = lerp(color, LIGHT_BEAM, intensity * 0.45);
        }
      }

      // corpo do farol — torre
      const towerLeft = s(0.42);
      const towerRight = s(0.58);
      const towerTop = s(0.38);
      const towerBottom = s(0.78);
      if (x >= towerLeft && x <= towerRight && y >= towerTop && y <= towerBottom) {
        const tProgress = (y - towerTop) / (towerBottom - towerTop);
        // leve inclinação (mais largo embaixo)
        const widen = tProgress * s(0.02);
        if (x >= towerLeft - widen && x <= towerRight + widen) {
          color = lerp(WHITE, CREAM, tProgress * 0.3);
          // faixas horizontais azuis decorativas
          const stripe1 = y >= s(0.48) && y <= s(0.50);
          const stripe2 = y >= s(0.60) && y <= s(0.62);
          if (stripe1 || stripe2) {
            color = BLUE_LIGHT;
          }
        }
      }

      // base mais larga do farol
      const baseTop = s(0.72);
      const baseBottom = s(0.82);
      const baseLeft = s(0.36);
      const baseRight = s(0.64);
      if (x >= baseLeft && x <= baseRight && y >= baseTop && y <= baseBottom) {
        const bProgress = (y - baseTop) / (baseBottom - baseTop);
        color = lerp(WHITE, CREAM, 0.1 + bProgress * 0.2);
      }

      // lanterna (parte superior — a cabine de luz)
      const lanternTop = s(0.30);
      const lanternBottom = s(0.40);
      const lanternLeft = s(0.40);
      const lanternRight = s(0.60);
      if (x >= lanternLeft && x <= lanternRight && y >= lanternTop && y <= lanternBottom) {
        color = WHITE;
        // janelas da lanterna (vidro azul claro)
        const winInset = s(0.025);
        if (x > lanternLeft + winInset && x < lanternRight - winInset &&
            y > lanternTop + s(0.015) && y < lanternBottom - s(0.015)) {
          const glow = 0.7 + 0.3 * Math.sin((x - lanternLeft) / (lanternRight - lanternLeft) * Math.PI);
          color = lerp(BLUE_LIGHT, [220, 240, 255], glow);
        }
      }

      // telhado cônico
      const roofTop = s(0.24);
      const roofBottom = s(0.31);
      if (y >= roofTop && y <= roofBottom) {
        const rProgress = (y - roofTop) / (roofBottom - roofTop);
        const roofHalf = s(0.015) + rProgress * s(0.11);
        if (Math.abs(x - cx) <= roofHalf) {
          color = lerp([200, 215, 240], WHITE, rProgress);
        }
      }

      // ponta no topo
      const tipTop = s(0.20);
      const tipBottom = s(0.25);
      if (y >= tipTop && y <= tipBottom) {
        const tProg = (y - tipTop) / (tipBottom - tipTop);
        const tipHalf = s(0.004) + tProg * s(0.012);
        if (Math.abs(x - cx) <= tipHalf) {
          color = WHITE;
        }
      }

      // plataforma/varanda
      const platTop = s(0.385);
      const platBottom = s(0.40);
      const platLeft = s(0.37);
      const platRight = s(0.63);
      if (x >= platLeft && x <= platRight && y >= platTop && y <= platBottom) {
        color = WHITE;
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
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
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
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#1e4082"/><stop offset="1" stop-color="#10244c"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <polygon points="256,102 220,158 292,158" fill="#c8d7f0"/>
  <rect x="200" y="155" width="112" height="52" rx="4" fill="#fff"/>
  <rect x="210" y="163" width="92" height="36" rx="2" fill="#4682d2" opacity=".6"/>
  <rect x="188" y="197" width="136" height="10" fill="#fff"/>
  <rect x="214" y="195" width="84" height="210" fill="#fff"/>
  <rect x="214" y="245" width="84" height="10" fill="#4682d2" opacity=".5"/>
  <rect x="214" y="305" width="84" height="10" fill="#4682d2" opacity=".5"/>
  <rect x="184" y="370" width="144" height="52" rx="6" fill="#f0f5ff"/>
  <path d="M256 62 L230 140 H282 Z" fill="#b4d2ff" opacity=".25"/>
  <path d="M256 155 L180 210 H332 Z" fill="#b4d2ff" opacity=".15"/>
</svg>`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);
console.log('✔ icon.svg');
