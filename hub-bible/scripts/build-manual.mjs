/**
 * Gera `public/manual.html`, o manual em página única, a partir dos mesmos
 * tópicos da Ajuda (`src/features/help/topics.ts`).
 *
 * Antes o manual era escrito à mão e ficou meses atrás da Ajuda. Agora roda a
 * cada `npm run build`: mudou a Ajuda, mudou o manual. Usa sempre a edição
 * completa, que é a do site.
 *
 * Uso: node scripts/build-manual.mjs
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/manual.html');

const bundled = await build({
  entryPoints: [join(root, 'src/features/help/topics.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  define: { __HUB_EDITION__: '"completa"', __HUB_BUILD__: '"0"' },
  logLevel: 'silent',
});
const code = bundled.outputFiles[0].text;
const { TOPICS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = (t) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// o estilo do manual continua o mesmo: é lido do arquivo atual
const current = readFileSync(out, 'utf8');
const style = current.slice(current.indexOf('<style>'), current.indexOf('</style>') + '</style>'.length);

const step = (s) =>
  typeof s === 'string'
    ? `<li>${esc(s)}</li>`
    : `<li>${esc(s.text)} <a class="no-print" href="./index.html#${esc(s.to)}">${esc(s.label)} →</a></li>`;

const sections = TOPICS.map((t, i) => `
<section id="${slug(t.title)}">
  <h2><span class="num">${i + 1}</span>${esc(t.title)}</h2>
  <ol class="steps">
    ${t.steps.map(step).join('\n    ')}
  </ol>
</section>`).join('\n');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Farol da Palavra — Manual de uso</title>
<meta name="description" content="Manual completo do Farol da Palavra: o mesmo conteúdo da Ajuda do aplicativo, em uma página." />
<!-- Gerado por scripts/build-manual.mjs a partir de src/features/help/topics.ts. Não edite à mão. -->
${style}
</head>
<body>
<div class="wrap">

<div class="back-bar no-print">
  <a href="./index.html#/ajuda">← Voltar ao aplicativo</a>
</div>

<header class="cover">
  <div class="brand">
    <div class="brand-mark">FP</div>
    <div>
      <div class="brand-name">Farol da Palavra</div>
      <div class="brand-sub">Bíblia e ministério</div>
    </div>
  </div>
  <h1>Manual de uso</h1>
  <p class="lead">
    Tudo o que o aplicativo faz, explicado passo a passo — o mesmo conteúdo da Ajuda.
    Guarde, imprima ou envie para quem for usar o Farol da Palavra com você.
  </p>
</header>

<nav class="toc">
  <h2>Neste manual</h2>
  <ol>
    ${TOPICS.map((t) => `<li><a href="#${slug(t.title)}">${esc(t.title)}</a></li>`).join('\n    ')}
  </ol>
</nav>
${sections}

<footer>
  <p>
    <strong>Farol da Palavra</strong> — Bíblia e ministério. Aplicativo instalável, sem cadastro e sem
    servidor: seus dados ficam no seu aparelho.
  </p>
  <p class="no-print">
    Para guardar em PDF: use a opção <strong>Imprimir</strong> do navegador e escolha
    “Salvar como PDF”.
  </p>
</footer>

</div>
</body>
</html>
`;
writeFileSync(out, html);
console.log(`manual.html: ${TOPICS.length} tópicos, ${TOPICS.reduce((n, t) => n + t.steps.length, 0)} passos`);
