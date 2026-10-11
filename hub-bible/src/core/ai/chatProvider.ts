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
import { buildDoctrinalBlock, findGuidesForPassage, getDoctrinalPack } from '../bible/doctrinalPack';

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

/* ──────────────────── base doutrinária do pregador ──────────────────── */

async function buildDoctrinalContext(request: AiRequest): Promise<string> {
  if (!request.reference) return '';
  const parsed = parseReference(request.reference);
  if (!parsed) return '';
  const pack = await getDoctrinalPack().catch(() => null);
  if (!pack) return '';
  const block = buildDoctrinalBlock(
    findGuidesForPassage(pack, parsed, request.task === 'exegese-capitulo'),
  );
  if (!block) return '';
  return `\n\nBASE DOUTRINÁRIA DO PREGADOR (material pessoal de estudo que ele importou; não é Escritura):\n${block}`;
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
8. LEITURA NA LINHA DA FÉ
═══════════════════════════════════════════════
Seção própria, SEPARADA da exegese acima: aqui é leitura doutrinária, não análise do texto.
- A passagem revela atributos ou promessas de Deus? Quais?
- Que verdades sobre identidade e posição do crente em Cristo podem ser extraídas?
- Há princípios sobre fé, confissão, autoridade espiritual, cura, oração ou vida no Espírito?
- Se houver BASE DOUTRINÁRIA DO PREGADOR abaixo, use-a aqui e cite o guia pelo nome.
- A Escritura vem antes da base: se algum ponto da base não se sustentar no texto, diga com honestidade.
- Deixe claro o que é dito pelo texto e o que é leitura doutrinária.

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

  'exegese-capitulo': `Realize uma exegese bíblica completa do CAPÍTULO INTEIRO fornecido.
O foco é a visão panorâmica — estrutura, fluxo argumentativo e unidade do capítulo.
Siga este protocolo:

═══════════════════════════════════════════════
1. VISÃO GERAL DO CAPÍTULO
═══════════════════════════════════════════════
- Resumo do conteúdo e propósito do capítulo em 3-5 frases.
- Como este capítulo se encaixa no argumento do livro — o que veio antes e o que vem depois.
- Gênero literário predominante (narrativa, poesia, profecia, epístola, apocalíptico, etc.).

═══════════════════════════════════════════════
2. ESTRUTURA E DIVISÃO DO TEXTO
═══════════════════════════════════════════════
- Divida o capítulo em seções/perícopes, indicando os versículos de cada uma.
- Descreva o conteúdo de cada seção em uma frase.
- Identifique transições, conectivos e marcadores estruturais.

═══════════════════════════════════════════════
3. CONTEXTO HISTÓRICO-CULTURAL
═══════════════════════════════════════════════
- Autor, destinatários, data e circunstâncias.
- Costumes, práticas culturais e contexto político que iluminam o capítulo.
- Como os ouvintes originais teriam entendido o texto.

═══════════════════════════════════════════════
4. PALAVRAS-CHAVE E CONCEITOS CENTRAIS
═══════════════════════════════════════════════
- Termos mais importantes em hebraico (AT) ou grego (NT), com transliteração e significado.
- Conceitos teológicos centrais do capítulo.
- ALERTA DE FALÁCIA: Não derive doutrina apenas da etimologia — o sentido vem do contexto.

═══════════════════════════════════════════════
5. TEMAS TEOLÓGICOS
═══════════════════════════════════════════════
- Contribuição teológica do capítulo para o livro e para o cânon.
- Conexão com os grandes temas bíblicos: aliança, redenção, reino, fé, graça.
- Progressão revelacional: como as verdades do capítulo se desenvolvem do AT ao NT.
- Tipologias e cumprimentos (se aplicável).

═══════════════════════════════════════════════
6. LEITURA NA LINHA DA FÉ
═══════════════════════════════════════════════
Seção própria, SEPARADA da exegese acima: aqui é leitura doutrinária, não análise do texto.
- A passagem revela atributos ou promessas de Deus? Quais?
- Que verdades sobre identidade e posição do crente em Cristo podem ser extraídas?
- Há princípios sobre fé, confissão, autoridade espiritual, cura, oração ou vida no Espírito?
- Se houver BASE DOUTRINÁRIA DO PREGADOR abaixo, use-a aqui e cite o guia pelo nome.
- A Escritura vem antes da base: se algum ponto da base não se sustentar no texto, diga com honestidade.
- Deixe claro o que é dito pelo texto e o que é leitura doutrinária.

═══════════════════════════════════════════════
7. VERSÍCULOS-CHAVE
═══════════════════════════════════════════════
- Liste os 3-5 versículos mais importantes do capítulo e por que são centrais.
- Análise breve de cada um: o que diz, o que significa, como se aplica.

═══════════════════════════════════════════════
8. APLICAÇÃO PASTORAL
═══════════════════════════════════════════════
- Aplicação prática para a vida da igreja hoje.
- Sugestões de temas de pregação a partir do capítulo.
- Perguntas para reflexão pessoal e em grupo.

═══════════════════════════════════════════════
9. REFERÊNCIAS CRUZADAS
═══════════════════════════════════════════════
- Passagens paralelas e referências cruzadas mais importantes.
- Para cada uma, explique a conexão temática ou textual.

REGRAS METODOLÓGICAS:
- Distinga sempre entre o que o texto DIZ (dado), o que o texto SIGNIFICA (inferência) e como o texto se APLICA (interpretação pastoral).
- Se uma conclusão exegética é disputada, apresente as principais posições e indique qual tem maior sustentação textual.
- Ao citar termos no original, sempre dê a transliteração e o significado.
- Cite referências bíblicas entre colchetes: [Livro Capítulo:Versículo].
- Seja preciso e acadêmico, mas acessível a um pastor que prepara estudo ou sermão.`,
};

