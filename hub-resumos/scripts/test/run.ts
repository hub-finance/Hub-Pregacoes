import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { findReferences, hubBibleLink } from '../../src/core/bible';
import { readMaterial, sameIdea, splitByChapterTitles, splitIntoSections } from '../../src/core/text';
import { suggestCards, addCards, answerCard, schedule } from '../../src/core/cards';
import { suggestActions, addActions, listActions } from '../../src/core/actions';
import { extractiveSummary } from '../../src/core/summary';
import { buildStudyMap } from '../../src/core/studyMap';
import { directionalMapHtml } from '../../src/features/layers/mapHtml';
import { docxToText, readHubBackup } from '../../src/core/importers';
import { createMaterial, deleteMaterial, getProgress, progressRatio, resplitMaterial, setStepDone } from '../../src/core/materials';
import { createBackup, hubStudyBackup, importMaterialFile, materialFile, restoreBackup } from '../../src/core/backup';
import { createExampleMaterial } from '../../src/core/example';
import { boardContent } from '../../src/core/boards';
import { buildBriefByRules, buildBriefWithAi, parseBriefAnswer, refsNotInText, removeRepeats, sectionIdByTitle, turnsInSteps } from '../../src/core/brief';
import { briefWordHtml } from '../../src/core/briefDoc';
import { aiChapterTitles, askGemini, buildPrompt, getGeminiConfig, parseAiAnswer, pickFlashModel, removeAiSummary, summarizeWithAi, testGeminiKey, WHOLE } from '../../src/core/ai';
import { setSetting } from '../../src/core/db';
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

