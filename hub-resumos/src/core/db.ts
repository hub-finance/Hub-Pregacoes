import Dexie, { type Table } from 'dexie';
import type { ActionItem, Card, KeyValue, Material, Progress } from './types';

/**
 * O banco do Hub Resumos — IndexedDB, no próprio aparelho.
 *
 * É separado do banco do Hub Bible de propósito: os dois programas vivem e
 * são atualizados cada um por si. Mudou o schema? Nova `version()` aqui, sem
 * mexer nas anteriores.
 */
export class ResumosDB extends Dexie {
  materials!: Table<Material, string>;
  progress!: Table<Progress, string>;
  cards!: Table<Card, string>;
  actions!: Table<ActionItem, string>;
  settings!: Table<KeyValue, string>;

  constructor() {
    super('hub-resumos');
    this.version(1).stores({
      materials: 'id, kind, updatedAt, createdAt, title, openedAt',
      progress: 'id, updatedAt',
      cards: 'id, materialId, due, box, updatedAt',
      actions: 'id, materialId, status, due, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new ResumosDB();

export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}

export const now = () => Date.now();

/**
 * Pede ao navegador que não apague os dados sozinho quando faltar espaço.
 * Silencioso: se o navegador recusar, o app segue igual.
 */
export async function askPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T | undefined) ?? fallback;
}

export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value });
