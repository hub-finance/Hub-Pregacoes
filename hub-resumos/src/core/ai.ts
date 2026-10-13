import { db, getSetting, now, setSetting } from './db';
import type { AiSummary, Material } from './types';

/**
 * IA opcional (Gemini, do Google) para resumir o material ou uma parte com
 * as próprias palavras: resumo, ideias principais, aplicações, perguntas e
 * conceitos.
 *
 * - Só funciona com a chave que o usuário cadastra em Dados e ajustes; sem
 *   ela, o app segue inteiro sem IA.
 * - O texto vai direto do aparelho para o Google; não passa por nenhum
 *   servidor do Hub.
 * - O resultado fica separado do texto do autor (material.ai) e sempre
 *   marcado como feito pela IA, para ser revisado.
 */

/** O modelo escolhido pelo usuário: Gemini 3.8 Flash. */
export const PREFERRED_GEMINI_MODEL = 'gemini-3.8-flash';
/** Usado só se a chave não listar modelos: o pedido vai para o 3.8 Flash. */
export const DEFAULT_GEMINI_MODEL = PREFERRED_GEMINI_MODEL;
export const GEMINI_KEY_SETTING = 'geminiKey';
/** Modelo escolhido pelo usuário (vazio = automático). */
export const GEMINI_MODEL_SETTING = 'geminiModel';
/** Modelo achado automaticamente ao conferir a chave. */
export const GEMINI_AUTO_MODEL_SETTING = 'geminiModelAuto';
/** Escopo do material inteiro (as partes usam o id delas). */
export const WHOLE = 'livro';
/** Limite de texto por pedido (cerca de 250 mil palavras): cobre um livro grande. */
const MAX_CHARS = 1_500_000;

export async function getGeminiConfig(): Promise<{ key: string; model: string; auto: boolean }> {
  const [key, model, auto] = await Promise.all([
    getSetting(GEMINI_KEY_SETTING, ''),
    getSetting(GEMINI_MODEL_SETTING, ''),
    getSetting(GEMINI_AUTO_MODEL_SETTING, ''),
  ]);
  const chosen = String(model).trim();
  return { key: String(key).trim(), model: chosen || String(auto).trim() || DEFAULT_GEMINI_MODEL, auto: !chosen };
}

const API = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * O Gemini 3.8 Flash quando a chave tem acesso a ele; senão, o Flash mais
 * novo e estável entre os modelos que a chave pode usar. Os
 * nomes mudam com o tempo (2.5, 3.x…) e o Google restringe os antigos a quem
 * já os usava; por isso o app pergunta ao Google em vez de fixar um nome.
 * Fica de fora o que não serve para resumir: lite, imagem, áudio, voz,
 * embeddings e versões experimentais.
 */
export function pickFlashModel(models: Array<{ name: string; supportedGenerationMethods?: string[] }>): string | null {
  const ok = models
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-.*flash/.test(n) && !/lite|image|audio|tts|live|embed|exp|thinking|8b/.test(n));
  if (!ok.length) return null;
  // o 3.8 Flash, escolhido pelo usuário, vem primeiro sempre que a chave tiver acesso a ele
  if (ok.includes(PREFERRED_GEMINI_MODEL)) return PREFERRED_GEMINI_MODEL;
  const version = (n: string) => Number(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? 0);
  const score = (n: string) => version(n) * 100 - (/preview/.test(n) ? 50 : 0) - (/-\d{3}$|-\d{2}-\d{4}$/.test(n) ? 1 : 0);
  return ok.sort((a, b) => score(b) - score(a) || a.length - b.length)[0];
}

