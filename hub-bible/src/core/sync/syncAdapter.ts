/**
 * Sincronização entre dispositivos (seção 32 da especificação).
 *
 * Ainda não há backend: este módulo define o contrato e o mecanismo de
 * resolução de conflitos, de modo que ligar um servidor no futuro (ou o
 * armazenamento nativo do Android) não exija mexer nas telas.
 *
 * Todo registro sincronizável já carrega `id`, `userId` e `updatedAt` — o
 * suficiente para "last write wins" com detecção de divergência.
 */

import { db } from '../db/db';

export const SYNCABLE_TABLES = [
  'favorites',
  'highlights',
  'notes',
  'sermons',
  'studies',
  'devotionals',
  'libraryDocs',
  'plans',
] as const;

export type SyncTable = (typeof SYNCABLE_TABLES)[number];

export interface SyncRecord {
  id: string;
  updatedAt: number;
  [key: string]: unknown;
}

export interface SyncChanges {
  since: number;
  tables: Partial<Record<SyncTable, SyncRecord[]>>;
}

export interface SyncAdapter {
  id: string;
  label: string;
  isConnected(): boolean;
  /** Envia alterações locais e devolve as alterações remotas. */
  push(changes: SyncChanges): Promise<SyncChanges>;
}

let adapter: SyncAdapter | null = null;

export function registerSyncAdapter(next: SyncAdapter | null): void {
  adapter = next;
}

export const getSyncAdapter = (): SyncAdapter | null => adapter;
export const isSyncEnabled = (): boolean => !!adapter?.isConnected();

/** Coleta tudo que mudou localmente desde o último carimbo. */
export async function collectLocalChanges(since = 0): Promise<SyncChanges> {
  const tables: SyncChanges['tables'] = {};
  for (const name of SYNCABLE_TABLES) {
    const rows = (await db.table(name).where('updatedAt').above(since).toArray()) as SyncRecord[];
    if (rows.length) tables[name] = rows;
  }
  return { since, tables };
}

/** Aplica alterações remotas mantendo a versão mais recente de cada registro. */
export async function applyRemoteChanges(changes: SyncChanges): Promise<number> {
  let applied = 0;
  for (const [name, rows] of Object.entries(changes.tables)) {
    if (!rows?.length) continue;
    const table = db.table(name);
    await db.transaction('rw', table, async () => {
      for (const row of rows) {
        const local = (await table.get(row.id)) as SyncRecord | undefined;
        if (!local || (local.updatedAt ?? 0) < row.updatedAt) {
          await table.put(row);
          applied += 1;
        }
      }
    });
  }
  return applied;
}

export async function runSync(): Promise<{ pushed: number; applied: number } | null> {
  if (!adapter?.isConnected()) return null;
  const since = Number(localStorage.getItem('hub-bible:sync:since') ?? 0);
  const local = await collectLocalChanges(since);
  const pushed = Object.values(local.tables).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
  const remote = await adapter.push(local);
  const applied = await applyRemoteChanges(remote);
  localStorage.setItem('hub-bible:sync:since', String(Date.now()));
  return { pushed, applied };
}
