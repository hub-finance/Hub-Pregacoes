import engineSource from './engine.js?raw';
import { MIND_COLORS, type MindMapData } from '../../core/mindmap';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * O mapa como um arquivo .html que abre sozinho em qualquer navegador — sem
 * internet e sem o Hub Resumos. Leva o mesmo motor do app e os dados do mapa.
 */
export function mindMapHtml(data: MindMapData): string {
  const c = MIND_COLORS;
  // "<" escapado: nenhum texto do material consegue fechar o <script>
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const engine = engineSource.replace(/export\s*\{\s*createMindMap\s*\};?\s*$/, '');
  const legend = data.legend
    .map((l) => `<div class="li"><span class="dot" style="background:${l.color}"></span>${esc(l.label)}</div>`)
    .join('');
  // Versão em texto: aparece quando o arquivo é aberto num visualizador que não
  // roda o mapa (WhatsApp, Drive, gerenciador de arquivos) — antes ficava em branco.
  const plain = data.modules
    .map(
      (m) =>
        `<section><h2>${esc(m.tip.title)}</h2>${m.tip.body ? `<p>${esc(m.tip.body)}</p>` : ''}<ul>${m.children
          .map((ch) => `<li><b>${esc(ch.tip.title)}</b>${ch.tip.body ? ` — ${esc(ch.tip.body)}` : ''}</li>`)
          .join('')}</ul></section>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa mental — ${esc(data.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:${c.fundo};font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;color:${c.texto}}
#canvas{position:fixed;inset:0;width:100vw;height:100vh;cursor:grab;touch-action:none;display:block}
.badge{position:fixed;top:12px;left:12px;z-index:5;background:rgba(13,27,42,.92);border-left:4px solid ${c.ouro};padding:10px 16px;border-radius:0 8px 8px 0;max-width:calc(100vw - 24px)}
.badge h1{color:${c.ouro};font-size:17px;letter-spacing:.5px}
.badge p{color:${c.apagado};font-size:12px;margin-top:3px}
.controls{position:fixed;top:12px;right:12px;z-index:5;display:flex;flex-direction:column;gap:8px}
.btn{background:#1A2E44;color:${c.ouro};border:1px solid ${c.ouro};min-height:44px;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;white-space:nowrap}
.btn:hover,.btn:focus-visible{background:${c.ouro};color:${c.fundo};outline:none}
.legend{position:fixed;bottom:12px;left:12px;z-index:5;background:rgba(13,27,42,.92);border:1px solid #1A2E44;border-radius:8px;padding:12px 16px;color:${c.apagado};font-size:13px}
.legend h2{color:${c.ouro};font-size:13px;margin-bottom:8px;letter-spacing:1px}
.li{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.dot{width:13px;height:13px;border-radius:50%;flex-shrink:0}
.hint{margin-top:6px;font-size:11px;color:#6A7B90}
#tip{position:fixed;z-index:10;background:${c.painel};border:1px solid ${c.ouro};border-radius:8px;padding:14px 18px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:none;max-height:60vh;overflow:auto}
#tip h3{color:${c.ouro};font-size:16px;margin-bottom:6px}
#tip p{color:${c.texto};font-size:14px;line-height:1.55;white-space:pre-line}
#tip .src{color:${c.apagado};font-size:12px;margin-top:8px;font-style:italic}
#tip.fixed{left:12px!important;right:12px;bottom:12px;top:auto!important;max-width:none}
#tip .close{display:none;float:right;background:none;border:0;color:${c.ouro};font-size:22px;cursor:pointer;min-width:44px;min-height:44px;margin:-12px -14px 0 0}
#tip.fixed .close{display:block}
#plain{display:none;padding:110px 16px 24px;max-width:760px;margin:0 auto}
#plain .note{background:#1A2E44;border:1px solid ${c.ouro};border-radius:8px;padding:10px 14px;color:${c.texto};font-size:14px;margin-bottom:16px}
#plain h2{color:${c.ouro};font-size:17px;margin:18px 0 6px}#plain p{line-height:1.55;margin-bottom:6px}#plain ul{padding-left:20px}#plain li{line-height:1.5;margin-bottom:6px}#plain b{color:${c.ouro}}
body.nojs{overflow:auto}.nojs #canvas,.nojs .controls,.nojs .legend{display:none}.nojs #plain{display:block}.nojs .badge{position:absolute}
@media (max-width:640px){.controls{flex-direction:row;flex-wrap:wrap;top:auto;bottom:12px;right:12px;left:12px;justify-content:flex-end}.legend{display:none}.badge h1{font-size:15px}}
</style>
</head>
<body class="nojs">
<canvas id="canvas" aria-label="Mapa mental de ${esc(data.title)}"></canvas>
<div class="badge"><h1>${esc(data.title)}</h1><p>${esc(data.subtitle)}</p></div>
<div class="controls">
<button class="btn" id="fs">⛶ Tela cheia</button>
<button class="btn" id="reset">⟲ Resetar</button>
<button class="btn" id="zin" aria-label="Aproximar">＋ Zoom</button>
<button class="btn" id="zout" aria-label="Afastar">－ Zoom</button>
<button class="btn" id="all">⊞ Expandir tudo</button>
</div>
<div class="legend"><h2>LEGENDA</h2>${legend}<div class="hint">Arraste · role para zoom · toque para abrir</div></div>
<div id="plain"><p class="note">Para usar o mapa interativo (tocar nos círculos, aproximar e arrastar), abra este arquivo no navegador, como o Chrome. Abaixo, o conteúdo do mapa em texto.</p>${data.center.tip.body ? `<p>${esc(data.center.tip.body)}</p>` : ''}${plain}</div>
<div id="tip" role="dialog" aria-live="polite"><button class="close" id="tipx" aria-label="Fechar">×</button><h3 id="tt"></h3><p id="tb"></p><div class="src" id="ts"></div></div>
<script>
${engine}
(function(){
document.body.classList.remove('nojs');
var data=${json};
var tip=document.getElementById('tip');
function show(node,x,y,fixed){
  if(!node){if(!tip.classList.contains('fixed'))tip.style.display='none';return;}
  document.getElementById('tt').textContent=node.tip.title||'';
  document.getElementById('tb').textContent=node.tip.body||'';
  document.getElementById('ts').textContent=node.tip.source||'';
  tip.classList.toggle('fixed',!!fixed);
  tip.style.display='block';
  if(!fixed){var w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.min(x+16,innerWidth-w-8)+'px';tip.style.top=Math.min(y+16,innerHeight-h-8)+'px';}
}
var map=createMindMap(document.getElementById('canvas'),data,{
  onHover:function(n,x,y){if(matchMedia('(hover: hover)').matches)show(n,x,y,false);},
  onSelect:function(n){if(!matchMedia('(hover: hover)').matches)show(n,0,0,true);},
  insets:function(f,w){return w>640?{t:90,r:170,b:20,l:20}:{t:80,r:10,b:120,l:10};}
});
document.getElementById('tipx').onclick=function(){tip.classList.remove('fixed');tip.style.display='none';};
document.getElementById('reset').onclick=function(){map.reset();};
document.getElementById('zin').onclick=function(){map.zoom(1.2);};
document.getElementById('zout').onclick=function(){map.zoom(0.8);};
document.getElementById('all').onclick=function(){this.textContent=map.toggleAll()?'⊟ Recolher tudo':'⊞ Expandir tudo';};
document.getElementById('fs').onclick=function(){if(document.fullscreenElement)document.exitFullscreen();else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen();};
})();
</script>
</body>
</html>
`;
}