/** Pergunta ao Google quais modelos a chave pode usar e escolhe o Flash. */
export async function detectFlashModel(key: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let res: Response;
  try {
    res = await fetchImpl(`${API}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
  } catch {
    throw new Error('Sem conexão com o Gemini. A IA precisa de internet.');
  }
  const json = (await res.json().catch(() => ({}))) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }>; error?: { message?: string } };
  if (!res.ok) throw new Error(explain(res.status, json.error?.message ?? ''));
  return pickFlashModel(json.models ?? []) ?? DEFAULT_GEMINI_MODEL;
}

const KIND_NAME = { livro: 'do livro', estudo: 'do estudo', resumo: 'do resumo' } as const;

/** O pedido à IA, em português, com as regras de fidelidade ao texto. */
export function buildPrompt(material: Material, scope: string): { prompt: string; scopeTitle: string } {
  const whole = scope === WHOLE;
  const section = whole ? undefined : material.sections.find((s) => s.id === scope);
  if (!whole && !section) throw new Error('Parte não encontrada.');
  const scopeTitle = whole ? material.title : section!.title || 'Parte';
  const text = whole ? material.sections.map((s) => `## ${s.title}\n${s.text}`).join('\n\n') : section!.text;
  if (!text.trim()) throw new Error('Não há texto para resumir.');
  const what = whole
    ? `o texto completo ${KIND_NAME[material.kind]} “${material.title}”`
    : `a parte “${scopeTitle}” ${KIND_NAME[material.kind]} “${material.title}”`;
  const prompt = [
    `Você é um assistente de estudo para pastores, líderes, professores e membros de igreja. Leia ${what}${material.author ? `, de ${material.author}` : ''}, e escreva em português do Brasil, com linguagem clara, didática e respeitosa:`,
    `- resumo: ${whole ? 'de 2 a 4 parágrafos curtos, no máximo 160 palavras ao todo, com a mensagem e a linha de raciocínio do material do começo ao fim' : '1 ou 2 parágrafos curtos, no máximo 80 palavras'}, fiel ao texto. Selecione o essencial: o leitor quer entender e aplicar rápido, não reler o livro;`,
    '- ideias: de 3 a 5 ideias principais, uma frase curta cada (até 20 palavras), sem repetir o resumo;',
    '- aplicacoes: de 3 a 4 aplicações práticas que o próprio texto ensina ou que decorrem diretamente dele, cada uma começando por um verbo;',
    '- perguntas: 3 perguntas para reflexão pessoal ou discussão em grupo;',
    '- conceitos: até 5 termos importantes, com a definição curta no sentido em que o texto os usa.',
    'Regras: baseie-se somente no texto abaixo; não invente fatos, histórias, citações nem referências bíblicas que não estejam nele (se citar a Bíblia, use só as referências que aparecem no texto); não copie trechos longos literalmente; não use reticências nem corte frases; se o texto não trouxer algum item, devolva a lista vazia.',
    '',
    'TEXTO:',
    text.slice(0, MAX_CHARS),
  ].join('\n');
  return { prompt, scopeTitle };
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    resumo: { type: 'STRING' },
    ideias: { type: 'ARRAY', items: { type: 'STRING' } },
    aplicacoes: { type: 'ARRAY', items: { type: 'STRING' } },
    perguntas: { type: 'ARRAY', items: { type: 'STRING' } },
    conceitos: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { termo: { type: 'STRING' }, definicao: { type: 'STRING' } }, required: ['termo', 'definicao'] },
    },
  },
  required: ['resumo', 'ideias', 'aplicacoes', 'perguntas', 'conceitos'],
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);

/** Lê a resposta da IA; aceita o JSON puro ou dentro de ```json … ```. */
export function parseAiAnswer(raw: string): Pick<AiSummary, 'resumo' | 'ideias' | 'aplicacoes' | 'perguntas' | 'conceitos'> {
  const body = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('A IA respondeu num formato inesperado. Tente de novo.');
  }
  const resumo = String(data.resumo ?? '').trim();
  if (!resumo) throw new Error('A IA não devolveu o resumo. Tente de novo.');
  const conceitos = Array.isArray(data.conceitos)
    ? (data.conceitos as Array<Record<string, unknown>>)
        .map((c) => ({ termo: String(c?.termo ?? '').trim(), definicao: String(c?.definicao ?? '').trim() }))
        .filter((c) => c.termo && c.definicao)
    : [];
  return { resumo, ideias: strings(data.ideias), aplicacoes: strings(data.aplicacoes), perguntas: strings(data.perguntas), conceitos };
}

