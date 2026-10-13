/**
 * Gera os PNG do ícone a partir de public/icons/icon.svg, usando o Chromium
 * do Playwright (já presente no ambiente de desenvolvimento).
 *
 * Uso: node scripts/icons.mjs [caminho-do-playwright]
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const icons = join(here, '..', 'public', 'icons');
const svg = readFileSync(join(icons, 'icon.svg'), 'utf8');
const { chromium } = await import(process.argv[2] ?? 'playwright');

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  // no ícone "maskable" o desenho fica dentro da zona segura, sobre fundo cheio
  const inner = maskable ? Math.round(size * 0.78) : size;
  await page.setContent(
    `<html><body style="margin:0;background:${maskable ? '#1d5c4d' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: join(icons, name), omitBackground: !maskable });
}
await browser.close();
console.log('ícones gerados');
