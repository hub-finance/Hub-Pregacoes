/**
 * Gera public/mensagem-html.pdf: o passo a passo da mensagem em HTML
 * (importar, tópicos, assuntos, letra, PDF, Modo Pregação, Bíblia ao lado),
 * com fotos reais do app abrindo exemplo-mensagem.html.
 *
 * As fotos saem da edição 2.0 (sem Rhema nem Escola no menu), que serve às duas.
 * Uso, de hub-bible/:  HUB_EDITION=reduzida npm run build && npx vite preview --port 4181 &
 *        NODE_PATH=<pasta com playwright> CHROMIUM=<chromium, opcional> \
 *        node docs/manual-mensagem-html/gerar.mjs
 * Para refazer a mensagem de exemplo: montar-exemplo.py (lê conteudo-exemplo.json).
 */
import { createRequire } from 'node:module';
// Playwright não é dependência do projeto: vem de NODE_PATH (veja o uso acima).
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const base = process.env.BASE ?? 'http://127.0.0.1:4181/';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'fotos-html-'));
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('g')) { sessionStorage.setItem('g', '1'); localStorage.setItem('hub-bible:appearance', JSON.stringify({ theme: 'marinho', onboarded: true, preachingMinutes: 45 })); } localStorage.setItem('hub-bible:novidades:visto', '2026-11-25-temas'); } catch (e) {} });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const F = () => p.frameLocator('iframe.doc-html-frame');
// marca dourada numerada sobre os pontos de toque (desenhada na página do app)
const mark = async (items) => {
  const boxes = [];
  for (const [loc, n] of items) { const bb = await loc.boundingBox(); if (bb) boxes.push({ ...bb, n }); }
  await p.evaluate((boxes) => {
    for (const b of boxes) {
      const d = document.createElement('div');
      d.className = 'guia-marca';
      Object.assign(d.style, { position: 'fixed', left: `${b.x - 6}px`, top: `${b.y - 6}px`, width: `${b.width + 12}px`, height: `${b.height + 12}px`, border: '4px solid #e0a100', borderRadius: '14px', boxShadow: '0 0 0 3px rgba(255,255,255,.9), 0 6px 18px rgba(0,0,0,.35)', zIndex: 99999, pointerEvents: 'none' });
      const n = document.createElement('div');
      n.textContent = b.n;
      Object.assign(n.style, { position: 'absolute', top: b.y < 40 ? 'auto' : '-18px', bottom: b.y < 40 ? '-18px' : 'auto', left: b.x < 30 ? '4px' : '-18px', width: '32px', height: '32px', borderRadius: '50%', background: '#e0a100', color: '#082038', font: '800 18px/32px Inter, sans-serif', textAlign: 'center', border: '3px solid #fff' });
      d.appendChild(n);
      document.body.appendChild(d);
    }
  }, boxes);
};
const shot = async (name) => { await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80 }); await p.evaluate(() => document.querySelectorAll('.guia-marca').forEach((e) => e.remove())); };

