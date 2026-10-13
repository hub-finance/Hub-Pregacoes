import { db, now, uid } from './db';
import { splitIntoSections } from './text';
import type { Material, MaterialKind, MaterialSource, Progress, Section } from './types';

/** Gravação e leitura dos materiais, do andamento e das exclusões em cascata. */

export const KIND_LABEL: Record<MaterialKind, string> = {
  livro: 'Livro',
  estudo: 'Estudo',
  resumo: 'Resumo',
};

/** Como cada tipo chama as suas partes. */
export const PART_LABEL: Record<MaterialKind, string> = {
  livro: 'Capítulo',
  estudo: 'Parte',
  resumo: 'Tópico',
};

export const newSection = (title = '', text = ''): Section => ({ id: uid('sec_'), title, text });

export interface NewMaterial {
  title: string;
  kind: MaterialKind;
  author?: string;
  /** Texto corrido: é dividido em seções pelos títulos que tiver. */
  text?: string;
  sections?: Array<{ title: string; text: string }>;
  source?: MaterialSource;
}

export async function createMaterial(input: NewMaterial): Promise<Material> {
  const parts = input.sections ?? (input.text?.trim() ? splitIntoSections(input.text, 'Introdução') : []);
  const t = now();
  const material: Material = {
    id: uid('mat_'),
    title: input.title.trim() || 'Sem título',
    kind: input.kind,
    author: input.author?.trim() ?? '',
    centralIdea: '',
    sections: parts.map((p) => newSection(p.title, p.text)),
    tags: [],
    concepts: [],
    source: input.source ?? { type: 'manual' },
    createdAt: t,
    updatedAt: t,
  };
  await db.materials.put(material);
  return material;
}

export async function saveMaterial(material: Material): Promise<Material> {
  const next = { ...material, updatedAt: now() };
  await db.materials.put(next);
  return next;
}

export async function touchMaterial(id: string): Promise<void> {
  await db.materials.update(id, { openedAt: now() });
}

export async function duplicateMaterial(id: string): Promise<Material> {
  const m = await db.materials.get(id);
  if (!m) throw new Error('Material não encontrado.');
  const t = now();
  const copy: Material = {
    ...m,
    id: uid('mat_'),
    title: `${m.title} (cópia)`,
    sections: m.sections.map((s) => newSection(s.title, s.text)),
    createdAt: t,
    updatedAt: t,
    openedAt: undefined,
  };
  await db.materials.put(copy);
  return copy;
}

/**
 * Junta as partes de volta num texto só (cada título na sua linha, como
 * estava no arquivo) e divide de novo pelo sumário/títulos. Serve para
 * materiais importados antes da leitura pelo sumário. O andamento por parte
 * recomeça, porque as partes mudam.
 */
export async function resplitMaterial(material: Material): Promise<Material> {
  const text = material.sections.map((s, i) => (i === 0 && /^introdu[cç][aã]o$/i.test(s.title) ? s.text : `${s.title}\n${s.text}`)).join('\n');
  const parts = splitIntoSections(text, 'Introdução');
  const next = { ...material, sections: parts.map((p) => newSection(p.title, p.text)), updatedAt: now() };
  await db.transaction('rw', [db.materials, db.progress], async () => {
    await db.materials.put(next);
    await db.progress.delete(material.id);
  });
  return next;
}

/** Exclui o material e tudo o que é dele: andamento, cartões e ações. */
export async function deleteMaterial(id: string): Promise<void> {
  await db.transaction('rw', [db.materials, db.progress, db.cards, db.actions], async () => {
    await db.cards.where('materialId').equals(id).delete();
    await db.actions.where('materialId').equals(id).delete();
    await db.progress.delete(id);
    await db.materials.delete(id);
  });
}

/* ------------------------------- andamento ------------------------------- */

export async function getProgress(id: string): Promise<Progress> {
  return (await db.progress.get(id)) ?? { id, done: [], notes: {}, updatedAt: 0 };
}

export async function setStepDone(id: string, sectionId: string, done: boolean): Promise<Progress> {
  const p = await getProgress(id);
  const set = new Set(p.done);
  if (done) set.add(sectionId);
  else set.delete(sectionId);
  const next = { ...p, done: [...set], current: sectionId, updatedAt: now() };
  await db.progress.put(next);
  return next;
}

export async function setStepNote(id: string, sectionId: string, note: string): Promise<Progress> {
  const p = await getProgress(id);
  const next = { ...p, notes: { ...p.notes, [sectionId]: note }, updatedAt: now() };
  await db.progress.put(next);
  return next;
}

export async function setCurrentStep(id: string, sectionId: string): Promise<void> {
  const p = await getProgress(id);
  await db.progress.put({ ...p, current: sectionId, updatedAt: now() });
}

/** Andamento contando só as seções que ainda existem. */
export function progressRatio(material: Material, progress: Progress | undefined): number {
  if (!material.sections.length) return 0;
  const ids = new Set(material.sections.map((s) => s.id));
  const done = (progress?.done ?? []).filter((d) => ids.has(d)).length;
  return done / material.sections.length;
}
