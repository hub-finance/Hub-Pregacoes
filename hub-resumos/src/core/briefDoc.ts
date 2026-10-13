import { cleanTitle } from './text';
import type { StudyBrief } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
const iaMark = (origin: string) => (origin === 'ia' ? ' <span class="ia">(inferência da IA)</span>' : '');

const CARD_TITLE = { biblico: 'Cartões bíblicos', principio: 'Cartões de princípio', conexao: 'Cartões de conexão', revisao: 'Cartões de revisão' } as const;

/**
 * O estudo inteiro (as 4 camadas e o DNA) como documento do Word. É HTML no
 * formato que o Word abre e salva como .docx — sem biblioteca extra e sem
 * internet. A marca "inferência da IA" vai junto, para nunca se confundir com o texto.
 */
export function briefWordHtml(title: string, author: string, brief: StudyBrief): string {
  const steps = brief.steps
    .map(
      (s, i) =>
        `<tr><td class="n">${i + 1}</td><td><b>${esc(s.title)}</b>${iaMark(s.origin)}${s.question ? `<br><i>${esc(s.question)}</i>` : ''}${s.explanation ? `<br>${esc(s.explanation)}` : ''}${s.refs.length ? `<br><span class="ref">${esc(s.refs.join('; '))}</span>` : ''}${s.link && i < brief.steps.length - 1 ? `<br><span class="link">↓ ${esc(s.link)}</span>` : ''}</td></tr>`,
    )
    .join('');
  const branches = brief.branches
    .map((b) => `<li><b>${esc(b.label)}</b>${b.summary ? ` — ${esc(b.summary)}` : ''}${b.leaves.length ? `<ul>${b.leaves.map((l) => `<li><b>${esc(l.label)}:</b> ${esc(l.detail)}</li>`).join('')}</ul>` : ''}</li>`)
    .join('');
  const cards = (Object.keys(CARD_TITLE) as Array<keyof typeof CARD_TITLE>)
    .map((k) => {
      const cs = brief.cards.filter((c) => c.kind === k);
      if (!cs.length) return '';
      return `<h3>${CARD_TITLE[k]}</h3><table class="grid">${cs
        .map((c) => `<tr><td class="front"><b>${esc(c.front)}</b>${iaMark(c.origin)}</td><td>${esc(c.back)}${c.extra ? `<br><i>${esc(c.extra)}</i>` : ''}${c.ref && !c.front.includes(c.ref) ? `<br><span class="ref">${esc(c.ref)}</span>` : ''}</td></tr>`)
        .join('')}</table>`;
    })
    .join('');
  const rows = brief.dna.rows
    .map((r) => `<tr><td>${esc(r.principle)}${iaMark(r.origin)}</td><td>${esc(r.base)}</td><td>${esc(r.application)}</td></tr>`)
    .join('');
  const inf = brief.inflection;
  const guessMark = (g?: boolean) => (g ? ' <span class="ia">(sugestão)</span>' : '');
  const turnBlock = inf?.turn
    ? `<h3>Ponto de inflexão — a virada da mensagem</h3><table><tr><th>Antes</th><th>A virada</th><th>Depois</th></tr><tr><td>${esc(inf.before)}</td><td><b>${esc(inf.turn)}</b>${inf.ref ? `<br><span class="ref">${esc(inf.ref)}</span>` : ''}${iaMark(inf.origin)}${guessMark(inf.guess)}</td><td>${esc(inf.after)}</td></tr></table>`
    : '';
  const turns = (brief.chapterTurns ?? [])
    .map((t) => `<li><b>${esc(cleanTitle(t.section))}:</b> ${esc(t.turn)}${t.ref && !t.turn.includes(t.ref) ? ` <span class="ref">(${esc(t.ref)})</span>` : ''}${iaMark(t.origin)}${guessMark(t.guess)}</li>`)
    .join('');
  const source = brief.source === 'ia' ? `Estrutura montada pela IA${brief.model ? ` (${esc(brief.model)})` : ''}${brief.editedAt ? ' e revisada pelo usuário' : ''}.` : 'Estrutura montada só com o texto do material.';

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2430;line-height:1.4}
h1{font-size:20pt;margin:0}h2{font-size:14pt;color:#1f4f3f;border-bottom:1px solid #c9ced8;padding-bottom:3pt;margin-top:18pt}h3{font-size:12pt;margin:12pt 0 4pt}
.sub{color:#5b6270}.tese{background:#e4f0ea;border-left:4pt solid #1f6b52;padding:6pt 10pt;font-weight:bold}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #c9ced8;padding:5pt 7pt;vertical-align:top;text-align:left}th{background:#eef1f5}
td.n{width:22pt;text-align:center;font-weight:bold}td.front{width:38%}.ref{color:#2b5797;font-weight:bold}.link{color:#5b6270}.ia{color:#8a5a00;font-size:9pt}
</style></head><body>
<h1>${esc(title)}</h1>${author ? `<p class="sub">${esc(author)}</p>` : ''}
<p class="sub">${source}</p>

<h2>1. Captar — síntese central</h2>
${brief.baseText.length ? `<p><b>Texto-base:</b> <span class="ref">${esc(brief.baseText.join('; '))}</span></p>` : ''}
${brief.synthesis ? `<p>${esc(brief.synthesis)}</p>` : ''}
<p class="tese">${esc(brief.thesis)}</p>
${brief.objective ? `<p><b>Objetivo:</b> ${esc(brief.objective)}</p>` : ''}
${brief.truths.length ? `<h3>Principais verdades</h3>${list(brief.truths.map((t) => t.text + (t.origin === 'ia' ? ' (inferência da IA)' : '')))}` : ''}

${turnBlock}
<h2>2. Compreender — progressão do estudo</h2>
<table>${steps}</table>
${turns ? `<h3>As viradas de cada parte</h3><ol>${turns}</ol>` : ''}
${branches ? `<h3>Mapa mental</h3><ul>${branches}</ul>` : ''}

<h2>3. Aprofundar — cartões de estudo</h2>
${cards || '<p class="sub">Sem cartões.</p>'}

<h2>4. Aplicar e recordar</h2>
${brief.applications.length ? `<h3>Aplicações</h3>${list(brief.applications)}` : ''}
${brief.questions.length ? `<h3>Perguntas</h3>${list(brief.questions)}` : ''}

<h2>DNA da mensagem</h2>
<p class="tese">${esc(brief.dna.thesis)}</p>
${brief.dna.convictions.length ? `<h3>Convicções</h3>${list(brief.dna.convictions)}` : ''}
${rows ? `<table><tr><th>1. Princípio (o quê)</th><th>2. Base bíblica (onde)</th><th>3. Aplicação prática (como)</th></tr>${rows}</table>` : ''}
${brief.dna.outcome ? `<p><b>Resultado esperado:</b> ${esc(brief.dna.outcome)}</p>` : ''}
</body></html>`;
}