await test('A Igreja Triunfante: sumário sem título, perguntas e títulos em duas linhas', async () => {
  const toc = [
    '1. Origens: Satanás e Seu Reino. . . . . . . . . . . . . . . . . . . . . 7',
    '2. Divisão Bíblica do Homem: Espírito, Alma e Corpo. . . . .29',
    '3. O Diabo ou a Carne?. . . . . . . . . . . . . . . . . . . . . . . . . . . . 55',
    '4. Fazendo Distinção entre Opressão,',
    'Obsessão e Possessão. . . . . . . . . . . . . . . . . . . . . . . . . . . . 83',
    '5. Um Cristão Pode Ter um demônio?. . . . . . . . . . . . . . . . 109',
    '6. Como Lidar com Espíritos Malignos. . . . . . . . . . . . . . . 131',
    '7. A Sabedoria de Deus. . . . . . . . . . . . . . . . . . . . . . . . . . . . .159',
    '8. Guerra Espiritual: Você Está',
    'Lutando ou Descansando? . . . . . . . . . . . . . . . . . . . . . . . 191',
    '9. Destruindo as Fortalezas. . . . . . . . . . . . . . . . . . . . . . . . 223',
    '10. Orando Biblicamente Para Frustrar',
    'o Reino das Trevas. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 247',
    '11. O Ministério de Libertação é Bíblico?. . . . . . . . . . . . . . 275',
    '12. Meios Bíblicos de Ministrar Libertação. . . . . . . . . . . . 297',
  ];
  const titles = ['Origens: Satanás e Seu Reino', 'Divisão Bíblica do Homem: Espírito, Alma e Corpo', 'O Diabo ou a Carne?', 'Fazendo Distinção entre Opressão, Obsessão e Possessão', 'Um Cristão Pode Ter um demônio?', 'Como Lidar com Espíritos Malignos', 'A Sabedoria de Deus', 'Guerra Espiritual: Você Está Lutando ou Descansando?', 'Destruindo as Fortalezas', 'Orando Biblicamente Para Frustrar o Reino das Trevas', 'O Ministério de Libertação é Bíblico?', 'Meios Bíblicos de Ministrar Libertação'];
  const para = (n: number) => Array.from({ length: n }, (_, i) => `Linha ${i + 1} de texto corrido do capítulo para estudo cuidadoso da Palavra.`).join(' ');
  const body: string[] = [];
  titles.forEach((t, i) => {
    body.push('A IGREJA TRIUNFANTE', String(i * 20 + 7));
    // cada capítulo escrito de um jeito no corpo do livro
    if (i % 3 === 0) body.push(`CAPÍTULO ${i + 1}`, t.toUpperCase());
    else if (i % 3 === 1) body.push(String(i + 1), ...(t.length > 30 ? [t.slice(0, t.lastIndexOf(' ', 30)), t.slice(t.lastIndexOf(' ', 30) + 1)] : [t]));
    else body.push(`${i + 1}`, t);
    body.push(para(30), 'A IGREJA TRIUNFANTE', String(i * 20 + 8), para(30));
  });
  const book = ['DEREK PRINCE', 'A IGREJA TRIUNFANTE', 'TRADUÇÃO DE FULANO', 'ISBN 978-85-0000-000-0', 'CDD 235.4', '', ...toc, '', ...body].join('\n');
  const parts = splitIntoSections(book, 'Introdução');
  assert(parts.length === 12, `${parts.length} partes: ${parts.map((p) => p.title).join(' | ')}`);
  assert(parts[3].title === '4. Fazendo Distinção entre Opressão, Obsessão e Possessão', parts[3].title);
  assert(parts[2].title === '3. O Diabo ou a Carne?' && parts[10].title === '11. O Ministério de Libertação é Bíblico?', `${parts[2].title} / ${parts[10].title}`);
  assert(parts.every((p) => p.text.length > 500), 'cada capítulo com o seu texto');
  assert(!parts.some((p) => /ISBN|CDD/.test(p.text)), 'ficha catalográfica fora');

  // "Informar os capítulos": sumário ilegível no PDF, o usuário cola os títulos
  const garbled = book.replace(toc.join('\n'), 'S U M Á R I O 7 29 55 83 109 131 159 191 223 247 275 297');
  assert(splitIntoSections(garbled, 'Introdução').length !== 12, 'sem sumário legível a regra antiga não acerta');
  const byTitles = splitByChapterTitles(garbled, titles.map((t, i) => `${i + 1}. ${t}`));
  assert(byTitles?.length === 12, `${byTitles?.length}`);
  // com o sumário legível no texto, a procura começa depois dele
  const withToc = splitByChapterTitles(book, titles);
  assert(withToc?.length === 12 && withToc.every((p) => p.text.length > 500), `${withToc?.length}`);

  // leitura inteligente: a IA lê o começo do livro e devolve os títulos
  await setSetting('geminiKey', 'chave-teste');
  let sent = '';
  const ai = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body)).contents[0].parts[0].text;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ titulos: titles.map((t, i) => `${i + 1}. ${t}`) }) }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const fromAi = await aiChapterTitles(garbled, { fetchImpl: ai });
  assert(fromAi.length === 12 && /sumário ou índice/.test(sent) && /seções, lições ou partes/.test(sent), 'pedido e resposta');
  const split = splitByChapterTitles(garbled, fromAi);
  assert(split?.length === 12 && split[3].title === '4. Fazendo Distinção entre Opressão, Obsessão e Possessão', `${split?.length}`);
  await setSetting('geminiKey', '');
});

await test('cabeçalho de página não vira definição nem ponto repetido no mapa', async () => {
  const body = Array.from({ length: 3 }, (_, i) => `Origens: Satanás e Seu Reino\n${i * 2 + 7}\nSatanás foi criado como um querubim ungido e se rebelou contra Deus. O orgulho levou à sua queda (Ezequiel 28:14).\nA IGREJA TRIUNFANTE`).join('\n');
  const m = await createMaterial({ title: 'Teste', kind: 'livro', sections: [{ title: '1. Origens: Satanás e Seu Reino', text: `Graça: favor imerecido de Deus.\n${body}` }] });
  const r = readMaterial(m);
  assert(r.definitions.length === 1 && r.definitions[0].term === 'Graça', r.definitions.map((d) => d.term).join('|'));
  const map = buildStudyMap(m.title, buildBriefByRules(m, r));
  const labels = map.branches[0].items.map((c) => c.label);
  assert(new Set(labels).size === labels.length && !labels.some((l) => /^Origens$/.test(l)), labels.join('|'));
  await deleteMaterial(m.id);
});

