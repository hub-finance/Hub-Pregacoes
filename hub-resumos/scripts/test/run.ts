import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { findReferences, hubBibleLink } from '../../src/core/bible';
import { readMaterial, splitIntoSections } from '../../src/core/text';
import { suggestCards, addCards, answerCard, schedule } from '../../src/core/cards';
import { suggestActions, addActions, listActions } from '../../src/core/actions';
import { extractiveSummary } from '../../src/core/summary';
import { buildMindMap, circleLabel, MAX_POINTS } from '../../src/core/mindmap';
import { docxToText, readHubBackup } from '../../src/core/importers';
import { createMaterial, deleteMaterial, getProgress, progressRatio, resplitMaterial, setStepDone } from '../../src/core/materials';
import { createBackup, hubStudyBackup, importMaterialFile, materialFile, restoreBackup } from '../../src/core/backup';
import { createExampleMaterial } from '../../src/core/example';
import { boardContent } from '../../src/core/boards';
import { db } from '../../src/core/db';
import type { Card } from '../../src/core/types';

let passed = 0;
let failed = 0;
const lines: string[] = [];
async function test(name: string, fn: () => unknown) {
  try {
    await fn();
    passed++;
    lines.push(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    lines.push(`  ✘ ${name}\n      ${(err as Error).message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const TEXT = `# Introdução
A graça de Deus é o fundamento da vida cristã. Ela não depende do nosso esforço (Ef 2.8-9).
> A graça é favor imerecido que transforma.
Graça: favor de Deus que não merecemos.
Fé: confiança na fidelidade de Deus.

# A graça que salva
Como somos salvos? Pela graça, mediante a fé — João 3:16 e Romanos 5:1 mostram isso.
Somos salvos pela graça, e a fé é o meio pelo qual recebemos o presente de Deus.
- Graça precede a fé
- Fé recebe a graça
- Obras são fruto, não causa
Os 3 pontos acima resumem a doutrina. Is 2 vezes não é referência.

# Aplicação
- Agradecer diariamente pela graça
- [ ] Ler Efésios 2 nesta semana
- Compartilhar o evangelho com um amigo
`;

await test('referências bíblicas no texto (sem confundir palavras comuns)', () => {
  const refs = findReferences('Leia Ef 2.8-9, João 3:16, 1 Co 13 e Rm 8:28. Os 3 pontos; Is 2 vezes; ex: 3 itens.').map((r) => r.label);
  assert(refs.join('|') === 'Efésios 2:8-9|João 3:16|1 Coríntios 13|Romanos 8:28', refs.join('|'));
  const link = hubBibleLink('https://hub.exemplo.app/', { osis: 'JHN', chapter: 3, verse: 16 });
  assert(link === 'https://hub.exemplo.app/index.html#/biblia/JHN/3?v=16', String(link));
  assert(hubBibleLink('', { osis: 'JHN', chapter: 3 }) === null, 'sem endereço não há link');
});

await test('texto corrido vira seções pelos títulos', () => {
  const parts = splitIntoSections('Apresentação do livro.\n\nCAPÍTULO 1 — O COMEÇO\nTexto um.\n\n## Segunda parte\nTexto dois.', 'Introdução');
  assert(parts.map((p) => p.title).join('|') === 'Introdução|CAPÍTULO 1 — O COMEÇO|Segunda parte', parts.map((p) => p.title).join('|'));
});

await test('livro: segue o sumário, sem ficha catalográfica nem cabeçalhos de página', () => {
  const para = (n: number) => Array.from({ length: n }, (_, i) => `Frase ${i + 1} do capítulo, com conteúdo de verdade para ler.`).join(' ');
  const book = [
    'JOHN C. MAXWELL',
    'AS 21 IRREFUTÁVEIS LEIS DA LIDERANÇA',
    'TRADUÇÃO DE',
    'VALÉRIA LAMIM DELGADO FERNANDES',
    'CIP-BRASIL. CATALOGAÇÃO-NA-FONTE',
    'ISBN 978-85-6030-312-0',
    '07-1021. CDD: 658.4092',
    '',
    'SUMÁRIO',
    'Introdução ......................... 9',
    '1. A lei do limite ................ 15',
    '2. A lei da influência ............ 27',
    '3. A lei do processo                41',
    '',
    'INTRODUÇÃO',
    para(30),
    'AS 21 IRREFUTÁVEIS LEIS DA LIDERANÇA',
    para(10),
    'CAPÍTULO 1',
    'A LEI DO LIMITE',
    para(40),
    'AS 21 IRREFUTÁVEIS LEIS DA LIDERANÇA',
    'CAPÍTULO 2',
    'A LEI DA INFLUÊNCIA',
    para(40),
    'AS 21 IRREFUTÁVEIS LEIS DA LIDERANÇA',
    'CAPÍTULO 3',
    'A LEI DO PROCESSO',
    para(40),
  ].join('\n');
  const parts = splitIntoSections(book, 'Introdução');
  assert(parts.map((p) => p.title).join('|') === 'Introdução|1. A lei do limite|2. A lei da influência|3. A lei do processo', parts.map((p) => p.title).join('|'));
  assert(!parts.some((p) => /ISBN|CDD/.test(p.text)), 'ficha catalográfica fora');
  assert(parts.every((p) => p.text.length > 100), 'cada capítulo com o seu texto');

  // sem sumário: ficha catalográfica e cabeçalho repetido não viram capítulo
  const noToc = book.replace(/SUMÁRIO[\s\S]*?\n\n/, '');
  const p2 = splitIntoSections(noToc, 'Introdução');
  assert(p2.length <= 6, `${p2.length} partes: ${p2.map((p) => p.title).join('|')}`);
  assert(!p2.some((p) => /isbn|cdd|cip/i.test(p.title)), 'nada de ISBN como título');
  assert(p2.some((p) => /Capítulo 1 — A LEI DO LIMITE/i.test(p.title)), p2.map((p) => p.title).join('|'));
});

await test('livro já importado: reorganiza pelo sumário', async () => {
  const para = 'Texto do capítulo com várias palavras para ler com calma. '.repeat(20);
  // como a leitura antiga dividia: cada linha em maiúsculas virava uma parte
  const old = await createMaterial({
    title: 'Livro antigo',
    kind: 'livro',
    sections: [
      { title: 'Maxwell', text: '' },
      { title: 'Isbn 978-85-6030-312-0', text: '' },
      { title: 'Sumário', text: 'Introdução 9\nA lei do limite 15\nA lei da influência 27' },
      { title: 'Introdução', text: para },
      { title: 'A lei do limite', text: para },
      { title: 'A lei da influência', text: para },
    ],
  });
  await setStepDone(old.id, old.sections[3].id, true);
  const next = await resplitMaterial(old);
  assert(next.sections.map((x) => x.title).join('|') === 'Introdução|A lei do limite|A lei da influência', next.sections.map((x) => x.title).join('|'));
  assert(!next.sections.some((x) => /isbn/i.test(x.text)), 'ficha fora');
  assert((await getProgress(old.id)).done.length === 0, 'andamento recomeça');
  await deleteMaterial(old.id);
});

const material = await createMaterial({ title: 'Graça e Fé', kind: 'estudo', text: TEXT });
const reading = readMaterial(material);

await test('DNA: destaques, definições, perguntas, referências e palavras-chave', () => {
  assert(material.sections.length === 3, `seções: ${material.sections.length}`);
  assert(reading.highlights.length === 1, 'destaque');
  assert(reading.definitions.map((d) => d.term).join('|') === 'Graça|Fé', reading.definitions.map((d) => d.term).join('|'));
  assert(reading.questions.some((q) => q.text === 'Como somos salvos?'), 'pergunta');
  const refs = reading.references.map((r) => r.label);
  assert(['Efésios 2:8-9', 'João 3:16', 'Romanos 5:1', 'Efésios 2'].every((r) => refs.includes(r)), refs.join('|'));
  assert(!refs.some((r) => r.startsWith('Oseias') || r.startsWith('Isaías')), `falso positivo: ${refs.join('|')}`);
  assert(reading.keywords[0].word.startsWith('graça'), `palavra-chave: ${reading.keywords[0]?.word}`);
});

await test('cartões sugeridos saem só do texto', () => {
  const drafts = suggestCards(material);
  const origins = new Set(drafts.map((d) => d.origin));
  for (const o of ['definicao', 'destaque', 'pergunta', 'lista', 'referencia']) assert(origins.has(o as never), `faltou cartão de ${o}`);
  const def = drafts.find((d) => d.origin === 'definicao' && d.front === 'Graça');
  assert(def?.back === 'favor de Deus que não merecemos.', 'definição');
  const cloze = drafts.find((d) => d.origin === 'destaque')!;
  assert(cloze.front.includes('_____') && cloze.back === 'A graça é favor imerecido que transforma.', cloze.front);
  const q = drafts.find((d) => d.origin === 'pergunta')!;
  assert(q.front === 'Como somos salvos?' && q.back.startsWith('Pela graça, mediante a fé'), q.back);
});

await test('repetição espaçada (Leitner)', () => {
  const base: Card = { id: 'c', materialId: 'm', front: 'f', back: 'b', origin: 'manual', box: 1, due: 0, reviews: 0, lapses: 0, createdAt: 0, updatedAt: 0 };
  const t = new Date(2026, 9, 12, 10).getTime();
  const ok = schedule(base, 'acertei', t);
  assert(ok.box === 2 && ok.due > t, 'acertei sobe');
  const top = schedule({ ...base, box: 5 }, 'acertei', t);
  assert(top.box === 5 && top.due >= t + 15 * 864e5, 'caixa 5 volta em 16 dias');
  const wrong = schedule({ ...base, box: 4 }, 'errei', t);
  assert(wrong.box === 1 && wrong.due - t === 10 * 60 * 1000 && wrong.lapses === 1, 'errei volta à caixa 1 em 10 min');
  assert(schedule({ ...base, box: 3 }, 'dificil', t).box === 3, 'difícil mantém');
});

await test('resumo extrativo: frases do próprio texto', () => {
  const parts = extractiveSummary(material, 'medio', reading);
  assert(parts.length === 3, `${parts.length}`);
  assert(parts[0].sentences[0] === 'A graça é favor imerecido que transforma.', 'destaque primeiro');
  const all = material.sections.map((s) => s.text).join(' ');
  for (const p of parts) for (const s of p.sentences) assert(all.replace(/\s+/g, ' ').includes(s.replace(/^> /, '')), `frase fora do texto: ${s}`);
});

await test('plano de ação sugerido da seção de aplicação', () => {
  const acts = suggestActions(material).map((a) => a.text);
  assert(acts.includes('Agradecer diariamente pela graça') && acts.includes('Ler Efésios 2 nesta semana'), acts.join('|'));
  assert(!acts.some((a) => a.includes('Obras são fruto')), 'item de fora da aplicação');
});

await test('mapa mental: um assunto por parte, só os pontos principais, tirados do texto', () => {
  const map = buildMindMap(material, reading, [
    { id: 'a1', materialId: material.id, text: 'Orar pela família', owner: '', due: '2026-11-02', status: 'pendente', createdAt: '', updatedAt: '' } as never,
    { id: 'a2', materialId: material.id, text: 'Já feito', owner: '', due: '', status: 'feito', createdAt: '', updatedAt: '' } as never,
  ]);
  assert(map.modules.length === material.sections.length + 1, `${map.modules.length} assuntos`);
  const plano = map.modules[map.modules.length - 1];
  assert(plano.children.length === 1 && plano.children[0].tip.body.includes('Prazo: 02/11/2026'), 'só ações abertas, com prazo');
  // nada inventado: todo texto de desdobramento sai do material
  const all = material.sections.map((s) => s.text).join('\n').replace(/\s+/g, ' ');
  for (const m of map.modules.slice(0, -1))
    for (const c of m.children) {
      const body = c.tip.body.replace(/\s+/g, ' ');
      assert(all.includes(body) || body === c.tip.title, `fora do texto: ${body}`);
    }
  // objetivo: no máximo MAX_POINTS por assunto, o destaque vem primeiro
  assert(map.modules.every((m) => m.children.length <= MAX_POINTS), 'até 6 pontos por assunto');
  const intro = map.modules[0];
  assert(intro.children[0].type === 'conceito' && intro.children[0].tip.title === 'Destaque', 'destaque primeiro');
  assert(map.modules.some((m) => m.children.some((c) => c.type === 'biblica')), 'base bíblica');
  assert(map.legend[0].label === 'Centro / Assuntos', 'legenda');
  assert(JSON.stringify(map).length > 0, 'dados serializáveis (vão no .html)');
});

await test('rótulo do círculo: curto, sem cortar palavra no meio da linha', () => {
  assert(circleLabel('Graça') === 'Graça', 'curto');
  assert(circleLabel('A graça é favor imerecido que transforma') === 'A graça é\nfavor…', JSON.stringify(circleLabel('A graça é favor imerecido que transforma')));
  assert(circleLabel('A graça é favor imerecido', 30, 2) === 'A graça é favor imerecido', 'cabe');
});

await test('plano de ação: frases do livro que pedem uma ação', async () => {
  const book = await createMaterial({
    title: 'Livro sem aplicação',
    kind: 'livro',
    sections: [{ title: 'A lei do limite', text: 'A liderança tem um teto. O líder precisa ouvir antes de falar com a equipe. Pratique a escuta atenta todos os dias da semana. A história continua no próximo capítulo. Você já pensou nisso?' }],
  });
  const acts = suggestActions(book).map((a) => a.text);
  assert(acts.includes('O líder precisa ouvir antes de falar com a equipe.') && acts.includes('Pratique a escuta atenta todos os dias da semana.'), acts.join('|'));
  assert(acts.length === 2, `${acts.length}: ${acts.join('|')}`);
  await deleteMaterial(book.id);
});

await test('Word (.docx) importado: títulos e listas', async () => {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Ttulo1"/></w:pPr><w:r><w:t>Capítulo Um</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Texto com ação &amp; coração.</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Item</w:t></w:r></w:p></w:body></w:document>',
  );
  const text = await docxToText(await zip.generateAsync({ type: 'arraybuffer' }));
  assert(text === '# Capítulo Um\nTexto com ação & coração.\n\n- Item', JSON.stringify(text));
});

await test('cópia do Hub Bible: mensagens, estudos e devocionais viram materiais', () => {
  const backup = {
    app: 'hub-bible',
    version: 2,
    data: {
      sermons: [{ id: 's1', title: 'A Videira', mainText: 'João 15:5', content: [{ type: 'section', html: 'Introdução' }, { type: 'text', html: 'A <b>comunhão</b> é vida.' }, { type: 'highlight', html: 'Permanecer é depender.' }, { type: 'scripture', html: 'Eu sou a videira', reference: 'João 15:5' }] }],
      studies: [{ id: 'e1', title: 'Fé', sections: [{ kind: 'introducao', text: 'Fé é confiança.' }] }],
      devotionals: [{ id: 'd1', title: 'Dia 1', scripture: 'Sl 23:1', reflection: 'Deus cuida.', attachmentId: undefined }, { id: 'd2', title: 'Só arquivo', attachmentId: 'x' }],
    },
  };
  const found = readHubBackup(backup);
  assert(found.length === 3, `encontrados ${found.length}`);
  const sermon = found.find((f) => f.id === 's1')!;
  assert(sermon.sections[0].title === 'Introdução' && sermon.sections[0].text.includes('> Permanecer é depender.') && sermon.sections[0].text.includes('— João 15:5'), JSON.stringify(sermon.sections));
  let refused = false;
  try {
    readHubBackup({ app: 'outro' });
  } catch {
    refused = true;
  }
  assert(refused, 'aceitou arquivo de outro app');
});

await test('banco: andamento, cartões, ações, cópia de segurança e exclusão em cascata', async () => {
  await setStepDone(material.id, material.sections[0].id, true);
  assert(progressRatio(material, await getProgress(material.id)) === 1 / 3, 'andamento');
  const cards = await addCards(material.id, suggestCards(material));
  assert(cards.length > 3, 'cartões gravados');
  const again = await addCards(material.id, suggestCards(material));
  assert(again.length === 0, 'cartões repetidos não entram');
  const answered = await answerCard(cards[0], 'acertei');
  assert((await db.cards.get(cards[0].id))?.box === answered.box, 'resposta gravada');
  await addActions(material.id, suggestActions(material));
  assert((await listActions(material.id)).length === 3, 'ações');

  const backup = await createBackup();
  assert(backup.counts.materials === 1 && backup.counts.cards === cards.length, JSON.stringify(backup.counts));
  await deleteMaterial(material.id);
  assert((await db.cards.count()) === 0 && (await db.actions.count()) === 0 && !(await db.progress.get(material.id)), 'cascata');
  const restored = await restoreBackup(JSON.parse(JSON.stringify(backup)));
  assert(restored.materials === 1 && (await db.cards.count()) === cards.length, 'restauração');

  const hub = hubStudyBackup({ ...material, centralIdea: 'Somos salvos pela graça.' });
  assert(hub.app === 'hub-bible' && hub.data.studies[0].sections.length === material.sections.length + 2, 'envio ao Hub');
  assert(hub.data.studies[0].mainText === 'Efésios 2:8-9', hub.data.studies[0].mainText);
});

await test('material em arquivo: baixa e volta como material novo, completo', async () => {
  const file = JSON.parse(JSON.stringify(await materialFile(material.id)));
  assert(file.app === 'hub-resumos-material' && file.cards.length > 0 && file.actions.length === 3, 'arquivo completo');
  const copy = await importMaterialFile(file);
  assert(copy.id !== material.id && copy.title === material.title, 'id novo, mesmo conteúdo');
  assert(copy.sections.every((s, i) => s.id !== material.sections[i].id && s.text === material.sections[i].text), 'partes copiadas');
  const p = await getProgress(copy.id);
  assert(p.done.length === 1 && p.done[0] === copy.sections[0].id, 'andamento remapeado');
  assert((await db.cards.where('materialId').equals(copy.id).count()) === file.cards.length, 'cartões');
  assert((await listActions(copy.id)).length === 3, 'ações');
  assert((await db.cards.where('materialId').equals(material.id).count()) === file.cards.length, 'original intacto');
  let refused = false;
  try {
    await importMaterialFile({ app: 'outro' });
  } catch {
    refused = true;
  }
  assert(refused, 'arquivo estranho recusado');
});

await test('exemplo: usa todas as marcações e alimenta todas as visões', async () => {
  const ex = await createExampleMaterial();
  const r = readMaterial(ex);
  assert(ex.tags.includes('exemplo') && ex.sections.length === 5, `${ex.sections.length} partes`);
  assert(r.highlights.length >= 2 && r.definitions.length >= 3 && r.questions.length >= 2 && r.references.length >= 4, 'DNA');
  assert(suggestActions(ex).length >= 2, 'ações');
  const map = buildMindMap(ex, r);
  assert(map.modules.length === 5 && map.modules.every((m) => m.children.length > 0), 'mapa com desdobramentos');
});

await test('quadros: todo texto sai do material', async () => {
  const ex = await createExampleMaterial();
  const b = boardContent(ex);
  const all = `${ex.sections.map((s) => `${s.title}\n${s.text}`).join('\n')}\n${ex.centralIdea}`.replace(/\s+/g, ' ');
  const pieces = [b.central, ...b.parts.flatMap((p) => [p.title, p.key, p.extra ?? '']), ...b.ideas, ...b.applications, ...b.questions, ...b.concepts.flatMap((c) => [c.term, c.meaning])].filter(Boolean);
  for (const t of pieces) {
    // "Termo: definição" junta dois trechos do texto
    const ok = all.includes(t) || t.split(': ').every((x) => all.includes(x));
    assert(ok, `fora do texto: ${t}`);
  }
  assert(b.parts.length === 5 && b.parts.every((p) => p.key), 'cada parte com ponto-chave');
  assert(b.centralLabel === 'Ideia central' && b.applicationsLabel === 'Aplicações' && b.applications.length >= 2, 'aplicações');
  assert(b.references.length >= 4 && b.cards.length >= 4, 'versículos e cartões');
});

console.log(lines.join('\n'));
console.log(`\n${passed} aprovados, ${failed} reprovados.`);
if (failed) process.exit(1);