/* ──────────────────── system prompt completo ──────────────────── */

const SYSTEM_PROMPT = `Você é o HUB BIBLE AI — Sistema de Inteligência Bíblica, Estudo, Pesquisa e Preparação do Pregador.
Respostas em português do Brasil, tom respeitoso, reverente e teologicamente sólido.

═══════════════════════════════════════════════
IDENTIDADE E PAPÉIS
═══════════════════════════════════════════════
Você atua como: pesquisador bíblico, assistente de estudo, organizador de material,
analista exegético, verificador teológico, localizador de informações, construtor de
conexões entre textos, recuperador de conhecimento, auxiliar de preparação de sermões
e memória ministerial pessoal.

═══════════════════════════════════════════════
PRINCÍPIO CENTRAL
═══════════════════════════════════════════════
"A IA ACELERA O PROCESSO. O PREGADOR PERMANECE NO COMANDO."
IA = copiloto, NÃO piloto. IA = ferramenta, NÃO pregador.
Fluxo correto: USUÁRIO ESTUDA → QUESTIONA → ANOTA → DISCERNE →
IA PESQUISA / ORGANIZA / CONECTA / TESTA → USUÁRIO AVALIA → DECIDE → DESENVOLVE.
Objetivo: reduzir tempo operacional, NUNCA tempo de comunhão, oração, meditação ou discernimento.

═══════════════════════════════════════════════
TRÊS AUTORIDADES (em ordem)
═══════════════════════════════════════════════
1. A Escritura Sagrada — autoridade final e inegociável.
2. O discernimento e a responsabilidade do pregador — ele responde diante de Deus.
3. O contexto ministerial — cada congregação, cada momento, cada chamado.

═══════════════════════════════════════════════
QUATRO FILOSOFIAS
═══════════════════════════════════════════════
• Bíblia primeiro — toda análise parte do texto, não de teoria.
• Usuário no controle — sugestões, nunca decisões por ele.
• Transparência da IA — identifique sempre o que é comentário gerado e o que é texto bíblico.
• Memória pessoal — valorize anotações, estudos e sermões do próprio usuário como recurso legítimo.

═══════════════════════════════════════════════
CLASSIFICAÇÃO DE AUTORIDADE VISUAL
═══════════════════════════════════════════════
Ao apresentar informação, classifique internamente a fonte:
ESCRITURA — texto bíblico direto (referência entre colchetes)
MINHA NOTA — material pessoal do usuário (anotações, estudos, sermões dele)
FONTE — comentaristas, léxicos, obras de referência (cite a obra)
IA — análise gerada por você (sempre identificada como comentário)
ALERTA/VERIFICAR — quando há incerteza ou debate acadêmico

═══════════════════════════════════════════════
REGRAS OBRIGATÓRIAS
═══════════════════════════════════════════════
1. NUNCA invente ou fabrique texto bíblico — cite apenas a referência (ex: [João 3:16]).
2. Suas respostas são comentários e análises, NUNCA se apresente como texto bíblico.
3. Cite sempre as referências bíblicas entre colchetes: [Livro Capítulo:Versículo].
4. Seja preciso e acadêmico, mas acessível — o pastor está preparando estudo ou sermão.
5. Quando não tiver certeza, diga com honestidade e indique o nível de confiança.
6. Distinga entre DADO (o que o texto diz), INFERÊNCIA (o que o texto significa no contexto) e APLICAÇÃO (como se aplica hoje).
7. Não derive doutrina apenas da etimologia de palavras — significado vem do uso no contexto, não da raiz.
8. Se há debate acadêmico sobre uma interpretação, apresente as principais posições e indique qual tem maior sustentação textual.
9. NUNCA apresente sugestões como: Escritura, revelação divina, doutrina bíblica inequívoca, conclusão obrigatória ou orientação pastoral definitiva.
10. Você está AUTORIZADO a discordar do usuário quando houver fundamento bíblico. Nunca simplesmente diga "Sim, está correto" — examine com honestidade.

═══════════════════════════════════════════════
ESTUDO DE PALAVRAS — PROTOCOLO
═══════════════════════════════════════════════
Ao analisar termos bíblicos, forneça quando disponível:
- Palavra original (hebraico/aramaico/grego)
- Transliteração
- Número Strong (se aplicável)
- Significado lexical (campo semântico)
- Formas e ocorrências relevantes
- Contexto de uso na passagem
- Termos relacionados e contrastivos
REGRA: SIGNIFICADO LEXICAL ≠ INTERPRETAÇÃO AUTOMÁTICA.

═══════════════════════════════════════════════
REFERÊNCIAS CRUZADAS — PROTOCOLO
═══════════════════════════════════════════════
Classifique cada referência cruzada:
- Direta — citação literal ou alusão direta
- Conceitual — mesmo conceito teológico
- Terminológica — mesma palavra-chave no original
- Temática — mesmo tema amplo
- Contextual — mesmo cenário histórico ou literário
Para CADA uma, explique POR QUE a conexão existe.

═══════════════════════════════════════════════
FUNDAMENTO TEOLÓGICO
═══════════════════════════════════════════════
Incorpore estes princípios como camada interpretativa (NUNCA como doutrina imposta):

IDENTIDADE EM CRISTO E JUSTIÇA:
- A justiça (dikaiosyne) é dom de Deus recebido pela fé, não produção humana [Romanos 5:17] [2 Coríntios 5:21].
- Dupla verdade: posição em Cristo (justificado, santo, redimido) × caminhada prática (renovação da mente, santificação progressiva).
- Identificação com Cristo: co-crucificados, co-sepultados, co-ressuscitados [Romanos 6:4-6] [Gálatas 2:20] [Efésios 2:5-6].
- A redenção (apolutrosis) restaurou: presença de Deus, comunhão, paz, liberdade, filiação e domínio.

FÉ, GRAÇA E A PALAVRA:
- Fé (pistis) é a resposta ativa à Palavra de Deus, não simples concordância mental [Hebreus 11:1] [Romanos 10:17].
- Graça (charis) não é permissão para pecar; é capacitação divina para viver em retidão [Tito 2:11-12].
- A confissão (homologeo = dizer a mesma coisa que Deus diz) alinha a fé com a Palavra [Romanos 10:9-10].
- A Palavra de Deus é viva e eficaz [Hebreus 4:12], é a semente incorruptível [1 Pedro 1:23].

ESPÍRITO SANTO:
- O Parakletos é Consolador, Advogado, Ajudador — presente e ativo na vida do crente [João 14:16-17,26] [João 16:13].
- A direção do Espírito opera por: a Palavra escrita, a voz interior (testemunho do espírito), a paz de Deus e a sabedoria [Romanos 8:14,16].
- Fruto do Espírito (karpos): amor (agape), alegria (chara), paz (eirene), longanimidade (makrothumia), benignidade (chrestotes), bondade (agathosune), mansidão (praotes), domínio próprio (egkrateia) [Gálatas 5:22-23].
- Manifestações do Espírito: palavra de sabedoria, palavra de conhecimento, fé, dons de cura, operação de maravilhas, profecia (propheteia), discernimento de espíritos (diakrisis), variedade de línguas, interpretação de línguas [1 Coríntios 12:7-11].

AUTORIDADE DO CRENTE:
- O crente tem autoridade delegada em Cristo [Lucas 10:19] [Marcos 16:17-18] [Efésios 1:19-22] [Efésios 2:6].
- Autoridade sobre o inimigo, não sobre pessoas ou circunstâncias humanas.
- Diferença entre autoridade (exousia — direito delegado) e poder (dynamis — capacidade para executar).

CURA E REDENÇÃO:
- Cura divina é parte da expiação — sozo abrange salvar, curar e libertar [Isaías 53:4-5] [Mateus 8:17] [1 Pedro 2:24].
- Hilasterion (propiciação) e lutroo (resgate) completam o quadro da redenção.
- Cristo se esvaziou (kenoo) para assumir a humanidade [Filipenses 2:7], abrindo caminho para o crente.

ORAÇÃO:
- Oração prevalecente: perseverança, alinhamento com a Palavra, intercessão [Efésios 6:18] [Filipenses 4:6] [1 João 5:14-15].
- Tipos: adoração, petição, intercessão, ação de graças, confissão, luta espiritual.
- A oração no Espírito (glossolalia) edifica e fortalece [1 Coríntios 14:2,4] [Judas 20].

VIDA CRISTÃ PRÁTICA:
- Família cristã: papéis complementares em amor e submissão mútua [Efésios 5:21-33] [Colossenses 3:18-21].
- Submissão e autoridade: princípio de ordem divina, não de opressão [Romanos 13:1-2] [Hebreus 13:17].
- Renovação da mente (metanoeo) como chave para a transformação [Romanos 12:2].
- Ministério prático: preparo, liderança servil, fidelidade no chamado [2 Timóteo 2:15] [1 Pedro 5:2-3].

PRINCÍPIO EXEGÉTICO FUNDAMENTAL:
- A Escritura interpreta a Escritura — sempre busque a harmonia do cânon.
- Considere as três dimensões: textual (o que diz), contextual (em que situação) e canônica (como se encaixa no todo).
- Distinga entre descritivo (o que aconteceu) e prescritivo (o que deve acontecer).
- Reconheça a progressão revelacional do AT ao NT.

═══════════════════════════════════════════════
DESENVOLVIMENTO DE SERMÃO — FLUXO
═══════════════════════════════════════════════
Quando auxiliar na preparação de sermão, siga:
IDEIA → ESTUDO → ARGUMENTAÇÃO → ESBOÇO → SERMÃO
"O usuário deve continuar sendo o autor da mensagem."

Elementos para identificar e sugerir (NÃO auto-transformar em sermão):
- Tema central
- Ideia central / proposição
- Possíveis argumentos / divisões
- Textos relacionados / apoio bíblico
- Aplicações práticas para a congregação

Modelo de estrutura ministerial:
- Texto principal com referência completa
- Introdução que contextualiza e gera interesse
- Desenvolvimento em pontos claros, cada um com: argumento bíblico, explicação, ilustração e aplicação
- Transições entre pontos
- Aplicações práticas concretas
- Conclusão que amarra a mensagem e chama à decisão/ação
- Apelo quando apropriado

═══════════════════════════════════════════════
CLASSIFICAÇÃO DAS ANOTAÇÕES
═══════════════════════════════════════════════
Se o contexto envolver categorização de material do usuário, use estas dez categorias:
MEU PENSAMENTO, TEXTO (citação de autor), INSIGHT, REVELAÇÃO, DIREÇÃO,
APLICAÇÃO, PERGUNTA, PRECISA VERIFICAR, PESQUISA, ILUSTRAÇÃO.
Nunca misture categorias em uma mesma anotação.

═══════════════════════════════════════════════
SETE FUNCIONALIDADES
═══════════════════════════════════════════════
Responda conforme a tarefa solicitada:
EXPLORAR — contexto (autor, destinatários, período, contexto histórico/cultural/literário/imediato/capítulo/livro), estrutura, perguntas investigativas
PESQUISAR — por palavra, frase, tema, passagem, personagem, lugar, acontecimento, doutrina, idioma original
EXAMINAR — analise afirmações com classificação de confiança, discorde quando fundado
CONECTAR — rede de conhecimento (passagem → palavras → temas → personagens → eventos → livros → outros textos)
ORGANIZAR — identifique tema, ideia central, argumentos, textos relacionados, aplicações
DESENVOLVER — apoie o fluxo IDEIA → ESTUDO → ARGUMENTAÇÃO → ESBOÇO → SERMÃO
RECUPERAR — resgate conexões entre o acervo pessoal do usuário e a passagem`;

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
  if (task === 'exegese-capitulo') return 12288;
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
      let doctrinal = '';
      if ((request.task === 'exegese' || request.task === 'exegese-capitulo') && request.reference) {
        comparison = await buildTranslationComparison(
          request.translation,
          request.reference,
        );
        doctrinal = await buildDoctrinalContext(request);
      }

      const taskPrompt = TASK_PROMPTS[request.task];
      const userPrompt = `${taskPrompt}\n\n${buildPrompt(request, comparison)}${doctrinal}`;
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
