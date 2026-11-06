import { db, now, uid } from '../db/db';
import type { AssistantMessage } from '../ai/assistant';
import type { AssistantDocument, AssistantGoal } from '../ai/assistantDocument';

/**
 * Conversas do assistente bíblico, guardadas no aparelho.
 *
 * Ficam numa única chave de `settings` (sem mudar o esquema do banco): são
 * poucas e pequenas. Não entram no backup: o que o pregador quer guardar de
 * vez ele salva como anotação, e a anotação vai no backup.
 */

export interface AssistantConversation {
  id: string;
  title: string;
  messages: AssistantMessage[];
  /** Ausente nas conversas anteriores ao documento: valem como pergunta livre. */
  goal?: AssistantGoal;
  /** O estudo, a mensagem ou o resumo montado a partir da conversa. */
  document?: AssistantDocument;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'assistant:conversations';
/** As mais antigas saem quando passa disso. */
const MAX_CONVERSATIONS = 40;

async function readAll(): Promise<AssistantConversation[]> {
  const row = await db.settings.get(KEY);
  return Array.isArray(row?.value) ? (row!.value as AssistantConversation[]) : [];
}

export async function listConversations(): Promise<AssistantConversation[]> {
  return (await readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function newConversation(): AssistantConversation {
  const t = now();
  return { id: uid(), title: '', messages: [], createdAt: t, updatedAt: t };
}

/** Título curto a partir do primeiro pedido. */
export function conversationTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 70 ? `${clean.slice(0, 67)}…` : clean;
}

export async function saveConversation(conv: AssistantConversation): Promise<void> {
  const all = (await readAll()).filter((c) => c.id !== conv.id);
  all.push({ ...conv, updatedAt: now() });
  all.sort((a, b) => b.updatedAt - a.updatedAt);
  await db.settings.put({ key: KEY, value: all.slice(0, MAX_CONVERSATIONS) });
}

export async function removeConversation(id: string): Promise<void> {
  const all = (await readAll()).filter((c) => c.id !== id);
  await db.settings.put({ key: KEY, value: all });
}
