/**
 * Provider concreto de IA — chama OpenAI, Google Gemini ou Anthropic.
 *
 * A chamada sai direto do navegador, com a chave do próprio usuário.
 * Nenhum backend nosso participa; a chave nunca sai do aparelho para
 * outro lugar que não a API escolhida.
 */

import type { AiProvider, AiRequest, AiResponse, AiSegment, AiTaskKind } from './provider';
import { AI_DISCLAIMER, validateReferences } from './provider';
import { loadAiConfig, type AiProviderId } from './config';
import { loadAvailableTranslations, getChapter } from '../bible/repository';
import { parseReference } from '../bible/reference';
import { bookName } from '../bible/canon';

/* ──────────────────── comparação multi-tradução ──────────────────── */

async function buildTranslationComparison(
  currentTranslation: string,
  reference: string,
): Promise<string> {
  const parsed = parseReference(reference);
  if (!parsed) return '';

  const translations = await loadAvailableTranslations();
  if (translations.length <= 1) return '';

  const lines: string[] = [];
  for (const t of translations) {
    try {
      const verses = await getChapter(t.id, parsed.book, parsed.chapter);
      if (!verses.length) continue;
      const name = bookName(parsed.book);
      let text: string;
      if (parsed.verse) {
        const start = parsed.verse - 1;
        const end = parsed.verseEnd ?? parsed.verse;
        const selected = verses.slice(start, end);
        if (!selected.length) continue;
        text = selected.map((v, i) => `${parsed.verse! + i} ${v}`).join(' ');
      } else {
        text = verses.map((v, i) => `${i + 1} ${v}`).join(' ');
      }
      const marker = t.id === currentTranslation ? ' (em uso)' : '';
      lines.push(`[${t.shortName ?? t.id}${marker}] ${name} ${parsed.chapter}${parsed.verse ? ':' + parsed.verse : ''} — ${text}`);
    } catch { /* tradução não tem esse livro */ }
  }
  if (lines.length <= 1) return '';
  return `\n\nCOMPARAÇÃO DE TRADUÇÕES DISPONÍVEIS:\n${lines.join('\n')}`;
}

