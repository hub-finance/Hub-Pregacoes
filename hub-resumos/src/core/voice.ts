import { db, getSetting, setSetting } from './db';
import { keywords, readMaterial, sentences } from './text';
import type { Material } from './types';

/**
 * Identidade de linguagem (Instrução Mestra do usuário): toda resposta da IA
 * sai na voz editorial do autor — natural, pastoral e formativa, pela
 * perspectiva da Palavra da Fé —, fiel à fonte e separando o que o autor do
 * livro escreveu, o que é análise da IA e o que é aplicação da fé.
 *
 * O perfil de linguagem é aprendido dos materiais que o usuário marca como
 * "Escrito meu" (etiqueta `meus-escritos`): vocabulário, versículos, ritmo das
 * frases e trechos de referência. Tudo no próprio aparelho.
 */
export const MY_WRITINGS_TAG = 'meus-escritos';

export interface VoiceSettings {
  /** Liga a identidade de linguagem nos pedidos à IA. */
  enabled: boolean;
  /** Nome do autor, para a IA saber de quem é a voz. */
  authorName: string;
  /** Descrição do estilo feita pela IA (ou escrita/ajustada pelo usuário). */
  profile: string;
  profileModel?: string;
  profileAt?: number;
  /** Quantos escritos havia quando o perfil foi feito. */
  profileFrom?: number;
}

export const DEFAULT_VOICE: VoiceSettings = { enabled: true, authorName: '', profile: '' };
const KEY = 'voice';

export const getVoiceSettings = async (): Promise<VoiceSettings> => ({ ...DEFAULT_VOICE, ...(await getSetting<Partial<VoiceSettings>>(KEY, {})) });
export const saveVoiceSettings = async (patch: Partial<VoiceSettings>) => setSetting(KEY, { ...(await getVoiceSettings()), ...patch });

export const isMyWriting = (m: Pick<Material, 'tags'>) => m.tags.includes(MY_WRITINGS_TAG);

/** Os escritos do autor, do mais recente para o mais antigo (o atual vale mais). */
export async function myWritings(): Promise<Material[]> {
  return (await db.materials.toArray()).filter(isMyWriting).sort((a, b) => b.updatedAt - a.updatedAt);
}

export interface WritingTraits {
  count: number;
  words: number;
  vocabulary: string[];
  verses: string[];
  avgSentence: number;
  /** Perguntas a cada 100 frases. */
  questionsPer100: number;
  samples: string[];
}

/**
 * O que dá para medir dos escritos sem IA: palavras que mais usa, versículos a
 * que mais volta, tamanho médio das frases, uso de perguntas e alguns trechos
 * representativos (dos escritos mais recentes primeiro).
 */
export function writingTraits(materials: Material[]): WritingTraits {
  const merged = { sections: materials.flatMap((m) => m.sections) } as Material;
  const r = readMaterial(merged);
  const all = r.sections.flatMap((s) => [...s.paragraphs, ...s.highlights].flatMap(sentences));
  const words = all.reduce((n, x) => n + x.split(/\s+/).length, 0);
  const samples: string[] = [];
  for (const m of materials) {
    const rm = readMaterial(m);
    const pool = [...rm.highlights.map((h) => h.text), ...rm.sections.flatMap((s) => s.paragraphs.flatMap(sentences))].filter((x) => {
      const n = x.split(/\s+/).length;
      return n >= 12 && n <= 40 && /^\p{Lu}/u.test(x);
    });
    for (const x of pool.slice(0, 3)) if (samples.length < 10 && !samples.includes(x)) samples.push(x);
    if (samples.length >= 10) break;
  }
  return {
    count: materials.length,
    words: r.words,
    vocabulary: keywords(merged, 20).map((k) => k.word),
    verses: r.references.slice(0, 10).map((x) => x.label),
    avgSentence: all.length ? Math.round(words / all.length) : 0,
    questionsPer100: all.length ? Math.round((all.filter((x) => x.endsWith('?')).length / all.length) * 100) : 0,
    samples,
  };
}

