import { db, getSetting, now } from './db';
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

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_KEY_SETTING = 'geminiKey';
export const GEMINI_MODEL_SETTING = 'geminiModel';
/** Escopo do material inteiro (as partes usam o id delas). */
export const WHOLE = 'livro';
/** Limite de texto por pedido (cerca de 250 mil palavras): cobre um livro grande. */
const MAX_CHARS = 1_500_000;

export async function getGeminiConfig(): Promise<{ key: string; model: string }> {
  const [key, model] = await Promise.all([getSetting(GEMINI_KEY_SETTING, ''), getSetting(GEMINI_MODEL_SETTING, '')]);
  return { key: String(key).trim(), model: String(model).trim() || DEFAULT_GEMINI_MODEL };
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
    `- resumo: ${whole ? 'de 4 a 8 parágrafos curtos, cobrindo o material do começo ao fim, na ordem dele' : 'de 2 a 4 parágrafos curtos'}, fiel ao texto;`,
    '- ideias: de 5 a 8 ideias principais, uma frase cada;',
    '- aplicacoes: de 3 a 6 aplicações práticas que o próprio texto ensina ou que decorrem diretamente dele;',
    '- perguntas: de 3 a 5 perguntas para reflexão pessoal ou discussão em grupo;',
    '- conceitos: até 8 termos importantes, com a definição no sentido em que o texto os usa.',
    'Regras: baseie-se somente no texto abaixo; não invente fatos, histórias, citações nem referências bíblicas que não estejam nele (se citar a Bíblia, use só as referências que aparecem no texto); não copie trechos longos literalmente; se o texto não trouxer algum item, devolva a lista vazia.',
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
  if (status === 404) return 'O modelo da IA não foi encontrado. Em Dados e ajustes, deixe o modelo em branco para usar o padrão.';
  if (status === 429) return 'O limite de uso do Gemini foi atingido. Espere um minuto e tente de novo.';
  if (status >= 500) return 'O serviço do Gemini está instável agora. Tente de novo em instantes.';
  return `A IA recusou o pedido (${status}). ${detail.slice(0, 160)}`;
}

/** Chama o Gemini e devolve o resumo; `fetchImpl` permite testar sem internet. */
export async function askGemini(
  prompt: string,
  config: { key: string; model: string },
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Pick<AiSummary, 'resumo' | 'ideias' | 'aplicacoes' | 'perguntas' | 'conceitos'>> {
  if (!config.key) throw new Error('Cadastre a chave do Gemini em Dados e ajustes para usar a IA.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA },
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
  if (json.promptFeedback?.blockReason) throw new Error('O Gemini não aceitou resumir este texto.');
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('A IA não devolveu texto. Tente de novo.');
  return parseAiAnswer(text);
}

/** Resume o escopo (material inteiro ou uma parte) e grava no material. */
export async function summarizeWithAi(
  materialId: string,
  scope: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<AiSummary> {
  const material = await db.materials.get(materialId);
  if (!material) throw new Error('Material não encontrado.');
  const config = await getGeminiConfig();
  const { prompt, scopeTitle } = buildPrompt(material, scope);
  const answer = await askGemini(prompt, config, opts);
  const summary: AiSummary = { scopeTitle, ...answer, provider: 'gemini', model: config.model, createdAt: now() };
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

/** Confere a chave e o modelo sem gastar uso: só pergunta ao Google se o modelo existe. */
export async function testGeminiKey(config: { key: string; model: string }, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!config.key) throw new Error('Digite a chave.');
  let res: Response;
  try {
    res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}`, {
      headers: { 'x-goog-api-key': config.key },
    });
  } catch {
    throw new Error('Sem conexão com o Gemini. A IA precisa de internet.');
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(explain(res.status, json.error?.message ?? ''));
  }
}
