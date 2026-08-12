/**
 * IA Bíblica — contrato de integração (seção 31 da especificação).
 *
 * A arquitetura está pronta, mas NENHUM provedor vem habilitado. Regras que
 * qualquer implementação futura precisa respeitar:
 *
 *  1. A IA nunca inventa citações bíblicas. Todo texto bíblico exibido vem do
 *     repositório local (`core/bible/repository`), nunca do modelo.
 *  2. Toda saída do modelo é marcada como `kind: 'ai-comment'` e a interface
 *     precisa distinguir visualmente TEXTO BÍBLICO de COMENTÁRIO GERADO POR IA.
 *  3. As referências sugeridas pela IA são validadas contra o cânon antes de
 *     serem mostradas (`validateReferences`).
 */

import { parseReference } from '../bible/reference';
import { getMeta } from '../bible/repository';

export type AiTaskKind =
  | 'contexto-historico'
  | 'comparar-passagens'
  | 'temas-relacionados'
  | 'perguntas-de-estudo'
  | 'estrutura-de-estudo'
  | 'referencias-cruzadas';

export interface AiRequest {
  task: AiTaskKind;
  translation: string;
  reference?: string;
  passage?: string;
  topic?: string;
  locale?: string;
}

export interface AiSegment {
  /** 'scripture' só pode ser produzido pelo app, jamais pelo modelo. */
  kind: 'scripture' | 'ai-comment';
  title?: string;
  text: string;
  reference?: string;
}

export interface AiResponse {
  segments: AiSegment[];
  suggestedReferences: string[];
  provider: string;
  disclaimer: string;
}

export interface AiProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  run(request: AiRequest): Promise<AiResponse>;
}

export const AI_DISCLAIMER =
  'Comentário gerado por inteligência artificial. Confira sempre com o texto bíblico e com a orientação pastoral.';

let provider: AiProvider | null = null;

export function registerAiProvider(next: AiProvider | null): void {
  provider = next;
}

export const getAiProvider = (): AiProvider | null => provider;
export const isAiEnabled = (): boolean => !!provider?.isConfigured();

/**
 * Mantém apenas referências que existem de fato na tradução carregada — trava
 * de segurança contra citações inventadas.
 */
export async function validateReferences(
  translation: string,
  references: string[],
): Promise<string[]> {
  const meta = await getMeta(translation);
  const valid: string[] = [];
  for (const raw of references) {
    const parsed = parseReference(raw);
    if (!parsed) continue;
    const book = meta.books.find((b) => b.osis === parsed.book);
    if (!book) continue;
    if (parsed.chapter < 1 || parsed.chapter > book.chapters) continue;
    const verses = book.verseCounts[parsed.chapter - 1] ?? 0;
    if (parsed.verse && parsed.verse > verses) continue;
    valid.push(raw);
  }
  return valid;
}
