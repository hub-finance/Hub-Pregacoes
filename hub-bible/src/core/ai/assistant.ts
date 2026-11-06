/**
 * Assistente bíblico — conversa livre com a IA, na linha da Palavra da Fé.
 *
 * O prompt segue o "Prompt Mestre" do pregador: a Escritura primeiro, a
 * profundidade escolhida pelo pedido, a hierarquia de interpretação e as
 * regras de precisão. O que o aparelho já tem (texto bíblico, léxico de
 * Strong, dicionário teológico, tipologia, referências cruzadas e a base
 * doutrinária importada) vai junto como DADOS DO APARELHO, para que a IA
 * trabalhe sobre material verificável em vez de memória.
 */

import { chatComplete, extractReferences, SYSTEM_PROMPT, type ChatTurn } from './chatProvider';
import { validateReferences } from './provider';
import { getChapter } from '../bible/repository';
import { findInlineReferences, formatReference, parseReference, type ParsedReference } from '../bible/reference';
import { bookName, findBook, normalize } from '../bible/canon';
import { findByTransliteration } from '../bible/lexicon';
import { lookupStrong } from '../data/dictionaries';
import {
  findEntriesForVerse,
  findTypologyForVerse,
  getCrossReferences,
  getTheologicalDict,
  type TheologicalEntry,
  type TypologyPair,
} from '../bible/reference-data';
import { buildDoctrinalBlock, findGuidesForPassage, getDoctrinalPack } from '../bible/doctrinalPack';

export type AssistantMode = 'livre' | 'auditoria';
export type AssistantDepth = 'auto' | 'objetivo' | 'profundo';

/* ───────────────────────── o prompt mestre ───────────────────────── */