// 1. Gerador: Importar
await p.goto(base + '#/sermoes', { waitUntil: 'networkidle' });
await p.getByRole('button', { name: 'Ok' }).click().catch(() => {});
await p.waitForTimeout(600);
await mark([[p.getByRole('button', { name: /Importar/ }).first(), 1]]);
await shot('01-importar');
// 2. importada
await p.locator('input[type=file]').first().setInputFiles(path.join(AQUI, 'exemplo-mensagem.html'));
await p.waitForURL(/#\/sermoes\/./); await p.waitForTimeout(2500);
const id = p.url().split('#/sermoes/')[1];
await mark([[p.locator('input').first(), 1], [p.locator('iframe.doc-html-frame'), 2]]);
await shot('02-importada');
// 3. navegar: tópico, próximo, setas
await mark([[F().locator('#pos'), 1], [F().locator('#nxt'), 2], [F().locator('#bp'), 3], [F().locator('#bn'), 3]]);
await shot('03-navegar');
// 4. menu: módulos e assuntos
await F().locator('#cfg').click(); await p.waitForTimeout(700);
await mark([[F().locator('#list .it:not(.sub2)').nth(2), 1], [F().locator('#list .sub2').nth(1), 2]]);
await shot('04-menu');
// 5. ir a um assunto e marcar onde parou
await F().locator('#list .sub2').nth(1).click(); await p.waitForTimeout(1500);
await F().locator('.slide').nth(1).locator('p.k').nth(3).click(); await p.waitForTimeout(400);
await mark([[F().locator('.slide').nth(1).locator('p.k').nth(3), 1], [F().locator('#back'), 2]]);
await shot('05-marcar');
// 6. cronômetro e letra da mensagem
await F().locator('#tgo').click(); await p.waitForTimeout(2200);
await F().locator('#fsp').click(); await F().locator('#fsp').click(); await p.waitForTimeout(300);
await mark([[F().locator('.box').first(), 1], [F().locator('#tmr'), 2], [F().locator('#fsm'), 3], [F().locator('#fsp'), 3]]);
await shot('06-cronometro-letra');
await F().locator('#tgo').click();
// 7. PDF e imprimir
// tocar na mensagem rola a página do app; volta ao topo para a barra do arquivo aparecer
await p.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0; }); }); await p.waitForTimeout(400);
await mark([[p.getByRole('button', { name: 'Imprimir a mensagem' }), 1], [p.getByRole('button', { name: 'Gerar PDF da mensagem' }), 2]]);
await shot('07-pdf');
// 8. abrir o Modo Pregação
await p.getByRole('button', { name: 'Mais ações' }).click(); await p.waitForTimeout(500);
await mark([[p.getByRole('button', { name: 'Mais ações' }), 1], [p.getByRole('button', { name: 'Modo Pregação' }), 2]]);
await shot('08-abrir-pregacao');
// 9. só a mensagem
await p.getByRole('button', { name: 'Modo Pregação' }).click(); await p.waitForTimeout(2500);
await mark([[p.getByRole('button', { name: 'Abrir a Bíblia ao lado' }), 1], [p.getByRole('button', { name: 'Sair' }), 2]]);
await shot('09-so-mensagem');
// 10. letra da mensagem pela barra
await mark([[p.getByRole('button', { name: 'Diminuir a letra da mensagem' }), 1], [p.getByRole('button', { name: 'Aumentar a letra da mensagem' }), 1], [p.locator('.preach-timer-clock').first(), 2]]);
await shot('10-letra-barra');
// 11. Bíblia ao lado
await p.getByRole('button', { name: 'Abrir a Bíblia ao lado' }).click(); await p.waitForTimeout(1800);
await mark([[p.getByRole('button', { name: 'Fechar a Bíblia ao lado' }), 1], [p.locator('[aria-label="Bíblia"]').first(), 2]]);
await shot('11-lado-a-lado');
// 12. tamanho da Bíblia, capítulo, divisória
await p.getByRole('button', { name: 'Aumentar a letra da Bíblia' }).click(); await p.waitForTimeout(300);
await mark([[p.getByRole('button', { name: 'Trocar de livro ou capítulo' }), 1], [p.getByRole('button', { name: 'Diminuir a letra da Bíblia' }), 2], [p.getByRole('button', { name: 'Aumentar a letra da Bíblia' }), 2], [p.locator('.split-handle').first(), 3]]);
await shot('12-biblia-ajustes');
// 13. escolher capítulo
await p.getByRole('button', { name: 'Trocar de livro ou capítulo' }).click(); await p.waitForTimeout(900);
await shot('13-escolher-capitulo');
await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(400);
if (errors.length) { console.error('erros na página:', errors); process.exit(1); }

