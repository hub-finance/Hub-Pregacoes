import { db, now, uid } from './db';
import { readSection } from './text';
import type { ActionItem, ActionStatus, Material } from './types';

/**
 * Plano de ação: o que fazer com o que foi estudado.
 *
 * As sugestões vêm das seções de aplicação do próprio material (títulos como
 * "Aplicação", "Para praticar", "Desafio", "Ação") e de linhas marcadas como
 * tarefa (`- [ ] …`). O usuário escolhe, ajusta e define responsável e prazo.
 */

export const STATUS_LABEL: Record<ActionStatus, string> = {
  'a-fazer': 'A fazer',
  fazendo: 'Fazendo',
  feito: 'Feito',
};

const APPLICATION_TITLE = /aplica|pr[aá]tic|desafio|a[cç][aã]o|a[cç][oõ]es|tarefa|compromisso|exerc[ií]cio|passos/i;
const TASK_LINE = /^\s*[-*]\s*\[\s?\]\s*(.+)$/;

export interface ActionDraft {
  sectionId: string;
  text: string;
}

export function suggestActions(material: Material): ActionDraft[] {
  const out: ActionDraft[] = [];
  for (const section of material.sections) {
    for (const line of section.text.split('\n')) {
      const task = TASK_LINE.exec(line);
      if (task) out.push({ sectionId: section.id, text: task[1].trim() });
    }
    if (!APPLICATION_TITLE.test(section.title)) continue;
    const reading = readSection(section);
    const items = reading.listItems.length ? reading.listItems : reading.paragraphs;
    for (const item of items) {
      const text = item.replace(/^\[\s?\]\s*/, '').trim();
      if (text.length >= 6 && text.length <= 280) out.push({ sectionId: section.id, text });
    }
  }
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.text) ? false : (seen.add(a.text), true)));
}

export async function addActions(materialId: string, drafts: ActionDraft[]): Promise<void> {
  const t = now();
  const existing = new Set((await db.actions.where('materialId').equals(materialId).toArray()).map((a) => a.text));
  await db.actions.bulkPut(
    drafts
      .filter((d) => d.text.trim() && !existing.has(d.text.trim()))
      .map(
        (d): ActionItem => ({
          id: uid('act_'),
          materialId,
          sectionId: d.sectionId || undefined,
          text: d.text.trim(),
          owner: '',
          due: '',
          status: 'a-fazer',
          createdAt: t,
          updatedAt: t,
        }),
      ),
  );
}

export async function updateAction(item: ActionItem, patch: Partial<ActionItem>): Promise<void> {
  await db.actions.put({ ...item, ...patch, updatedAt: now() });
}

export const listActions = (materialId: string) => db.actions.where('materialId').equals(materialId).toArray();