await test('livro em seções (sem a palavra capítulo)', () => {
  const t = (n: string) => `${n}\nTexto desta seção com várias palavras para ler e estudar com calma.`;
  const parts = splitIntoSections([t('Seção 1 — O chamado'), t('Seção 2 — A missão'), 'SEÇÃO 3', 'O envio', 'Texto final da seção três.'].join('\n'), 'Introdução');
  assert(parts.map((p) => p.title).join('|') === 'Seção 1 — O chamado|Seção 2 — A missão|SEÇÃO 3 — O envio', parts.map((p) => p.title).join('|'));
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

await test('mapa mental do estudo: um ramo por parte, itens com tipo, tirados do texto', () => {
  const brief = buildBriefByRules(material, reading);
  const map = buildStudyMap(material.title, brief);
  assert(map.branches.length === material.sections.length, `${map.branches.length} ramos`);
  // cada ramo se lê fechado: rótulo e frase principal
  // cada ramo tem rótulo; o resumo só quando a parte ainda tem uma frase que não apareceu em outra camada
  assert(map.branches.every((b) => b.label) && map.branches.some((b) => b.summary), 'rótulo em cada ramo');
  // nada inventado: o detalhe dos itens sai do material (frase do texto, encurtada pela oração principal)
  const all = material.sections.map((s) => s.text).join('\n').replace(/\s+/g, ' ');
  for (const b of map.branches)
    for (const it of b.items) assert(all.includes(it.detail.replace(/[.]$/, '').slice(0, 30)) || (it.kind === 'versiculo' && it.detail.includes(': versículo citado em')), `fora do texto: ${it.detail}`);
  // poucos e bem escolhidos, sem repetir a mesma frase no ramo
  assert(map.branches.every((b) => b.items.length <= 6), 'até 6 itens por ramo');
  for (const b of map.branches) assert(new Set(b.items.map((i) => i.detail)).size === b.items.length, b.items.map((i) => i.detail).join(' | '));
  // os tipos aparecem e são contados (filtros)
  const kinds = new Set(map.branches.flatMap((b) => b.items.map((i) => i.kind)));
  assert(kinds.has('ideia') && kinds.has('versiculo'), [...kinds].join(','));
  assert(Object.values(map.counts).reduce((a, b) => a + b, 0) === map.branches.reduce((n, b) => n + b.items.length, 0), 'contagem');
  // a virada da parte vem primeiro no ramo
  assert(map.branches.every((b) => b.items.findIndex((i) => i.kind === 'virada') <= 0), 'virada primeiro');
  // arquivo .html: filtros, todos os ramos e versão em texto sem scripts
  const html = directionalMapHtml(material.title, brief);
  assert(html.includes('class="nojs"') && html.includes('data-f="versiculo"') && (html.match(/<li class="br( open)?"/g) ?? []).length === map.branches.length, 'html');
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
  const map = buildStudyMap(ex.title, buildBriefByRules(ex, r));
  assert(map.branches.length === 5 && map.branches.every((b) => b.items.length > 0), 'mapa com desdobramentos');
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

await test('IA (Gemini): pedido, resposta, erros e onde fica guardado', async () => {
  const ex = await createMaterial({ title: 'Estudo IA', kind: 'estudo', author: 'Pr. Teste', text: '# Parte um\nTexto da parte um.\n# Parte dois\nTexto da parte dois.' });
  const whole = buildPrompt(ex, WHOLE);
  assert(whole.prompt.includes('## Parte um') && whole.prompt.includes('## Parte dois') && whole.prompt.includes('Pr. Teste'), 'livro inteiro no pedido');
  assert(/não invente/.test(whole.prompt) && /português do Brasil/.test(whole.prompt), 'regras de fidelidade');
  const one = buildPrompt(ex, ex.sections[1].id);
  assert(one.scopeTitle === 'Parte dois' && !one.prompt.includes('Texto da parte um'), 'só a parte pedida');

  const answer = { resumo: 'Resumo da IA.', ideias: ['Ideia 1'], aplicacoes: ['Aplicar 1', 'Aplicar 2'], perguntas: ['Pergunta?'], conceitos: [{ termo: 'Graça', definicao: 'Favor.' }] };
  assert(parseAiAnswer('```json\n' + JSON.stringify(answer) + '\n```').aplicacoes.length === 2, 'aceita bloco ```json');
  let bad = '';
  try { parseAiAnswer('não é json'); } catch (e) { bad = (e as Error).message; }
  assert(/formato inesperado/.test(bad), bad);

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const ok = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const fail = (status: number, message: string) =>
    (async () => new Response(JSON.stringify({ error: { message } }), { status })) as unknown as typeof fetch;
  const cfg = { key: 'chave-teste', model: 'gemini-2.5-flash' };
  const r = await askGemini('oi', cfg, { fetchImpl: ok });
  assert(r.resumo === 'Resumo da IA.', 'resposta lida');
  assert(calls[0].url.includes('gemini-2.5-flash:generateContent') && (calls[0].init.headers as Record<string, string>)['x-goog-api-key'] === 'chave-teste', 'chave no cabeçalho');
  for (const [st, msg, expect] of [[400, 'API key not valid', /chave do Gemini não é válida/], [429, 'quota', /limite de uso/], [503, 'x', /instável/]] as const) {
    let m = '';
    try { await askGemini('oi', cfg, { fetchImpl: fail(st, msg) }); } catch (e) { m = (e as Error).message; }
    assert(expect.test(m), `${st}: ${m}`);
  }
  let noKey = '';
  try { await askGemini('oi', { key: '', model: 'x' }, { fetchImpl: ok }); } catch (e) { noKey = (e as Error).message; }
  assert(/Cadastre a chave/.test(noKey), noKey);

  // escolha automática do Flash: o mais novo e estável, sem lite/imagem/voz/experimental
  const gen = ['generateContent'];
  const list = [
    { name: 'models/gemini-2.5-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-flash', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.9-flash-preview', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-flash-lite', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-flash-image', supportedGenerationMethods: gen },
    { name: 'models/gemini-3.8-pro', supportedGenerationMethods: gen },
    { name: 'models/gemini-flash-latest', supportedGenerationMethods: gen },
    { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  ];
  assert(pickFlashModel(list) === 'gemini-3.8-flash', String(pickFlashModel(list)));
  // sem o 3.8 na conta: o Flash mais novo e estável
  assert(pickFlashModel(list.filter((m) => m.name !== 'models/gemini-3.8-flash')) === 'gemini-3.9-flash-preview' || pickFlashModel(list.filter((m) => m.name !== 'models/gemini-3.8-flash')) === 'gemini-2.5-flash', String(pickFlashModel(list.filter((m) => m.name !== 'models/gemini-3.8-flash'))));
  assert(pickFlashModel([{ name: 'models/gemini-flash-latest' }]) === 'gemini-flash-latest', 'apelido quando não há outro');
  assert((await getGeminiConfig()).model === 'gemini-3.8-flash', 'padrão é o 3.8 Flash');
  const listing = (async () => new Response(JSON.stringify({ models: list }), { status: 200 })) as unknown as typeof fetch;
  assert((await testGeminiKey({ key: 'k' }, listing)) === 'gemini-3.8-flash', 'chave conferida acha o Flash');

  await setSetting('geminiKey', 'chave-teste');
  await setSetting('geminiModelAuto', 'gemini-2.5-flash');
  // o modelo automático saiu de linha (404): acha o atual e tenta de novo
  const retired = (async (url: string, init: RequestInit) => {
    if (url.includes('gemini-2.5-flash:')) return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
    if (url.includes('/models?')) return listing(url, init);
    return ok(url, init);
  }) as unknown as typeof fetch;
  await summarizeWithAi(ex.id, ex.sections[1].id, { fetchImpl: retired });
  assert((await getGeminiConfig()).model === 'gemini-3.8-flash', 'trocou para o Flash atual');
  const saved = await summarizeWithAi(ex.id, ex.sections[0].id, { fetchImpl: ok });
  const after = await db.materials.get(ex.id);
  assert(saved.provider === 'gemini' && after?.ai?.[ex.sections[0].id]?.resumo === 'Resumo da IA.', 'guardado no material');
  assert(after?.sections[0].text === 'Texto da parte um.', 'texto do autor intacto');
  await removeAiSummary(ex.id, ex.sections[0].id);
  assert(!(await db.materials.get(ex.id))?.ai?.[ex.sections[0].id], 'resumo apagado');
  await setSetting('geminiKey', '');
  await deleteMaterial(ex.id);
});

await test('estrutura do estudo: regras (sem IA) — poucos itens, do texto, sem reticências', async () => {
  const ex = await createExampleMaterial();
  const b = buildBriefByRules(ex);
  assert(b.source === 'regras' && b.thesis === ex.centralIdea, 'tese = ideia central');
  assert(b.steps.length === 5 && b.steps.every((x) => x.title && !/…/.test(x.title)), b.steps.map((x) => x.title).join('|'));
  assert(b.steps[0].title === 'Introdução' && b.steps[1].question === 'Quem é o meu próximo?', `${b.steps[0].title} / ${b.steps[1].question}`);
  assert(b.branches.every((x) => x.label.split(/\s+/).filter((w) => w !== '·').length <= 6 && !/ (de|do|da|que)$/.test(x.label) && x.leaves.length <= 5), b.branches.map((x) => x.label).join('|'));
  // enxuto: nada fora dos cartões passa do limite de leitura, e a explicação não repete a pergunta
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  assert(words(b.synthesis) <= 60, `síntese longa: ${words(b.synthesis)}`);
  assert(b.steps.every((x) => !x.question || x.explanation !== x.question), 'etapa repete a pergunta');
  const biblical = b.cards.filter((c) => c.kind === 'biblico').map((c) => c.back);
  assert(new Set(biblical).size === biblical.length, 'cartões bíblicos com o mesmo contexto');
  // Word: as 4 camadas e o DNA, com a tese e a matriz de 3 colunas
  const doc = briefWordHtml(ex.title, ex.author, b);
  assert(['Captar', 'Compreender', 'Aprofundar', 'Aplicar', 'DNA da mensagem', 'Base bíblica (onde)'].every((x) => doc.includes(x)) && doc.includes('urn:schemas-microsoft-com:office:word'), 'documento do Word');
  assert(!/…/.test(doc), 'Word sem reticências');
  const labels = b.branches.flatMap((x) => x.leaves.map((l) => l.label));
  assert(b.branches.every((x) => new Set(x.leaves.map((l) => l.label)).size === x.leaves.length), labels.join('|'));
  assert(b.cards.some((c) => c.kind === 'biblico') && b.cards.some((c) => c.kind === 'principio') && b.cards.some((c) => c.kind === 'revisao'), 'tipos de cartão');
  assert(b.dna.rows.length >= 2 && b.dna.rows.every((r) => r.principle), 'matriz DNA');
  assert(!JSON.stringify(b).includes('…'), 'sem reticências');
  assert(refsNotInText(b, ex).size === 0, 'versículos do texto');
  assert(sectionIdByTitle(ex, 'A compaixão que age') === ex.sections[3].id, 'liga à parte');
  // ponto de inflexão sem IA: sugestões tiradas do texto, marcadas como sugestão
  assert(b.inflection?.turn && b.inflection.guess && ex.sections.some((x) => x.text.includes(b.inflection!.turn.replace(/\.$/, '').slice(0, 30))), JSON.stringify(b.inflection));
  assert((b.chapterTurns?.length ?? 0) >= 2 && b.chapterTurns!.every((t) => t.guess && t.turn && !t.turn.endsWith('?')), JSON.stringify(b.chapterTurns));
  const doc2 = briefWordHtml(ex.title, ex.author, b);
  assert(doc2.includes('Ponto de inflexão') && doc2.includes('As viradas de cada parte'), 'Word com o ponto de inflexão');
  const mm = buildStudyMap(ex.title, b);
  assert(mm.branches.some((x) => x.items[0]?.kind === 'virada') && mm.counts.virada > 0, 'mapa com o ponto de inflexão');
});

await test('estrutura sem IA: cobre o livro inteiro, não só os primeiros capítulos', async () => {
  const temas = ['oração', 'jejum', 'perdão', 'generosidade', 'santidade', 'missões', 'família', 'trabalho', 'esperança', 'sofrimento', 'adoração', 'comunhão'];
  const sections = temas.map((t, c) => ({
    id: `c${c}`,
    title: `Capítulo ${c + 1}`,
    text: [
      `> A ${t} transforma a vida de quem confia em Deus todos os dias.`,
      `O cristão aprende sobre a ${t} quando lê a Palavra com atenção e humildade (Salmos ${c + 1}:1). A ${t} não é um peso, mas um presente de Deus para a igreja.`,
      `isso continua depois, como pedaço solto de frase sobre a ${t} e a ${t}.`,
      `Muitos irmãos descobrem a ${t} no caminho da fé, e a ${t} muda a maneira de servir ao próximo.`,
    ].join('\n\n'),
  }));
  const m = { id: 'big', title: 'Livro de teste', author: '', kind: 'livro', centralIdea: '', sections, createdAt: 0, updatedAt: 0, openedAt: 0 } as unknown as Material;
  const b = buildBriefByRules(m);
  const idx = (title: string) => sections.findIndex((x) => x.title === title);
  const stepAt = b.steps.map((x) => idx(x.section));
  // uma etapa e um ramo para cada capítulo, em ordem
  assert(b.steps.length === 12 && stepAt.join(',') === sections.map((_, i) => i).join(','), `etapas: ${stepAt.join(',')}`);
  assert(b.branches.length === 12 && b.branches.every((x, i) => idx(x.section) === i), b.branches.map((x) => x.section).join('|'));
  const truthAt = b.truths.map((x) => idx(x.section));
  assert(b.truths.length === 5 && Math.max(...truthAt) >= 9, `verdades: ${truthAt.join(',')}`);
  assert(b.dna.rows.length === 5 && b.dna.convictions.length > 0, `dna ${b.dna.rows.length} conv ${b.dna.convictions.length}`);
  // título genérico ("Capítulo 3") vira o tema do trecho
  assert(b.steps.every((x) => !/^Capítulo \d/.test(x.title)) && temas.some((t) => b.steps[0].title.toLowerCase().includes(t)), b.steps.map((x) => x.title).join(' | '));
  // nada de pedaço solto nem pontuação emendada
  const texts = [b.thesis, b.synthesis, ...b.truths.map((x) => x.text), ...b.steps.map((x) => x.explanation), ...b.dna.rows.map((x) => x.principle)];
  assert(texts.every((t) => !/^isso/i.test(t) && !/[,;:]\.$/.test(t)), texts.filter((t) => /^isso/i.test(t) || /[,;:]\.$/.test(t)).join(' | '));

  // com introdução: ela dá a tese, o objetivo e a 1ª etapa; depois, um capítulo por etapa
  const withIntro = {
    ...m,
    sections: [
      { id: 'intro', title: 'Introdução', text: 'Neste livro quero ajudar cada leitor a viver a oração, o perdão e a esperança como hábitos diários.\n\nA vida cristã cresce quando a Palavra de Deus orienta cada decisão do dia, e a oração sustenta o caminho.' },
      ...sections,
    ],
  } as unknown as Material;
  const bi = buildBriefByRules(withIntro);
  assert(bi.steps.length === 13 && bi.steps[0].section === 'Introdução' && bi.steps[0].title === 'Introdução', bi.steps.slice(0, 2).map((x) => x.title).join(' | '));
  assert(/Neste livro quero ajudar/.test(bi.objective), `objetivo: ${bi.objective}`);
  assert(bi.thesis && withIntro.sections[0].text.includes(bi.thesis.replace(/\.$/, '').slice(0, 25)), `tese: ${bi.thesis}`);
  assert(bi.synthesis.length > 0, 'síntese');
});

await test('sem repetição: cada ideia aparece uma vez só no estudo', async () => {
  const ex = await createExampleMaterial();
  const b = buildBriefByRules(ex);
  // tudo o que o leitor lê nas camadas, menos versículos (são referências) e a tese do DNA (é a mesma tese)
  const texts = [
    b.thesis,
    ...b.steps.map((x) => x.explanation),
    ...b.truths.map((x) => x.text),
    ...b.dna.rows.map((x) => x.principle),
    ...b.dna.convictions,
    ...b.cards.filter((c) => c.kind === 'principio').map((c) => c.front),
    ...b.branches.map((x) => x.summary),
    ...b.branches.flatMap((x) => x.leaves.filter((l) => l.kind !== 'versiculo').map((l) => l.detail)),
  ].filter(Boolean);
  const pairs: string[] = [];
  texts.forEach((a, i) => texts.slice(i + 1).forEach((c) => sameIdea(a, c) && pairs.push(`${a} ≈ ${c}`)));
  assert(!pairs.length, pairs.join(' || '));
  // ideia igual com outras palavras é reconhecida; frases do mesmo molde com assunto diferente, não
  assert(sameIdea('A compaixão sempre termina em atitude concreta.', 'Termina sempre em atitude concreta a compaixão!'), 'mesma ideia, outra ordem');
  const w = (x: string) => (['oracao', 'jejum'].includes(x) ? 3 : 0.5);
  assert(!sameIdea('A oração transforma a vida de quem confia em Deus.', 'O jejum transforma a vida de quem confia em Deus.', w), 'assuntos diferentes');
  // a virada de cada capítulo fica dentro da etapa; a lista à parte só tem o que sobrou
  const t = turnsInSteps(b);
  assert(t.inline.filter(Boolean).length >= 1 && t.rest.every((x) => !b.steps.some((st) => st.section === x.section)), 'viradas nas etapas');
  await deleteMaterial(ex.id);
});

await test('IA: a revisão final tira a mesma ideia repetida em outra camada', () => {
  const base = buildBriefByRules(material, reading);
  const dup = 'A graça de Deus transforma o pecador em filho amado.';
  const b = removeRepeats({
    ...base,
    thesis: dup,
    truths: [{ text: 'Transforma o pecador em filho amado a graça de Deus.', section: '', origin: 'ia' as const }, { text: 'A fé vem pelo ouvir a Palavra de Cristo.', section: '', origin: 'ia' as const }],
    dna: { ...base.dna, convictions: ['A fé vem pelo ouvir a Palavra de Cristo!'] },
  });
  assert(b.truths.length === 1 && b.truths[0].text.startsWith('A fé') && b.dna.convictions.length === 0, JSON.stringify([b.truths, b.dna.convictions]));
});

await test('estrutura do estudo: IA — pedido, leitura, limites e conferência dos versículos', async () => {
  const ex = await createExampleMaterial();
  const answer = {
    tese: 'Amar o próximo é aproximar-se de quem precisa.',
    pontoDeInflexao: { antes: 'Dois religiosos passaram de largo.', virada: 'Mas um samaritano viu, teve compaixão e se aproximou…', depois: 'O próximo é quem eu decido amar.', referencia: 'Lucas 10:33', secao: 'A compaixão que age', origem: 'texto' },
    viradas: [
      { secao: 'Introdução', virada: 'Jesus responde com uma história.', origem: 'texto' },
      { secao: 'A compaixão que age', virada: 'A compaixão vira atitude.', referencia: 'Lucas 10:33', origem: 'ia' },
    ],
    sintese: 'A parábola responde quem é o próximo. A compaixão vê, aproxima-se e age.',
    objetivo: 'Levar o leitor a agir com compaixão.',
    textoBase: ['Lucas 10:25-37'],
    verdades: [{ texto: 'A compaixão termina em atitude.', secao: 'A compaixão que age', origem: 'texto' }],
    progressao: Array.from({ length: 9 }, (_, i) => ({ etapa: `Etapa ${i + 1}`, pergunta: 'Por quê?', explicacao: 'Explicação…', ligacao: 'gera', referencias: i === 0 ? ['Lucas 10:25-37', 'Apocalipse 3:20'] : [], secao: 'Introdução', origem: i % 2 ? 'ia' : 'texto' })),
    ramos: [{ rotulo: 'O Conflito', resumo: 'Quem é o próximo?', secao: 'A pergunta do intérprete da lei', folhas: [{ rotulo: 'Lei', detalhe: 'Deuteronômio 6:5', referencia: 'Deuteronômio 6:5' }] }],
    cartoes: [
      { tipo: 'biblico', frente: 'Lucas 10:33', verso: 'O samaritano teve compaixão.', extra: 'Centro da mensagem', referencia: 'Lucas 10:33', secao: 'A compaixão que age', origem: 'texto' },
      { tipo: 'conexao', frente: 'Lei → Compaixão', verso: 'Conhecer a lei não basta.', secao: 'A pergunta do intérprete da lei', origem: 'ia' },
      { tipo: 'revisao', frente: 'O que a compaixão faz?', verso: 'Age.', secao: 'A compaixão que age', origem: 'texto' },
    ],
    dna: { tese: '', conviccoes: ['Amar é agir'], matriz: [{ principio: 'A compaixão age', base: 'Lucas 10:33', aplicacao: 'Ajudar alguém nesta semana', origem: 'texto' }], resultado: 'Uma igreja que se aproxima.' },
    aplicacoes: ['Visitar alguém'],
    perguntas: ['Quem é o meu próximo hoje?'],
  };
  const parsed = parseBriefAnswer(JSON.stringify(answer));
  assert(parsed.steps.length === 6, 'no máximo 6 etapas');
  assert(!parsed.steps[0].explanation.includes('…'), 'reticências removidas');
  assert(parsed.dna.thesis === answer.tese, 'tese do DNA herdada');
  assert(parsed.inflection?.turn === 'Mas um samaritano viu, teve compaixão e se aproximou' && parsed.inflection.ref === 'Lucas 10:33' && !parsed.inflection.guess, JSON.stringify(parsed.inflection));
  assert(parsed.chapterTurns?.length === 2 && parsed.chapterTurns[1].origin === 'ia', 'viradas por parte');
  assert(parsed.cards.map((c) => c.kind).join(',') === 'biblico,conexao,revisao', parsed.cards.map((c) => c.kind).join(','));
  await setSetting('geminiKey', 'chave-teste');
  let prompt = '';
  const fake = (async (_u: string, init: RequestInit) => {
    prompt = JSON.parse(String(init.body)).contents[0].parts[0].text;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const b = await buildBriefWithAi(ex, { fetchImpl: fake });
  assert(b.source === 'ia' && b.model === 'gemini-3.8-flash', `${b.source} ${b.model}`);
  assert(/pontoDeInflexao: a VIRADA da mensagem, o insight supremo/.test(prompt) && /viradas: a virada de CADA parte/.test(prompt), 'pede o ponto de inflexão');
  assert(/LINHA DE RACIOCÍNIO/.test(prompt) && /SOMENTE as que aparecem/.test(prompt) && prompt.includes('## A compaixão que age'), 'pedido');
  const bad = refsNotInText(b, ex);
  assert(bad.has('Apocalipse 3:20') && !bad.has('Lucas 10:25-37') && !bad.has('Lucas 10:33'), [...bad].join('|'));
  await setSetting('geminiKey', '');
});

console.log(lines.join('\n'));
console.log(`\n${passed} aprovados, ${failed} reprovados.`);
if (failed) process.exit(1);
