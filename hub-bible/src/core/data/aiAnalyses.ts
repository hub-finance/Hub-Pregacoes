import { db, now, uid } from '../db/db';
import { LOCAL_USER, type AiAnalysis } from '../db/types';
import type { AiResponse, AiTaskKind } from '../ai/provider';

function buildLookupKey(task: string, reference: string, translation: string): string {
  return `${task}:${reference}:${translation}`;
}

export async function findAnalysis(
  task: AiTaskKind,
  reference: string,
  translation: string,
): Promise<AiAnalysis | undefined> {
  const key = buildLookupKey(task, reference, translation);
  return db.aiAnalyses.where('lookupKey').equals(key).first();
}

export async function saveAnalysis(input: {
  task: AiTaskKind;
  reference: string;
  translation: string;
  response: AiResponse;
}): Promise<AiAnalysis> {
  const key = buildLookupKey(input.task, input.reference, input.translation);
  const existing = await db.aiAnalyses.where('lookupKey').equals(key).first();

  if (existing) {
    const patch: Partial<AiAnalysis> = {
      segments: input.response.segments.map((s) => ({
        kind: s.kind,
        title: s.title,
        text: s.text,
        reference: s.reference,
      })),
      suggestedReferences: input.response.suggestedReferences,
      provider: input.response.provider,
      disclaimer: input.response.disclaimer,
      updatedAt: now(),
    };
    await db.aiAnalyses.update(existing.id, patch);
    return { ...existing, ...patch };
  }

  const timestamp = now();
  const analysis: AiAnalysis = {
    id: uid('ai_'),
    userId: LOCAL_USER,
    task: input.task,
    reference: input.reference,
    translation: input.translation,
    lookupKey: key,
    provider: input.response.provider,
    segments: input.response.segments.map((s) => ({
      kind: s.kind,
      title: s.title,
      text: s.text,
      reference: s.reference,
    })),
    suggestedReferences: input.response.suggestedReferences,
    disclaimer: input.response.disclaimer,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.aiAnalyses.put(analysis);
  return analysis;
}

export async function removeAnalysis(id: string): Promise<void> {
  await db.aiAnalyses.delete(id);
}

export async function listAnalyses(): Promise<AiAnalysis[]> {
  const rows = await db.aiAnalyses.where('userId').equals(LOCAL_USER).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function countAnalyses(): Promise<number> {
  return db.aiAnalyses.where('userId').equals(LOCAL_USER).count();
}
