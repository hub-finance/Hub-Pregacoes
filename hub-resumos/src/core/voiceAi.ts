import { callGemini, withModel } from './ai';
import { now } from './db';
import { myWritings, saveVoiceSettings, writingTraits } from './voice';

/** Quanto texto dos escritos vai para a IA descrever o estilo (os mais recentes primeiro). */
const SAMPLE_CHARS = 60_000;

const PROFILE_SCHEMA = { type: 'OBJECT', properties: { perfil: { type: 'STRING' } }, required: ['perfil'] };

export function buildProfilePrompt(texts: Array<{ title: string; text: string }>, authorName: string): string {
  let budget = SAMPLE_CHARS;
  const parts: string[] = [];
  for (const t of texts) {
    if (budget <= 0) break;
    const chunk = t.text.slice(0, Math.max(0, budget));
    budget -= chunk.length;
    parts.push(`### ${t.title}\n${chunk}`);
  }
  return [
    `Você vai descrever o estilo de escrita e de ensino de ${authorName || 'um pastor e autor cristão'}, a partir dos escritos dele abaixo (mensagens, estudos e textos), para que outra IA escreva resumos na mesma voz.`,
    'Descreva, em português do Brasil, de forma objetiva e em no máximo 280 palavras, só o que se vê nos textos:',
    '1. vocabulário recorrente; 2. construção das frases; 3. como introduz e desenvolve uma ideia; 4. como liga textos bíblicos; 5. como apresenta princípios espirituais; 6. estilo de argumentação; 7. uso de perguntas reflexivas; 8. como constrói aplicações práticas; 9. tom pastoral e formativo; 10. como conclui um ensinamento.',
    'Regras: não invente traços que não aparecem; não copie frases longas; quando um aspecto não aparecer nos textos, diga "não observado". Dê mais peso aos primeiros textos (são os mais recentes). Responda no campo "perfil", em tópicos curtos numerados de 1 a 10.',
    '',
    'ESCRITOS:',
    ...parts,
  ].join('\n');
}

/** A IA lê os escritos do autor e descreve o estilo; o resultado fica nas configurações para ele revisar. */
export async function generateVoiceProfile(authorName: string, opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<string> {
  const mine = await myWritings();
  if (!mine.length) throw new Error('Marque pelo menos um material como “Escrito meu” (aba Editar) para a IA conhecer a sua linguagem.');
  const texts = mine.map((m) => ({ title: m.title, text: m.sections.map((s) => `${s.title}\n${s.text}`).join('\n\n') }));
  const prompt = buildProfilePrompt(texts, authorName);
  let model = '';
  const profile = await withModel(opts, (config) => {
    model = config.model;
    return callGemini(prompt, config, PROFILE_SCHEMA, opts).then((raw) => {
      let d: { perfil?: unknown };
      try {
        d = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
      } catch {
        throw new Error('A IA respondeu num formato inesperado. Tente de novo.');
      }
      const text = String(d.perfil ?? '').trim();
      if (!text) throw new Error('A IA não devolveu o perfil. Tente de novo.');
      return text;
    });
  });
  await saveVoiceSettings({ profile: profile, profileModel: model, profileAt: now(), profileFrom: writingTraits(mine).count });
  return profile;
}