// ——— apresentação em PDF ———
const FONTES = path.join(RAIZ, 'public/fonts');
const slides = [
 ['01-importar','Importar a mensagem','Gerador de Mensagem',['Toque em <b>Importar</b> e escolha o arquivo <b>.html</b> do celular ou do computador.','O app aceita a mensagem por tópicos ou uma página A4. Ela fica guardada só no aparelho.']],
 ['02-importada','A mensagem abre pronta','Gerador de Mensagem',['O título é lido de dentro do arquivo.','A mensagem já funciona dentro do app: nada a converter.']],
 ['03-navegar','Andar pelos tópicos (módulos)','Dentro da mensagem',['<b>Tópico N de 7</b> mostra onde você está.','<b>Próximo</b> mostra o tópico seguinte; toque para escolher outro.','As setas <b>‹ ›</b> passam de um tópico ao outro.']],
 ['04-menu','Ir direto a um assunto','Menu ☰',['Os <b>tópicos</b> da mensagem, um por linha.','Os <b>assuntos</b> (subtítulos) de cada tópico. Toque e vá direto.']],
 ['05-marcar','Marcar onde parou','Dentro da mensagem',['Toque num parágrafo para marcar onde você parou.','<b>Voltar ao ponto</b> leva de volta à marca.']],
 ['06-cronometro-letra','Relógio, tempo e letra','Topo da mensagem',['<b>Hora atual</b>.','<b>Tempo da mensagem</b> com a meta: toque em ▶ para contar.','<b>A− / A+</b> mudam o tamanho da letra da mensagem.']],
 ['07-pdf','Imprimir ou gerar PDF','Barra do arquivo',['<b>Imprimir</b> (no site, pelo navegador).','<b>PDF</b> gera o arquivo para imprimir ou enviar; no aplicativo fica em Documentos.']],
 ['08-abrir-pregacao','Abrir o Modo Pregação','Barra do arquivo',['Toque em <b>…</b> (Mais ações).','Escolha <b>Modo Pregação</b>: tela cheia, só a mensagem.']],
 ['09-so-mensagem','Modo Pregação: só a mensagem','Tela cheia',['<b>Bíblia ao lado</b> abre a Bíblia junto da mensagem.','<b>✕</b> sai do Modo Pregação. A barra de baixo fica sempre à vista.']],
 ['10-letra-barra','Tamanho da mensagem e tempo','Modo Pregação',['<b>A− / A+</b> na barra de baixo mudam a letra da mensagem.','O cronômetro do alto conta o culto, com a meta escolhida (ex.: <b>45 min ▾</b>).']],
 ['11-lado-a-lado','Bíblia e mensagem lado a lado','Modo Pregação',['O mesmo botão abre e fecha a Bíblia.','A Bíblia fica ao lado, na passagem que você escolher.']],
 ['12-biblia-ajustes','Tamanho da Bíblia','Lado a lado',['Escolha o <b>livro e o capítulo</b>.','<b>A− / A+</b> da Bíblia mudam só a letra da Bíblia.','Arraste a <b>divisória</b> para dar mais espaço à Bíblia ou à mensagem.']],
 ['13-escolher-capitulo','Escolher a passagem','Lado a lado',['Toque no livro e depois no capítulo.','A mensagem continua onde estava.']],
];
const img = (n) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(OUT, n + '.jpg')).toString('base64');
const steps = (l) => l.map((t, i) => `<li><span class="n">${i + 1}</span><span>${t}</span></li>`).join('');
const body = [
 `<section class="cover"><div class="kicker">Farol da Palavra · Gerador de Mensagem</div><h1>Mensagem em HTML</h1><p>Como importar, andar pelos tópicos e assuntos, ajustar a letra, pregar só com a mensagem ou com a Bíblia ao lado.</p><ol class="toc"><li>Importar</li><li>Tópicos e assuntos</li><li>Marcar, tempo e letra</li><li>PDF</li><li>Modo Pregação</li><li>Bíblia lado a lado</li></ol></section>`,
 ...slides.map(([f, t, k, l], i) => `<section><div class="txt"><div class="pg">${String(i + 1).padStart(2, '0')}</div><div class="kicker">${k}</div><h2>${t}</h2><ol>${steps(l)}</ol><p class="hint">Os números dourados na tela correspondem aos passos.</p></div><div class="shot"><img src="${img(f)}"></div></section>`),
 `<section class="cover end"><div class="kicker">Para lembrar</div><h1>Dicas</h1><ul class="tips"><li>Nos <b>Cursos</b> (e, na edição completa, no <b>Rhema</b> e na <b>Escola de Ministros</b>) a mensagem em HTML funciona igual, também no <b>Modo Aula</b>.</li><li>O arquivo fica só no seu aparelho. Faça backup em Configurações › Backup e privacidade.</li><li>Para atualizar o aplicativo, instale por cima. <b>Nunca desinstale</b>.</li></ul></section>`,
].join('');
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
@font-face{font-family:SS;src:url(file://${FONTES}/SourceSans3-Regular.ttf)}@font-face{font-family:SS;font-weight:700;src:url(file://${FONTES}/SourceSans3-Bold.ttf)}
@font-face{font-family:Lora;font-weight:700;src:url(file://${FONTES}/Lora-Bold.ttf)}
@page{size:1600px 900px;margin:0}*{box-sizing:border-box}body{margin:0;font-family:SS;color:#1E2A3E}
section{width:1600px;height:900px;page-break-after:always;display:flex;background:#082038;padding:40px;gap:36px;align-items:center;overflow:hidden}
.txt{width:420px;color:#fff;align-self:stretch;display:flex;flex-direction:column;justify-content:center}
.pg{font:700 64px Lora;color:#cea965;line-height:1}.kicker{color:#cea965;text-transform:uppercase;letter-spacing:.12em;font-size:18px;font-weight:700;margin-top:14px}
h2{font:700 40px/1.15 Lora;margin:10px 0 26px}ol{list-style:none;padding:0;margin:0}
ol li{display:flex;gap:14px;font-size:23px;line-height:1.35;margin-bottom:18px}b{color:#f0d99c}
.n{flex:none;width:34px;height:34px;border-radius:50%;background:#cea965;color:#082038;font-weight:700;display:grid;place-items:center;font-size:19px;margin-top:-1px}
.hint{color:#9fb0c8;font-size:16px;margin-top:auto}
.shot{flex:1;background:#fff;border-radius:16px;padding:10px;border:3px solid #cea965}.shot img{width:100%;display:block;border-radius:8px}
.cover{flex-direction:column;align-items:flex-start;justify-content:center;padding:100px 140px;color:#fff;border-left:18px solid #cea965}
.cover h1{font:700 88px Lora;margin:10px 0 20px}.cover p{font-size:30px;max-width:1100px;line-height:1.4;color:#dfe6f0}
.toc{display:grid;grid-template-columns:repeat(3,auto);gap:14px 60px;margin-top:40px;counter-reset:c}.toc li{font-size:26px;counter-increment:c}.toc li::before{content:counter(c)". ";color:#cea965;font-weight:700}
.tips{font-size:30px;line-height:1.45;max-width:1200px;padding-left:30px}.tips li{margin-bottom:22px}.tips li::marker{color:#cea965}
</style><body>${body}</body></html>`;
const HTML = path.join(OUT, 'apresentacao.html');
fs.writeFileSync(HTML, html);
const pg = await ctx.newPage();
await pg.setViewportSize({ width: 1600, height: 900 });
await pg.goto('file://' + HTML); await pg.evaluate(() => document.fonts.ready);
await pg.pdf({ path: path.join(RAIZ, 'public/mensagem-html.pdf'), width: '1600px', height: '900px', printBackground: true, preferCSSPageSize: true });
await b.close();
fs.rmSync(OUT, { recursive: true, force: true });
console.log('public/mensagem-html.pdf gerado');