/* ─────────────────────── prompts por tarefa ─────────────────────── */

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

  'exegese': `Realize uma exegese bíblica completa e estruturada da passagem fornecida.
Siga rigorosamente este protocolo:

═══════════════════════════════════════════════
1. TEXTO E TRADUÇÕES
═══════════════════════════════════════════════
- Analise a passagem na tradução em uso e nas demais traduções fornecidas (se houver).
- Identifique divergências de tradução que alteram o sentido teológico.
- Aponte onde uma tradução é mais literal, mais dinâmica ou mais interpretativa.
- Classifique cada diferença: terminológica, sintática ou teológica.

═══════════════════════════════════════════════
2. PALAVRAS-CHAVE NO ORIGINAL
═══════════════════════════════════════════════
- Identifique os termos mais importantes em hebraico (AT) ou grego (NT).
- Para cada termo forneça: transliteração, número Strong (se aplicável), significado raiz e campo semântico.
- Explique como o significado original ilumina o sentido da passagem.
- ALERTA DE FALÁCIA: Não derive doutrina apenas da etimologia. A palavra ganha sentido no contexto, não na raiz.

═══════════════════════════════════════════════
3. ANÁLISE GRAMATICAL
═══════════════════════════════════════════════
- Tempo verbal, voz e modo dos verbos principais (no original).
- Identifique construções gramaticais que alteram o sentido (imperativos, subjuntivos, particípios com função adverbial, etc.).
- Conectivos e partículas que indicam causa, consequência, contraste ou condição.

═══════════════════════════════════════════════
4. ESTRUTURA LITERÁRIA
═══════════════════════════════════════════════
- Gênero literário do trecho (narrativa, poesia, profecia, epístola, apocalíptico, sabedoria, lei).
- Figuras de linguagem (metáfora, metonímia, hipérbole, ironia, personificação).
- Estruturas retóricas: paralelismos, quiasmos, inclusões.
- Cadeia argumentativa do autor (se epístola ou discurso).

═══════════════════════════════════════════════
5. CONTEXTO HISTÓRICO-CULTURAL
═══════════════════════════════════════════════
- Contexto do autor: quem escreveu, para quem, quando, em que circunstâncias.
- Situação dos destinatários originais.
- Costumes, práticas culturais e contexto político que iluminam o texto.
- Como os ouvintes originais teriam entendido esta passagem?

═══════════════════════════════════════════════
6. CONTEXTO LITERÁRIO
═══════════════════════════════════════════════
- Como esta passagem se encaixa no argumento do livro.
- O que vem imediatamente antes e depois — e como isso afeta o sentido.
- Posição na macro-estrutura do livro.

═══════════════════════════════════════════════
7. TEOLOGIA BÍBLICA
═══════════════════════════════════════════════
- Contribuição teológica desta passagem para o livro e para o cânon.
- Conexão com os grandes temas bíblicos: aliança, redenção, reino, fé, graça.
- Progressão revelacional: como esta verdade se desenvolve do AT ao NT.
- Tipologia e cumprimento (se aplicável).

═══════════════════════════════════════════════
8. PERSPECTIVA DA FÉ
═══════════════════════════════════════════════
- A passagem revela atributos ou promessas de Deus? Quais?
- Que verdades sobre identidade e posição do crente em Cristo podem ser extraídas?
- Há princípios sobre fé, confissão, autoridade espiritual ou vida no Espírito?
- Como esta passagem sustenta a confiança na Palavra de Deus?

═══════════════════════════════════════════════
9. APLICAÇÃO PASTORAL
═══════════════════════════════════════════════
- Aplicação prática para a vida da igreja hoje.
- Perguntas para reflexão pessoal e em grupo.
- Conexões com desafios contemporâneos que a congregação enfrenta.

═══════════════════════════════════════════════
10. REFERÊNCIAS CRUZADAS
═══════════════════════════════════════════════
- Liste as passagens paralelas e referências cruzadas mais importantes.
- Para cada uma, explique a conexão temática ou textual.

REGRAS METODOLÓGICAS:
- Distinga sempre entre o que o texto DIZ (dado), o que o texto SIGNIFICA (inferência) e como o texto se APLICA (interpretação pastoral).
- Se uma conclusão exegética é disputada entre acadêmicos, apresente as principais posições e indique qual tem maior sustentação textual.
- Ao citar termos no original, sempre dê a transliteração e o significado — não presuma conhecimento de hebraico ou grego.
- Cite referências bíblicas entre colchetes: [Livro Capítulo:Versículo].
- Seja preciso e acadêmico, mas acessível a um pastor que prepara estudo ou sermão.`,
};

const SYSTEM_PROMPT = `Você é um assistente exegético e teológico para pastores e líderes cristãos.
Suas respostas devem ser em português do Brasil, com tom respeitoso e teologicamente sólido.

PRINCÍPIO FUNDAMENTAL:
A IA pesquisa e organiza. O pregador discerne, interpreta, aplica e comunica.
Você fornece ferramental acadêmico; a autoridade pastoral e espiritual pertence ao ministro.

REGRAS OBRIGATÓRIAS:
1. NUNCA invente ou fabrique texto bíblico — cite apenas a referência (ex: [João 3:16]).
2. Suas respostas são comentários e análises, NUNCA se apresente como texto bíblico.
3. Cite sempre as referências bíblicas entre colchetes: [Livro Capítulo:Versículo].
4. Seja preciso e acadêmico, mas acessível — o pastor está preparando estudo ou sermão.
5. Quando não tiver certeza, diga com honestidade e indique o nível de confiança.
6. Distinga entre DADO (o que o texto diz), INFERÊNCIA (o que o texto significa no contexto) e APLICAÇÃO (como se aplica hoje).
7. Não derive doutrina apenas da etimologia de palavras — significado vem do uso no contexto, não da raiz.
8. Se há debate acadêmico sobre uma interpretação, apresente as principais posições.`;

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