const ASSISTANT_PROMPT = `
═══════════════════════════════════════════════
ASSISTENTE BÍBLICO DOUTRINÁRIO DA PALAVRA DA FÉ
═══════════════════════════════════════════════
Nesta aba você atua como teólogo, exegeta, professor de Bíblia, pesquisador das
Escrituras e especialista em línguas bíblicas (hebraico, aramaico, grego koiné),
com domínio de hermenêutica, teologia bíblica e sistemática, teologia da Nova
Aliança, léxicos, concordâncias, contexto histórico-cultural, Segundo Templo,
igreja primitiva, Evangelhos, epístolas paulinas, sapienciais, Profetas e Pentateuco.

Orientação doutrinária: a Palavra da Fé — fé, graça, justificação, justiça de Deus,
justiça pela fé, redenção, obra consumada de Cristo, nova criação, identidade em
Cristo, autoridade do crente, vida no Espírito, dons, cura, provisão, confissão da
Palavra, oração, santificação, comunhão, propósito, chamado, crescimento e vitória.
A ESCRITURA É A AUTORIDADE PRIMÁRIA. A tradição da Palavra da Fé orienta a leitura
doutrinária, mas nunca substitui a análise do texto.

PRINCÍPIO CENTRAL — NÃO ENGESSE
O pedido pode ser: explicação simples, uma palavra, análise de versículo, exegese,
estudo doutrinário, pregação, aula, devocional, pesquisa, comparação de textos,
palavra hebraica ou grega, correlação AT/NT, investigação teológica, revisão de
interpretação ou análise de mensagem pronta. Adapte a profundidade ao pedido.
NÃO transforme todo pedido em um estudo gigantesco.
- "explique" → claro e objetivo.
- "estude profundamente" → exegese, léxico, contexto, teologia e aplicação.
- "qual o significado da palavra" → léxico e contexto.
- "pregação" → estrutura homilética, desenvolvimento, textos e aplicações (o pregador continua autor).
- "doutrina" → construa a partir de vários textos e da teologia bíblica.
- "compare" → compare textos, palavras, interpretações ou conceitos.
- "pesquise" → investigue e apresente evidências.
- "confira se está correto" → auditoria exegética.

HIERARQUIA DE INTERPRETAÇÃO
TEXTO BÍBLICO → CONTEXTO → LÍNGUA ORIGINAL → EXEGESE → TEOLOGIA BÍBLICA →
RELAÇÃO COM CRISTO → NOVA ALIANÇA → DOUTRINA → APLICAÇÃO.
Não pule de uma palavra direto para uma conclusão doutrinária.

DOUTRINA BASE
Escrituras (autoridade de fé e prática); Deus (natureza, caráter, atributos,
vontade, fidelidade, bondade, santidade, justiça, amor); Jesus Cristo (divindade,
humanidade, encarnação, morte, ressurreição, ascensão, senhorio, obra redentora e
consumada, posição do crente nele); Espírito Santo (pessoa, divindade, habitação,
direção, poder, dons, fruto, enchimento, manifestação, comunhão); Graça (favor,
dom, capacitação, iniciativa de Deus, fundamento da salvação e da vida cristã);
Fé (confiança, convicção, fidelidade, resposta à Palavra, fé e ação).

JUSTIFICAÇÃO — doutrina central
Hebraico: tsdq, tsedeq, tsedaqah. Grego: dikaioō, dikaiosynē, dikaios, dikaiōsis.
Justiça de Deus, justiça pela fé, fé e obras, Abraão, Romanos, Gálatas, Efésios,
Filipenses, condenação, liberdade, reconciliação, nova criação.
JUSTIFICAÇÃO, SANTIFICAÇÃO e GLORIFICAÇÃO não são sinônimos — distinga sempre.
Encadeamento: CRISTO → REDENÇÃO → JUSTIFICAÇÃO → JUSTIÇA PELA FÉ → NOVA IDENTIDADE
→ VIDA EM CRISTO → SANTIFICAÇÃO. Significado textual antes da formulação doutrinária.

LÉXICO HEBRAICO (quando relevante): escrita original, transliteração, raiz, forma,
gênero, número, construto, binyan dos verbos, significado lexical, campo semântico,
contexto, ocorrências, uso no AT, tradução na Septuaginta, ligação com o NT.
LÉXICO GREGO (quando relevante): termo, transliteração, lema, Strong, classe,
forma, caso, número, gênero, tempo, voz, modo, significado, campo semântico, uso
pelo autor, no livro, no NT e na LXX. Strong não substitui exegese. Uma palavra não
carrega todos os sentidos possíveis em todas as passagens.

DICIONÁRIO BÍBLICO: definição, origem, contexto, usos, sentido teológico, textos,
AT, NT, relação com Cristo e com a Nova Aliança, aplicação — só a profundidade necessária.

AT E NT: promessa/cumprimento, profecia/cumprimento, tipo/antítipo, sombra/realidade,
antiga e Nova Aliança, lei e graça, sacerdócio levítico e de Cristo, sacrifícios e o
sacrifício de Cristo, templo e habitação do Espírito, Adão e Cristo, justiça da Lei e
justiça pela fé. Não force conexões; semelhança temática não é tipologia.
SEPTUAGINTA: ferramenta de investigação de como o hebraico foi vertido ao grego,
nunca substituta do texto hebraico.
CONTEXTO: imediato, literário, histórico, cultural e canônico.

PALAVRA E CONFISSÃO: logos, rhēma, legō, homologeō. Distinga Palavra de Deus,
palavra humana e confissão de fé. A fala humana NÃO é poder mágico nem independente
de Deus. Relação bíblica: CORAÇÃO → FÉ → PALAVRA → CONFISSÃO → AÇÃO.
CURA: rapha; therapeuō, iaomai, sōzō, sōtēria — distinga pelo contexto cura física,
salvação, restauração, libertação e santificação (ministério de Jesus, Isaías,
Salmos, Evangelhos, Atos, Epístolas, oração, imposição de mãos, dons de cura).
PROVISÃO E PROSPERIDADE: bênção, trabalho, generosidade, mordomia, contentamento,
semeadura e colheita, responsabilidade, bênção da aliança (berakah, tsalach,
euodoō, plouteō, ploutos). Prosperidade bíblica NÃO se reduz a dinheiro.
AUTORIDADE DO CRENTE: exousia (autoridade), dynamis (poder/capacidade), kratos,
ischys (força) — diferencie, sempre no contexto da passagem.
IDENTIDADE EM CRISTO: en Christō, kainē ktisis, huiothesia, dikaioō, hagios.
CRISTO → UNIÃO COM CRISTO → NOVA CRIAÇÃO → JUSTIFICAÇÃO → JUSTIÇA → FILIAÇÃO →
HERANÇA → AUTORIDADE → VIDA NO ESPÍRITO (quando sustentado pelo texto).

AUDITORIA EXEGÉTICA (quando pedirem para conferir uma interpretação)
Procure: palavra fora do contexto, erro de tradução, erro lexical, Strong mal usado,
etimologia equivocada, erro gramatical, anacronismo, prova de texto, contexto
ignorado, confusão entre significado e aplicação, confusão entre AT e NT, aplicação
apresentada como interpretação, doutrina não sustentada pelo texto.
Responda com as seções:
## O que está correto
## O que precisa ser ajustado
## Por quê
## A leitura mais bem sustentada pelo texto

DIVERGÊNCIAS: não esconda. Apresente interpretação, argumentos, textos, pontos
fortes, limitações, contexto e a posição da Palavra da Fé quando relevante.
Separe com clareza: O TEXTO DIZ / A INTERPRETAÇÃO SUGERE / A DOUTRINA CONCLUI /
A APLICAÇÃO PROPÕE.

REGRAS DE PRECISÃO
Nunca invente palavras hebraicas ou gregas, números de Strong, significados,
referências, traduções, contexto histórico, citações ou fontes. Sem segurança,
informe a limitação. Nunca use uma definição só porque favorece uma interpretação.
O significado é determinado pelo CONTEXTO.

═══════════════════════════════════════════════
COMO ESTA ABA FUNCIONA (regras do aplicativo)
═══════════════════════════════════════════════
1. A mensagem do usuário pode trazer um bloco "DADOS DO APARELHO": texto bíblico
   da tradução em uso, verbetes do léxico de Strong, dicionário teológico,
   tipologia, referências cruzadas e a base doutrinária que o pregador importou.
   Use-os como fonte principal e prefira-os à memória. O léxico embutido está em
   inglês: traduza e explique em português. A base doutrinária é material pessoal
   de estudo, não Escritura: use o entendimento dela sem citar o nome do material.
2. Não há acesso à internet. Se pedirem "pesquise fontes", investigue a partir do
   texto bíblico, dos dados do aparelho e do conhecimento geral reconhecido, e diga
   que não há consulta a fontes externas; nunca invente obras ou autores.
3. Cite referências bíblicas sempre entre colchetes, no formato [Romanos 5:1] ou
   [Romanos 5:1-5] — o aplicativo confere cada uma e abre o versículo ao toque.
   Ao citar texto bíblico literalmente, use apenas o que veio em DADOS DO APARELHO.
4. Formate em Markdown simples: títulos com "## ", listas com "- " ou "1. ",
   destaque com **negrito**. Sem tabelas, sem HTML, sem emojis.
5. Tudo em português do Brasil, inclusive termos explicados; palavras originais
   aparecem na escrita original e transliteradas, sempre com o significado.
6. Em conversa contínua, responda ao que foi perguntado agora, aproveitando o que
   já foi dito, sem repetir a resposta anterior.`;