/** As regras da Instrução Mestra, resumidas para caber em todo pedido à IA. */
export const VOICE_RULES = [
  'IDENTIDADE DE LINGUAGEM (obrigatório):',
  '- Escreva com linguagem natural e humana, fluida, pastoral e formativa; profunda, mas fácil de entender; didática sem ser simplista; inspiradora sem exagero emocional; teologicamente consistente. O texto deve parecer escrito por alguém que entendeu o assunto, refletiu e sabe comunicá-lo — nunca por um robô, um manual genérico ou um artigo acadêmico frio.',
  '- Leia pela perspectiva da Palavra da Fé: a centralidade da Palavra de Deus, a Nova Aliança em Cristo, a identidade e a autoridade do crente em Cristo, a fé fundamentada na Palavra, as convicções espirituais, a renovação da mente, a prática da Palavra no dia a dia e a maturidade espiritual — a coerência entre o que Deus diz, o que cremos e como vivemos. Desenvolva essas ideias com contexto bíblico e aplicação; não as transforme em fórmulas repetidas.',
  '- Essa perspectiva orienta a leitura, mas não distorce o sentido dos textos bíblicos nem faz o autor do livro dizer o que ele não disse.',
  '- Varie a construção dos parágrafos, use transições naturais e argumentação progressiva. Sem introduções vazias, conclusões previsíveis, frases de efeito ou repetições. Não transforme tudo em pregação: o tom pastoral aparece quando o assunto pede.',
  '- Evite expressões automáticas como "É importante destacar que", "Nesse sentido", "Vale ressaltar que", "Em suma", "Diante do exposto", "No contexto atual".',
  '- Quando o assunto for bíblico: considere o contexto histórico, cultural e literário, o contexto do livro, o sentido das palavras no hebraico, aramaico ou grego quando pertinente, referências cruzadas e a relação entre Antiga e Nova Aliança. Não decida o sentido de uma passagem por uma palavra isolada. Não invente referências, significados do original nem dados históricos; quando houver divergência de interpretação relevante, diga.',
  '- FIDELIDADE: preserve a mensagem, os argumentos, os conceitos e a sequência do autor original. Não invente experiências, testemunhos, opiniões nem frases do autor.',
].join('\n');

export const ORIGIN_RULE =
  'Separe sempre as três camadas: "texto" = o que o autor do material escreveu; "ia" = análise, explicação ou conexão feita por você; "fe" = aplicação ou conexão pela perspectiva da Palavra da Fé. Nunca apresente análise ou aplicação como se fosse afirmação do autor.';

/** O trecho que entra em todo pedido à IA (vazio quando o usuário desligou). */
export async function voicePrompt(): Promise<string> {
  const v = await getVoiceSettings();
  if (!v.enabled) return '';
  const mine = await myWritings();
  const lines = ['', VOICE_RULES];
  if (v.authorName) lines.push(`- A voz editorial é a de ${v.authorName}.`);
  if (v.profile.trim()) lines.push('', `PERFIL DE LINGUAGEM DO AUTOR${v.authorName ? ` (${v.authorName})` : ''}, para seguir no estilo:`, v.profile.trim());
  if (mine.length) {
    const t = writingTraits(mine.slice(0, 12));
    lines.push(
      '',
      `TRAÇOS MEDIDOS NOS ESCRITOS DO AUTOR (${t.count} escrito${t.count === 1 ? '' : 's'}):`,
      `- palavras que ele mais usa: ${t.vocabulary.join(', ')};`,
      t.verses.length ? `- versículos a que ele mais volta: ${t.verses.join('; ')};` : '',
      `- frases com cerca de ${t.avgSentence} palavras${t.questionsPer100 >= 5 ? '; usa perguntas reflexivas com frequência' : ''};`,
      '- trechos dele, só como referência de ESTILO (não copie, não cite e não atribua ao autor do material estudado):',
      ...t.samples.map((x) => `  « ${x} »`),
    );
  } else if (!v.profile.trim()) {
    lines.push('- Ainda não há escritos do autor no sistema: use uma escrita natural e coerente com estas orientações, sem fingir que conhece o estilo dele.');
  }
  return lines.filter((x) => x !== '').join('\n');
}

/**
 * Tira, das respostas da IA, as muletas que a Instrução Mestra proíbe quando
 * abrem a frase ("É importante destacar que…", "Em suma, …"): a frase fica com
 * o que ela tem a dizer.
 */
const STOCK_OPENERS = [
  /é importante (destacar|ressaltar|lembrar|notar|frisar|observar) que\s*/giu,
  /vale (a pena )?(ressaltar|destacar|lembrar|notar|frisar) que\s*/giu,
  /cabe (ressaltar|destacar|lembrar) que\s*/giu,
  /nesse sentido,\s*/giu,
  /neste sentido,\s*/giu,
  /em suma,\s*/giu,
  /diante do exposto,\s*/giu,
  /no contexto atual,\s*/giu,
  /em resumo,\s*/giu,
];

export function humanize(text: string): string {
  let out = text;
  for (const re of STOCK_OPENERS) out = out.replace(re, '');
  // a frase que ficou começa com maiúscula
  return out.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\s{2,}/g, ' ').trim();
}