/** Mensagem clara para cada erro que a API do Gemini costuma devolver. */
function explain(status: number, detail: string): string {
  if (status === 400 && /api key|API_KEY/i.test(detail)) return 'A chave do Gemini não é válida. Confira em Dados e ajustes.';
  if (status === 401 || status === 403) return 'A chave do Gemini não tem permissão. Confira em Dados e ajustes.';
  if (status === 404) return 'O modelo da IA não foi encontrado. Em Dados e ajustes, deixe o modelo em branco para o app escolher o Flash disponível.';
  if (status === 429) return 'O limite de uso do Gemini foi atingido. Espere um minuto e tente de novo.';
  if (status >= 500) return 'O serviço do Gemini está instável agora. Tente de novo em instantes.';
  return `A IA recusou o pedido (${status}). ${detail.slice(0, 160)}`;
}

/** Chama o Gemini pedindo JSON no formato `schema`; devolve o texto da resposta. */
export async function callGemini(
  prompt: string,
  config: { key: string; model: string },
  schema: object,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  if (!config.key) throw new Error('Cadastre a chave do Gemini em Dados e ajustes para usar a IA.');
  const url = `${API}/models/${encodeURIComponent(config.model)}:generateContent`;
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: schema },
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new Error('Sem conexão com o Gemini. A IA precisa de internet.');
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (!res.ok) throw new Error(explain(res.status, json.error?.message ?? ''));
  if (json.promptFeedback?.blockReason) throw new Error('O Gemini não aceitou ler este texto.');
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('A IA não devolveu texto. Tente de novo.');
  return text;
}

/** Usa o modelo configurado; se o automático saiu de linha, acha o Flash atual e repete. */
export async function withModel<T>(opts: { fetchImpl?: typeof fetch }, run: (config: { key: string; model: string }) => Promise<T>): Promise<T> {
  const config = await getGeminiConfig();
  try {
    return await run(config);
  } catch (err) {
    if (!config.auto || !/modelo da IA não foi encontrado/.test((err as Error).message)) throw err;
    config.model = await detectFlashModel(config.key, opts.fetchImpl);
    await setSetting(GEMINI_AUTO_MODEL_SETTING, config.model);
    return run(config);
  }
}

