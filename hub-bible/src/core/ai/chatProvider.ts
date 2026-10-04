/**
 * Provider concreto de IA — chama OpenAI ou Google Gemini.
 *
 * A chamada sai direto do navegador, com a chave do próprio usuário.
 * Nenhum backend nosso participa; a chave nunca sai do aparelho para
 * outro lugar que não a API escolhida.
 */

import type { AiProvider, AiRequest, AiResponse, AiSegment, AiTaskKind } from './provider';
import { AI_DISCLAIMER, validateReferences } from './provider';
import { loadAiConfig, type AiProviderId } from './config';

const TASK_PROMPTS: Record<AiTaskKind, string> = {
  'contexto-historico': `Explique o contexto histórico, cultural e geográfico da passagem bíblica fornecida.
Quem escreveu, para quem, quando, em que circunstâncias. Cite referências bíblicas relevantes entre colchetes, ex: [João 3:16].`,

  'comparar-passagens': `Compare as passagens bíblicas fornecidas. Identifique semelhanças, diferenças,
temas comuns e progressão teológica entre elas. Cite referências entre colchetes.`,

  'temas-relacionados': `Liste os principais temas teológicos presentes na passagem bíblica fornecida.
Para cada tema, sugira outras passagens bíblicas relacionadas. Cite referências entre colchetes.`,

  'perguntas-de-estudo': `Crie perguntas de estudo bíblico sobre a passagem fornecida.
Inclua perguntas de observação (o que o texto diz), interpretação (o que significa) e aplicação (como aplicar).
Cite referências entre colchetes.`,

  'estrutura-de-estudo': `Sugira uma estrutura de estudo bíblico para a passagem fornecida.
Inclua: introdução, divisão do texto, pontos principais, aplicações práticas e conclusão.
Cite referências entre colchetes.`,

  'referencias-cruzadas': `Liste as referências cruzadas mais importantes para a passagem fornecida.
Para cada uma, explique brevemente a conexão temática ou textual. Cite referências entre colchetes.`,
};

const SYSTEM_PROMPT = `Você é um assistente bíblico para pastores e líderes cristãos.
Suas respostas devem ser em português do Brasil, com tom respeitoso e teologicamente sólido.

REGRAS OBRIGATÓRIAS:
1. NUNCA invente ou fabrique texto bíblico — cite apenas a referência (ex: [João 3:16]).
2. Suas respostas são comentários e análises, NUNCA se apresente como texto bíblico.
3. Cite sempre as referências bíblicas entre colchetes: [Livro Capítulo:Versículo].
4. Seja conciso e direto — o pastor está preparando estudo ou sermão.
5. Quando não tiver certeza, diga com honestidade.`;

function extractReferences(text: string): string[] {
  const pattern = /\[([^\]]+)\]/g;
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function cleanResponse(text: string): AiSegment[] {
  const cleaned = text.replace(/\[([^\]]+)\]/g, '$1');
  const paragraphs = cleaned.split(/\n\n+/).filter((p) => p.trim());
  return paragraphs.map((p) => ({
    kind: 'ai-comment' as const,
    text: p.trim(),
  }));
}

async function callOpenAi(apiKey: string, model: string, system: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Chave de API inválida. Verifique nas Configurações.');
    if (res.status === 429) throw new Error('Limite de uso atingido. Aguarde alguns minutos.');
    throw new Error(`Erro na API OpenAI (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(apiKey: string, model: string, system: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 400 && err.includes('API_KEY')) throw new Error('Chave de API inválida. Verifique nas Configurações.');
    if (res.status === 429) throw new Error('Limite de uso atingido. Aguarde alguns minutos.');
    throw new Error(`Erro na API Gemini (${res.status}): ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function buildPrompt(request: AiRequest): string {
  const parts: string[] = [];
  if (request.reference) parts.push(`Passagem: ${request.reference}`);
  if (request.passage) parts.push(`Texto: "${request.passage}"`);
  if (request.topic) parts.push(`Tema: ${request.topic}`);
  parts.push(`\nTradução em uso: ${request.translation}`);
  return parts.join('\n');
}

function createChatProvider(providerId: Exclude<AiProviderId, 'none'>): AiProvider {
  const callApi = providerId === 'openai' ? callOpenAi : callGemini;

  return {
    id: providerId,
    label: providerId === 'openai' ? 'OpenAI' : 'Google Gemini',

    isConfigured(): boolean {
      const config = loadAiConfig();
      return config.provider === providerId && config.apiKey.length > 8;
    },

    async run(request: AiRequest): Promise<AiResponse> {
      const config = loadAiConfig();
      if (!config.apiKey) throw new Error('Configure a chave de API nas Configurações.');

      const taskPrompt = TASK_PROMPTS[request.task];
      const userPrompt = `${taskPrompt}\n\n${buildPrompt(request)}`;
      const model = config.model || (providerId === 'openai' ? 'gpt-4.1-mini' : 'gemini-3.8-flash');

      const raw = await callApi(config.apiKey, model, SYSTEM_PROMPT, userPrompt);
      const suggestedRefs = extractReferences(raw);
      const validRefs = await validateReferences(request.translation, suggestedRefs);

      return {
        segments: cleanResponse(raw),
        suggestedReferences: validRefs,
        provider: this.label,
        disclaimer: AI_DISCLAIMER,
      };
    },
  };
}

export function createProvider(): AiProvider | null {
  const config = loadAiConfig();
  if (config.provider === 'none' || !config.apiKey) return null;
  return createChatProvider(config.provider);
}