const DEPTH_HINT: Record<AssistantDepth, string> = {
  auto: '',
  objetivo: 'PROFUNDIDADE PEDIDA: objetiva — vá direto ao essencial, em poucos parágrafos.',
  profundo: 'PROFUNDIDADE PEDIDA: profunda — exegese, léxico, contexto, teologia bíblica, relação com Cristo e Nova Aliança, doutrina e aplicação.',
};

const MODE_HINT: Record<AssistantMode, string> = {
  livre: '',
  auditoria: 'TAREFA: auditoria exegética da interpretação ou mensagem abaixo. Use as quatro seções da auditoria.',
};

/* ─────────────────────── dados do aparelho ─────────────────────── */

const MAX_REFS = 8;
const MAX_CHAPTER_VERSES = 60;
const MAX_WORDS = 6;

/** Palavras comuns do português que coincidem com transliterações (para, pate…). */
const COMMON_WORDS = new Set([
  'para', 'pela', 'pelo', 'como', 'sobre', 'entre', 'mais', 'onde', 'qual', 'quem',
  'essa', 'esse', 'esta', 'este', 'isso', 'isto', 'minha', 'meu', 'tema', 'texto',
  'nova', 'novo', 'vida', 'deus', 'jesus', 'cristo', 'fala', 'falar', 'dele', 'dela',
  'mesmo', 'mesma', 'pode', 'cada', 'toda', 'todo', 'tudo', 'nada', 'aqui', 'agora',
  'antes', 'depois', 'sem', 'com', 'que', 'uma', 'umas', 'uns', 'nos', 'nas', 'dos', 'das',
  'mostre', 'faca', 'estude', 'analise', 'compare', 'explique', 'prepare', 'encontre',
  'confira', 'pregacao', 'estudo', 'doutrina', 'palavra', 'significado', 'relacao',
]);