/** Chama o Gemini e devolve o resumo; `fetchImpl` permite testar sem internet. */
export async function askGemini(
  prompt: string,
  config: { key: string; model: string },
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Pick<AiSummary, 'resumo' | 'ideias' | 'aplicacoes' | 'perguntas' | 'conceitos'>> {
  return parseAiAnswer(await callGemini(prompt, config, SCHEMA, opts));
}

/** Quanto do começo do livro vai para a IA achar o sumário (capa, ficha, sumário e as primeiras páginas). */
const TOC_CHARS = 60_000;

/**
 * Leitura inteligente do sumário: a IA lê o começo do livro (onde estão o
 * sumário ou o índice) e devolve os títulos dos capítulos — ou seções,
 * lições, partes — na ordem e escritos como no livro. Quem divide o texto
 * continua sendo o app (splitByChapterTitles), procurando cada título.
 */
export async function aiChapterTitles(text: string, opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<string[]> {
  const prompt = [
    'Abaixo está o começo de um livro ou estudo (capa, ficha catalográfica, sumário ou índice e as primeiras páginas).',
    'Liste os títulos das divisões principais do conteúdo — capítulos, seções, lições ou partes, o que o livro usar —, na ordem, escritos exatamente como aparecem no sumário ou no texto.',
    'Regras: não inclua números de página; mantenha o número do capítulo se fizer parte do título (ex.: "1. Origens"); junte num só título o que estiver quebrado em duas linhas; não inclua capa, ficha catalográfica, dedicatória, agradecimentos, prefácio de outra pessoa, o próprio sumário nem cabeçalhos de página; se houver partes e capítulos, liste os capítulos; não invente títulos.',
    '',
    'TEXTO:',
    text.slice(0, TOC_CHARS),
  ].join('\n');
  const schema = { type: 'OBJECT', properties: { titulos: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['titulos'] };
  return withModel(opts, async (config) => {
    const raw = await callGemini(prompt, config, schema, opts);
    let data: { titulos?: unknown };
    try {
      data = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
    } catch {
      throw new Error('A IA respondeu num formato inesperado. Tente de novo.');
    }
    const titles = strings(data.titulos);
    if (titles.length < 2) throw new Error('A IA não achou o sumário deste livro.');
    return titles;
  });
}

/** Resume o escopo (material inteiro ou uma parte) e grava no material. */
export async function summarizeWithAi(
  materialId: string,
  scope: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<AiSummary> {
  const material = await db.materials.get(materialId);
  if (!material) throw new Error('Material não encontrado.');
  const { prompt, scopeTitle } = buildPrompt(material, scope);
  let model = '';
  const answer = await withModel(opts, (config) => {
    model = config.model;
    return askGemini(prompt, config, opts);
  });
  const summary: AiSummary = { scopeTitle, ...answer, provider: 'gemini', model, createdAt: now() };
  // relê antes de gravar: o usuário pode ter editado o material enquanto a IA trabalhava
  const latest = await db.materials.get(materialId);
  if (latest) await db.materials.put({ ...latest, ai: { ...(latest.ai ?? {}), [scope]: summary } });
  return summary;
}

export async function removeAiSummary(materialId: string, scope: string): Promise<void> {
  const m = await db.materials.get(materialId);
  if (!m?.ai?.[scope]) return;
  const ai = { ...m.ai };
  delete ai[scope];
  await db.materials.put({ ...m, ai });
}

/** O resumo da IA em Markdown, para baixar ou copiar. */
export function aiSummaryMarkdown(s: AiSummary, materialTitle: string): string {
  const list = (title: string, items: string[]) => (items.length ? [`## ${title}`, '', ...items.map((x) => `- ${x}`), ''] : []);
  return [
    `# ${s.scopeTitle === materialTitle ? s.scopeTitle : `${materialTitle} — ${s.scopeTitle}`}`,
    '',
    `> Resumo feito pela IA (${s.model}) em ${new Date(s.createdAt).toLocaleDateString('pt-BR')}. Revise antes de usar.`,
    '',
    '## Resumo',
    '',
    s.resumo,
    '',
    ...list('Ideias principais', s.ideias),
    ...list('Aplicações', s.aplicacoes),
    ...list('Perguntas para reflexão', s.perguntas),
    ...(s.conceitos.length ? ['## Conceitos', '', ...s.conceitos.map((c) => `- **${c.termo}:** ${c.definicao}`), ''] : []),
  ].join('\n');
}

/**
 * Confere a chave sem gastar uso e devolve o modelo que será usado: o
 * escolhido pelo usuário (se existir para esta chave) ou o Flash achado.
 */
export async function testGeminiKey(config: { key: string; model?: string }, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (!config.key) throw new Error('Digite a chave.');
  if (!config.model) return detectFlashModel(config.key, fetchImpl);
  let res: Response;
  try {
    res = await fetchImpl(`${API}/models/${encodeURIComponent(config.model)}`, { headers: { 'x-goog-api-key': config.key } });
  } catch {
    throw new Error('Sem conexão com o Gemini. A IA precisa de internet.');
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(explain(res.status, json.error?.message ?? ''));
  }
  return config.model;
}
