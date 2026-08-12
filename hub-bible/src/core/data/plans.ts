import { db, now, uid } from '../db/db';
import { LOCAL_USER, type BookMeta, type ReadingPlan } from '../db/types';
import { buildCustomPlan, getTemplate, type PlanTemplate } from '../plans/templates';

/** Planos de leitura do usuário — criação, progresso e histórico. */

export async function listPlans(): Promise<ReadingPlan[]> {
  const rows = await db.plans.where('userId').equals(LOCAL_USER).toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPlan(id: string): Promise<ReadingPlan | undefined> {
  return db.plans.get(id);
}

export async function startPlan(
  template: PlanTemplate,
  meta: BookMeta[],
  options?: { days?: number; books?: string[]; name?: string },
): Promise<ReadingPlan> {
  const days =
    options?.books?.length && options.days
      ? buildCustomPlan(meta, options.books, options.days)
      : template.build(meta, options?.days ?? template.days);

  const timestamp = now();
  const plan: ReadingPlan = {
    id: uid('plan_'),
    userId: LOCAL_USER,
    templateId: template.id,
    name: options?.name || template.name,
    description: template.description,
    totalDays: days.length,
    days,
    completedDays: [],
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.plans.put(plan);
  return plan;
}

export async function toggleDay(planId: string, day: number): Promise<ReadingPlan | undefined> {
  const plan = await db.plans.get(planId);
  if (!plan) return undefined;
  const set = new Set(plan.completedDays);
  if (set.has(day)) set.delete(day);
  else set.add(day);
  const updated: ReadingPlan = {
    ...plan,
    completedDays: [...set].sort((a, b) => a - b),
    lastReadAt: now(),
    updatedAt: now(),
  };
  await db.plans.put(updated);
  return updated;
}

export async function removePlan(id: string): Promise<void> {
  await db.plans.delete(id);
}

export async function archivePlan(id: string, archived: boolean): Promise<void> {
  await db.plans.update(id, { archived, updatedAt: now() });
}

export const planProgress = (plan: ReadingPlan): number =>
  plan.totalDays ? Math.round((plan.completedDays.length / plan.totalDays) * 100) : 0;

/** Próximo dia não concluído (ou o último, se o plano terminou). */
export const nextPendingDay = (plan: ReadingPlan): number => {
  const done = new Set(plan.completedDays);
  for (let day = 1; day <= plan.totalDays; day++) if (!done.has(day)) return day;
  return plan.totalDays;
};

export const templateOf = (plan: ReadingPlan) => getTemplate(plan.templateId);
