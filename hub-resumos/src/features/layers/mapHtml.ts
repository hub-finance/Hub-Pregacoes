import { buildStudyMap, MAP_KIND_LABEL, type MapKind } from '../../core/studyMap';
import type { StudyBrief } from '../../core/types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TONES = ['#2563eb', '#16a34a', '#7c3aed', '#ea580c', '#db2777'];
const ICON: Record<MapKind, string> = { virada: '★', ideia: '●', versiculo: '✚', conceito: '◆', pergunta: '?' };
const KIND_COLOR: Record<MapKind, string> = { virada: '#a67a22', ideia: '#2563eb', versiculo: '#1f6b52', conceito: '#8b1a2e', pergunta: '#7c3aed' };

/**
 * O mapa do estudo como um arquivo .html que abre sozinho (sem internet e sem
 * o app), igual ao da aba Compreender: ramos que abrem e fecham, filtros por
 * tipo e a explicação de cada item abrindo ali mesmo. Sem scripts (WhatsApp,
 * Drive), mostra tudo aberto, em texto.
 */
export function directionalMapHtml(title: string, brief: StudyBrief): string {
  const map = buildStudyMap(title, brief);
  const kinds = (Object.keys(MAP_KIND_LABEL) as MapKind[]).filter((k) => map.counts[k] > 0);
  const branches = map.branches
    .map((b, i) => {
      const items = b.items
        .map(
          (it) =>
            `<li class="it" data-k="${it.kind}"><button class="item" style="--k:${KIND_COLOR[it.kind]}"><span class="ic">${ICON[it.kind]}</span>${esc(it.label)}</button><div class="det"><p>${esc(it.detail)}</p>${it.ref ? `<span class="ref">${esc(it.ref)}</span>` : ''}${it.guess ? ' <span class="tag">sugestão</span>' : it.origin === 'ia' ? ' <span class="tag">inferência da IA</span>' : ''}</div></li>`,
        )
        .join('');
      return `<li class="br${i === 0 ? ' open' : ''}" style="--tone:${TONES[i % TONES.length]}"><button class="head" aria-expanded="${i === 0}"><span class="n">${i + 1}</span><span class="ht"><strong>${esc(b.label)}</strong>${b.summary ? `<span>${esc(b.summary)}</span>` : ''}</span><span class="cnt">${b.items.length}</span></button><ul class="items">${items}</ul></li>`;
    })
    .join('');
  const chips = [`<button class="chip on" data-f="">Tudo</button>`, ...kinds.map((k) => `<button class="chip" data-f="${k}">${ICON[k]} ${MAP_KIND_LABEL[k]} (${map.counts[k]})</button>`)].join('');
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mapa mental — ${esc(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f7f8fb;color:#1f2430;padding:20px 16px;line-height:1.45}
h1{font-size:1.3rem;margin:0 0 4px}.sub{margin:0 0 16px;color:#5b6270}
.tools{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}.chip,.tools .all{min-height:40px;border:1px solid #c9ced8;background:#fff;border-radius:999px;padding:6px 14px;cursor:pointer;font-size:.9rem}.chip.on{background:#1f2a44;color:#fff;border-color:#1f2a44}
.tree{display:grid;grid-template-columns:minmax(180px,230px) 1fr;gap:24px;align-items:start}
.root{position:sticky;top:12px;background:#1f2a44;color:#fff;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}.root span{font-size:.9rem;color:#dfe6f3}.root b{color:#e8b96a}
ul{list-style:none;margin:0;padding:0}.brs{border-left:2px solid #c9ced8;padding-left:18px;display:flex;flex-direction:column;gap:10px}
.br{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:14px;align-items:start;position:relative}.br::before{content:'';position:absolute;left:-18px;top:24px;width:16px;border-top:2px solid #c9ced8}
.head{display:flex;gap:10px;align-items:flex-start;width:100%;min-height:48px;text-align:left;padding:10px 12px;border-radius:12px;border:2px solid var(--tone);background:color-mix(in srgb,var(--tone) 9%,#fff);cursor:pointer;color:#1f2430;font:inherit}
.n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--tone);color:#fff;display:grid;place-items:center;font-weight:700;font-size:.8rem}.ht{display:flex;flex-direction:column;gap:2px;flex:1}.ht span{font-size:.86rem;color:#5b6270}.cnt{font-size:.8rem;color:#5b6270}
.items{display:none;flex-direction:column;gap:6px;border-left:2px dashed color-mix(in srgb,var(--tone) 45%,#fff);padding-left:10px}.br.open .items,.nojs .items{display:flex}
.item{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;text-align:left;padding:8px 12px;border-radius:10px;border:1px solid #d8dce4;background:#fff;cursor:pointer;font:inherit;color:#1f2430}
.ic{flex:none;width:22px;height:22px;border-radius:6px;background:var(--k);color:#fff;display:grid;place-items:center;font-size:.75rem;font-weight:700}
.det{display:none;margin:6px 0 4px 30px;padding:8px 12px;border-left:3px solid var(--tone);background:#fff;border-radius:0 10px 10px 0}.it.on .det,.nojs .det{display:block}.det p{margin:0 0 6px}
.ref{font-size:.8rem;font-weight:600;background:#e8eefc;border-radius:6px;padding:2px 8px}.tag{font-size:.75rem;border:1px dashed #a67a22;border-radius:999px;padding:1px 8px;color:#7a5a17}
.hide{display:none!important}.nojs .tools{display:none}
button:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
@media (max-width:900px){.br{grid-template-columns:1fr;gap:6px}}
@media (max-width:640px){.tree{grid-template-columns:1fr}.root{position:static}.det{margin-left:12px}}
</style></head><body class="nojs">
<h1>${esc(title)}</h1><p class="sub">Mapa mental do estudo · Hub Resumos</p>
<div class="tools">${chips}<button class="all" id="all">Abrir todos</button></div>
<div class="tree"><div class="root"><strong>${esc(title)}</strong>${map.thesis ? `<span>${esc(map.thesis)}</span>` : ''}${map.inflection?.turn ? `<span><b>★ A virada:</b> ${esc(map.inflection.turn)}</span>` : ''}</div><ul class="brs">${branches}</ul></div>
<script>
document.body.classList.remove('nojs');
var brs=[].slice.call(document.querySelectorAll('.br'));
brs.forEach(function(li){li.querySelector('.head').onclick=function(){li.classList.toggle('open');this.setAttribute('aria-expanded',li.classList.contains('open'));};});
[].forEach.call(document.querySelectorAll('.item'),function(b){b.onclick=function(){b.parentElement.classList.toggle('on');};});
document.getElementById('all').onclick=function(){var all=brs.every(function(x){return x.classList.contains('open')});brs.forEach(function(x){x.classList.toggle('open',!all)});this.textContent=all?'Abrir todos':'Recolher tudo';};
[].forEach.call(document.querySelectorAll('.chip'),function(c){c.onclick=function(){var f=c.getAttribute('data-f');[].forEach.call(document.querySelectorAll('.chip'),function(x){x.classList.toggle('on',x===c)});
brs.forEach(function(li){var n=0;[].forEach.call(li.querySelectorAll('.it'),function(it){var show=!f||it.getAttribute('data-k')===f;it.classList.toggle('hide',!show);if(show)n++;});li.classList.toggle('hide',!!f&&!n);if(f)li.classList.add('open');});};});
</script></body></html>`;
}