const CHAPTER_RE = /\b([1-3]\s?)?(\p{L}{3,})\.?\s(\d{1,3})\b(?![:.]\d)/gu;

/** Referências citadas no pedido: versículos ("Rm 5:1") e capítulos ("Romanos 4"). */
export function findRequestReferences(text: string): ParsedReference[] {
  const found: ParsedReference[] = findInlineReferences(text).map((m) => m.ref);
  for (const m of text.matchAll(CHAPTER_RE)) {
    const name = `${m[1] ?? ''}${m[2]}`;
    if (name.length < 3 || !findBook(name)) continue;
    const parsed = parseReference(`${name} ${m[3]}`);
    if (parsed) found.push({ book: parsed.book, chapter: parsed.chapter });
  }
  const seen = new Set<string>();
  return found.filter((r) => {
    const key = `${r.book}.${r.chapter}.${r.verse ?? ''}.${r.verseEnd ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function passageLines(translation: string, ref: ParsedReference): Promise<string> {
  const verses = await getChapter(translation, ref.book, ref.chapter).catch(() => [] as string[]);
  if (!verses.length) return '';
  const label = formatReference(ref);
  if (ref.verse) {
    const end = Math.min(ref.verseEnd ?? ref.verse, verses.length);
    const rows: string[] = [];
    for (let v = ref.verse; v <= end; v++) if (verses[v - 1]) rows.push(`${v} ${verses[v - 1]}`);
    return rows.length ? `[${label}]\n${rows.join('\n')}` : '';
  }
  const rows = verses.slice(0, MAX_CHAPTER_VERSES).map((t, i) => `${i + 1} ${t}`);
  const cut = verses.length > MAX_CHAPTER_VERSES ? '\n(capítulo cortado por tamanho)' : '';
  return `[${label}]\n${rows.join('\n')}${cut}`;
}

const stripTags = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const osisToLabel = (key: string): string => {
  const [book, chapter, verse] = key.split('.');
  return verse ? `${bookName(book)} ${chapter}:${verse}` : `${bookName(book)} ${chapter}`;
};

function dictLine(e: TheologicalEntry): string {
  const orig = [
    e.hebraico && `hebraico ${e.hebraico.palavra} (${e.hebraico.translit}${e.hebraico.strong ? `, ${e.hebraico.strong}` : ''})`,
    e.grego && `grego ${e.grego.palavra} (${e.grego.translit}${e.grego.strong ? `, ${e.grego.strong}` : ''})`,
  ].filter(Boolean).join('; ');
  return [
    `• ${e.termo}${orig ? ` — ${orig}` : ''}: ${e.definicao}`,
    e.distincao ? `  Distinção: ${e.distincao}` : '',
    e.textos.length ? `  Textos: ${e.textos.slice(0, 8).map(osisToLabel).join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

function typologyLine(t: TypologyPair): string {
  return `• ${t.titulo}: ${t.at.nome} → ${t.nt.nome}. ${t.explicacao}`;
}

export interface AssistantContext {
  /** Bloco de texto que vai para a IA. */
  block: string;
  /** Resumo do que foi juntado, para mostrar ao usuário (sem o conteúdo). */
  sources: string[];
}

export async function buildAssistantContext(
  text: string,
  passage: string,
  translation: string,
): Promise<AssistantContext> {
  const sections: string[] = [];
  const sources: string[] = [];

  /* 1. texto bíblico: a passagem informada vem primeiro */
  const main = passage.trim() ? parseReference(passage) : null;
  const refs = [...(main ? [main] : []), ...findRequestReferences(text)];
  // descarta o que já está dentro de uma passagem anterior (Rm 5:1 dentro de Rm 5:1-2)
  const covers = (a: ParsedReference, b: ParsedReference) =>
    a.book === b.book && a.chapter === b.chapter &&
    (!a.verse || (!!b.verse && b.verse >= a.verse && (b.verseEnd ?? b.verse) <= (a.verseEnd ?? a.verse)));
  const unique = refs.filter((r, i) => !refs.slice(0, i).some((o) => covers(o, r))).slice(0, MAX_REFS);
  const texts = (await Promise.all(unique.map((r) => passageLines(translation, r)))).filter(Boolean);
  if (texts.length) {
    sections.push(`TEXTO BÍBLICO (tradução em uso: ${translation}):\n${texts.join('\n\n')}`);
    sources.push(`${texts.length} ${texts.length === 1 ? 'passagem' : 'passagens'} da Bíblia`);
  }

  /* 2. versículo-alvo: referências cruzadas, dicionário teológico, tipologia */
  const anchor = unique.find((r) => r.verse);
  const dictFound = new Map<string, TheologicalEntry>();
  if (anchor?.verse) {
    const [cross, entries, types] = await Promise.all([
      getCrossReferences(anchor.book, anchor.chapter, anchor.verse),
      findEntriesForVerse(anchor.book, anchor.chapter, anchor.verse),
      findTypologyForVerse(anchor.book, anchor.chapter, anchor.verse),
    ]);
    if (cross.length) {
      sections.push(`REFERÊNCIAS CRUZADAS de ${formatReference(anchor)}: ${cross.slice(0, 10).map(osisToLabel).join(', ')}`);
      sources.push('referências cruzadas');
    }
    entries.slice(0, 3).forEach((e) => dictFound.set(e.id, e));
    if (types.length) {
      sections.push(`TIPOLOGIA (AT → NT):\n${types.slice(0, 3).map(typologyLine).join('\n')}`);
      sources.push('tipologia');
    }
  }

  /* 3. termos do dicionário teológico citados no pedido ("justificação") */
  const plain = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, ' ').trim();
  const normText = ` ${plain(text)} `;
  const dict = await getTheologicalDict();
  for (const e of dict) {
    if (dictFound.size >= 5) break;
    // "Logos — a Palavra eterna", "Filiação / Adoção": cada parte vale
    const variants = e.termo.split(/\s+[—–-]\s+|\s*\/\s*/).map(plain).filter((t) => t.length >= 2);
    if (variants.some((t) => normText.includes(` ${t} `))) dictFound.set(e.id, e);
  }
  if (dictFound.size) {
    sections.push(`DICIONÁRIO TEOLÓGICO DO APLICATIVO:\n${[...dictFound.values()].map(dictLine).join('\n')}`);
    sources.push('dicionário teológico');
  }

  /* 4. léxico: códigos Strong e palavras transliteradas (pistis, emunah…) */
  const lexLines: string[] = [];
  const seenCodes = new Set<string>();
  const addStrong = async (code: string) => {
    if (seenCodes.has(code)) return;
    seenCodes.add(code);
    const defs = await lookupStrong(code).catch(() => []);
    for (const d of defs.slice(0, 2)) lexLines.push(`• ${code} [${d.dictionary}]: ${stripTags(d.definition).slice(0, 900)}`);
  };
  const codes = [...new Set((text.match(/\b[HG]\d{1,5}\b/gi) ?? []).map((c) => c.toUpperCase()))].slice(0, MAX_WORDS);
  for (const c of codes) await addStrong(c);
  const words = [...new Set(
    (text.match(/[\p{L}ʼʻ'’-]{4,}/gu) ?? [])
      .filter((w) => !COMMON_WORDS.has(normalize(w)))
      .filter((w) => !findBook(w)),
  )];
  let tried = 0;
  for (const w of words) {
    if (seenCodes.size >= MAX_WORDS || tried >= 40) break;
    tried++;
    const entries = await findByTransliteration(w);
    for (const e of entries) await addStrong(e.code);
  }
  if (lexLines.length) {
    sections.push(`LÉXICO (verbetes encontrados pela grafia; use só se pertinentes ao pedido):\n${lexLines.join('\n')}`);
    sources.push(`léxico (${[...seenCodes].join(', ')})`);
  }

  /* 5. base doutrinária importada pelo pregador (fica só no aparelho dele) */
  if (unique.length) {
    const pack = await getDoctrinalPack().catch(() => null);
    if (pack) {
      const block = buildDoctrinalBlock(findGuidesForPassage(pack, unique[0], !unique[0].verse));
      if (block) {
        sections.push(`BASE DOUTRINÁRIA DO PREGADOR (material pessoal de estudo; não é Escritura):\n${block}`);
        sources.push('sua base doutrinária');
      }
    }
  }

  return {
    block: sections.length ? `DADOS DO APARELHO:\n\n${sections.join('\n\n')}` : '',
    sources,
  };
}

/* ───────────────────────────── a chamada ───────────────────────────── */

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Pedido do usuário: modo, profundidade e passagem usados. */
  mode?: AssistantMode;
  depth?: AssistantDepth;
  passage?: string;
  /** Resposta: referências citadas que existem de fato na tradução. */
  validRefs?: string[];
  sources?: string[];
  at: number;
}

/** Quantas mensagens anteriores vão junto — mantém o custo previsível. */
const HISTORY_TURNS = 8;

export async function runAssistant(input: {
  text: string;
  mode: AssistantMode;
  depth: AssistantDepth;
  passage: string;
  translation: string;
  history: AssistantMessage[];
}): Promise<{ content: string; validRefs: string[]; sources: string[] }> {
  const ctx = await buildAssistantContext(input.text, input.passage, input.translation);
  const header = [
    MODE_HINT[input.mode],
    DEPTH_HINT[input.depth],
    input.passage.trim() ? `PASSAGEM EM FOCO: ${input.passage.trim()}` : '',
  ].filter(Boolean).join('\n');

  const turns: ChatTurn[] = input.history.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content }));
  turns.push({
    role: 'user',
    content: [header, `PEDIDO:\n${input.text.trim()}`, ctx.block].filter(Boolean).join('\n\n'),
  });

  const maxTokens = input.depth === 'profundo' || input.mode === 'auditoria' ? 12288 : 8192;
  const raw = await chatComplete(`${SYSTEM_PROMPT}\n${ASSISTANT_PROMPT}`, turns, maxTokens);
  if (!raw.trim()) throw new Error('A IA não devolveu resposta. Tente de novo.');
  const validRefs = await validateReferences(input.translation, extractReferences(raw)).catch(() => []);
  return { content: raw.trim(), validRefs, sources: ctx.sources };
}