async function callOpenAi(apiKey: string, model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
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
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Chave de API inválida. Verifique nas Configurações.');
    if (res.status === 429) throw new Error('Limite de uso atingido. Aguarde alguns minutos.');
    if (res.status === 503 || res.status === 502) throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns minutos.');
    if (res.status === 404) throw new Error('Modelo não encontrado. Verifique o nome do modelo nas Configurações.');
    throw new Error(`Erro na API OpenAI (${res.status}). Tente novamente.`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGemini(apiKey: string, model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: maxTokens,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 400 && err.includes('API_KEY')) throw new Error('Chave de API inválida. Verifique nas Configurações.');
    if (res.status === 429) throw new Error('Limite de uso atingido. Aguarde alguns minutos.');
    if (res.status === 503 || res.status === 502) throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns minutos.');
    if (res.status === 404) throw new Error('Modelo não encontrado. Verifique o nome do modelo nas Configurações.');
    throw new Error(`Erro na API Gemini (${res.status}). Tente novamente.`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAnthropic(apiKey: string, model: string, system: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      system,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Chave de API inválida. Verifique nas Configurações.');
    if (res.status === 429) throw new Error('Limite de uso atingido. Aguarde alguns minutos.');
    if (res.status === 503 || res.status === 502) throw new Error('Serviço temporariamente indisponível. Tente novamente em alguns minutos.');
    if (res.status === 404) throw new Error('Modelo não encontrado. Verifique o nome do modelo nas Configurações.');
    throw new Error(`Erro na API Anthropic (${res.status}). Tente novamente.`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

const PROVIDER_LABELS: Record<Exclude<AiProviderId, 'none'>, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
};

const PROVIDER_DEFAULTS: Record<Exclude<AiProviderId, 'none'>, string> = {
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-3.8-flash',
  anthropic: 'claude-sonnet-5-5',
};

type ApiCaller = (apiKey: string, model: string, system: string, prompt: string, maxTokens: number) => Promise<string>;

function getApiCaller(providerId: Exclude<AiProviderId, 'none'>): ApiCaller {
  if (providerId === 'openai') return callOpenAi;
  if (providerId === 'anthropic') return callAnthropic;
  return callGemini;
}

function buildPrompt(request: AiRequest, comparison?: string): string {
  const parts: string[] = [];
  if (request.reference) parts.push(`Passagem: ${request.reference}`);
  if (request.passage) parts.push(`Texto: "${request.passage}"`);
  if (request.topic) parts.push(`Tema: ${request.topic}`);
  parts.push(`\nTradução em uso: ${request.translation}`);
  if (comparison) parts.push(comparison);
  return parts.join('\n');
}

function maxTokensForTask(task: AiTaskKind): number {
  if (task === 'exegese') return 8192;
  return 2048;
}

function createChatProvider(providerId: Exclude<AiProviderId, 'none'>): AiProvider {
  const callApi = getApiCaller(providerId);

  return {
    id: providerId,
    label: PROVIDER_LABELS[providerId],

    isConfigured(): boolean {
      const config = loadAiConfig();
      return config.provider === providerId && config.apiKey.length > 8;
    },

    async run(request: AiRequest): Promise<AiResponse> {
      const config = loadAiConfig();
      if (!config.apiKey) throw new Error('Configure a chave de API nas Configurações.');

      let comparison = '';
      if (request.task === 'exegese' && request.reference) {
        comparison = await buildTranslationComparison(
          request.translation,
          request.reference,
        );
      }

      const taskPrompt = TASK_PROMPTS[request.task];
      const userPrompt = `${taskPrompt}\n\n${buildPrompt(request, comparison)}`;
      const model = config.model || PROVIDER_DEFAULTS[providerId];
      const tokens = maxTokensForTask(request.task);

      const raw = await callApi(config.apiKey, model, SYSTEM_PROMPT, userPrompt, tokens);
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
