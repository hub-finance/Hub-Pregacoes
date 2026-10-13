import type { StudyBrief } from '../../core/types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TONES = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#db2777'];

/**
 * O mapa da esquerda para a direita como um arquivo .html que abre sozinho
 * (sem internet e sem o app): ramos que abrem e fecham e a explicação de
 * cada item ao tocar.
 */
export function directionalMapHtml(title: string, brief: StudyBrief): string {
  const branches = brief.branches
    .map((b, i) => {
      const tone = TONES[i % TONES.length];
      const leaves = [
        ...(b.summary ? [`<li><button class="leaf sum" data-t="${esc(b.label)}" data-d="${esc(b.summary)}">Resumo do ramo<span class="nd">${esc(b.summary)}</span></button></li>`] : []),
        ...b.leaves.map(
          (l) =>
            `<li><button class="leaf" data-t="${esc(l.label)}" data-d="${esc(l.detail + (l.ref && !l.detail.includes(l.ref) ? ` (${l.ref})` : ''))}">${esc(l.label)}<span class="nd">${esc(l.detail)}</span></button></li>`,
        ),
      ].join('');
      return `<li class="br${i === 0 ? ' open' : ''}" style="--tone:${tone}"><button class="branch" aria-expanded="${i === 0}">${esc(b.label)}</button><ul class="leaves">${leaves}</ul></li>`;
    })
    .join('');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa mental — ${esc(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f7f8fb;color:#1f2430;padding:24px 16px}
h1{font-size:1.3rem;margin:0 0 4px}p.sub{margin:0 0 20px;color:#5b6270;font-size:.95rem}
.map{display:flex;align-items:flex-start;gap:28px;overflow-x:auto;padding-bottom:12px}
.root{flex:none;max-width:220px;background:#1f2a44;color:#fff;border:0;border-radius:14px;padding:16px 18px;font-weight:700;font-size:1rem;text-align:left;cursor:pointer;position:sticky;left:0}
ul{list-style:none;margin:0;padding:0}.branches{display:flex;flex-direction:column;gap:14px;border-left:2px solid #c9ced8;padding-left:22px}
.br{display:flex;align-items:flex-start;gap:22px;position:relative}.br::before{content:'';position:absolute;left:-22px;top:22px;width:20px;border-top:2px solid #c9ced8}
.branch{min-height:44px;min-width:160px;text-align:left;background:color-mix(in srgb,var(--tone) 12%,#fff);border:2px solid var(--tone);color:#1f2430;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}
.leaves{display:none;flex-direction:column;gap:8px;border-left:2px dashed color-mix(in srgb,var(--tone) 50%,#fff);padding-left:16px}.br.open .leaves{display:flex}
.leaf{min-height:40px;text-align:left;background:#fff;border:1px solid #d8dce4;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:.92rem}.leaf.sum{font-style:italic;color:#5b6270}
.leaf:focus-visible,.branch:focus-visible,.root:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
#d{margin-top:18px;background:#fff;border:1px solid #d8dce4;border-left:4px solid #2563eb;border-radius:10px;padding:14px 16px;display:none;max-width:720px}#d strong{display:block;margin-bottom:6px}#d p{margin:0;line-height:1.55}
.nd{display:none}.nojs .leaves{display:flex}.nojs .nd{display:block;font-weight:400;font-style:normal;color:#3d4452;margin-top:4px}.nojs .bar{display:none}.nojs .map{flex-direction:column}.nojs .root{position:static}
.bar{margin:0 0 16px;display:flex;gap:8px}.bar button{min-height:40px;border:1px solid #c9ced8;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
</style></head><body class="nojs">
<h1>${esc(title)}</h1><p class="sub">${esc(brief.thesis)}</p>
<div class="bar"><button id="all">Abrir todos os ramos</button></div>
<div class="map"><button class="root" data-t="${esc(title)}" data-d="${esc(brief.thesis)}">${esc(title)}</button><ul class="branches">${branches}</ul></div>
<div id="d" role="status" aria-live="polite"><strong></strong><p></p></div>
<script>
document.body.classList.remove('nojs');
var d=document.getElementById('d');
function show(t,x){d.querySelector('strong').textContent=t;d.querySelector('p').textContent=x;d.style.display='block';}
document.querySelectorAll('.branch').forEach(function(b){b.onclick=function(){var li=b.parentElement;li.classList.toggle('open');b.setAttribute('aria-expanded',li.classList.contains('open'));};});
document.querySelectorAll('.leaf,.root').forEach(function(b){b.onclick=function(){show(b.dataset.t,b.dataset.d);};});
document.getElementById('all').onclick=function(){var all=[].every.call(document.querySelectorAll('.br'),function(x){return x.classList.contains('open')});document.querySelectorAll('.br').forEach(function(x){x.classList.toggle('open',!all)});this.textContent=all?'Abrir todos os ramos':'Recolher tudo';};
</script></body></html>`;
}
