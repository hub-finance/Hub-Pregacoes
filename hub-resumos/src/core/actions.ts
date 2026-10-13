import { db, now, uid } from './db';
import { readSection, sentences } from './text';
import type { ActionItem, ActionStatus, Material } from './types';

/**
 * Plano de ação: o que fazer com o que foi estudado.
 *
 * As sugestões vêm do próprio material: linhas marcadas como tarefa
 * (`- [ ] …`), as seções de aplicação (títulos como "Aplicação", "Para
 * praticar", "Desafio", "Ação") e, em qualquer parte, as frases que pedem uma
 * ação ("Faça…", "Pratique…", "Devemos…", "O líder precisa…"). A frase vem
 * inteira, como está no texto. O usuário escolhe, ajusta e define
 * responsável e prazo.
 */

export const STATUS_LABEL: Record<ActionStatus, string> = {
  'a-fazer': 'A fazer',
  fazendo: 'Fazendo',
  feito: 'Feito',
};

const APPLICATION_TITLE = /aplica|pr[aá]tic|desafio|a[cç][aã]o|a[cç][oõ]es|tarefa|compromisso|exerc[ií]cio|passos/i;
/** Frase que começa mandando fazer algo (imperativo). */
const IMPERATIVE =
  /^(seja|sejam|fa[cç]a|fa[cç]am|comece|comecem|pratique|pratiquem|lembre-se|procure|busque|escreva|separe|reserve|dedique|evite|ore|orem|leia|leiam|aplique|pergunte-se|tome|defina|estabele[cç]a|crie|invista|desenvolva|cultive|ou[cç]a|aprenda|ensine|sirva|perdoe|ame|honre|confie|decida|assuma|mantenha|use|identifique|anote|compartilhe|avalie|planeje|treine|delegue|valorize|reconhe[cç]a|escolha|pare|volte|aproxime-se|esteja|tenha|d[eê])\b/i;
/** Frase de dever: "devemos…", "você precisa…", "o líder deve…". */
const DUTY = /\b(devemos|precisamos|temos que|voc[eê] (deve|precisa|tem que)|(o|a|todo|cada) [\p{L}]+ (deve|precisa|tem que))\b/iu;
/** Quantas frases do texto, no máximo, viram sugestão (para não afogar o plano). */
const MAX_FROM_SENTENCES = 15;

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
  // frases do texto que pedem uma ação, em todo o material
  let fromSentences = 0;
  for (const section of material.sections) {
    if (fromSentences >= MAX_FROM_SENTENCES) break;
    const reading = readSection(section);
    for (const sentence of [...reading.listItems, ...reading.highlights, ...reading.paragraphs.flatMap(sentences)]) {
      const text = sentence.replace(/^\[\s?\]\s*/, '').trim();
      if (text.length < 20 || text.length > 220 || /\?$/.test(text)) continue;
      if (!IMPERATIVE.test(text) && !DUTY.test(text)) continue;
      out.push({ sectionId: section.id, text });
      if (++fromSentences >= MAX_FROM_SENTENCES) break;
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
