import { db, now, uid } from './db';
import { readSection } from './text';
import type { Material } from './types';

/**
 * Cópia de segurança do Hub Resumos e o envio para o Hub Bible.
 *
 * Os dados vivem só no aparelho. A cópia em arquivo é o que protege contra
 * perder tudo numa limpeza do navegador ou na troca de celular.
 */

export const BACKUP_APP = 'hub-resumos';
const TABLES = ['materials', 'progress', 'cards', 'actions'] as const;

export interface ResumosBackup {
  app: typeof BACKUP_APP;
  version: 1;
  exportedAt: string;
  counts: Record<string, number>;
  data: Record<(typeof TABLES)[number], unknown[]>;
}

export async function createBackup(): Promise<ResumosBackup> {
  const data = {} as ResumosBackup['data'];
  const counts: Record<string, number> = {};
  for (const name of TABLES) {
    data[name] = await db.table(name).toArray();
    counts[name] = data[name].length;
  }
  return { app: BACKUP_APP, version: 1, exportedAt: new Date().toISOString(), counts, data };
}

/** Restaura juntando ao que já existe (mesmo id é substituído pela cópia). */
export async function restoreBackup(json: unknown): Promise<Record<string, number>> {
  const backup = json as Partial<ResumosBackup>;
  if (backup?.app !== BACKUP_APP || !backup.data) throw new Error('Este arquivo não é uma cópia do Hub Resumos.');
  const restored: Record<string, number> = {};
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      const rows = backup.data?.[name];
      if (!Array.isArray(rows)) continue;
      await db.table(name).bulkPut(rows);
      restored[name] = rows.length;
    }
  });
  await db.settings.put({ key: 'lastRestoreAt', value: now() });
  return restored;
}

export async function markBackupDone(): Promise<void> {
  await db.settings.put({ key: 'lastBackupAt', value: now() });
}

/**
 * O material como estudo do Rhema, num arquivo que o Hub Bible restaura em
 * Configurações › Restaurar (ele junta ao que já existe, sem apagar nada).
 *
 * Cada seção vira uma "seção livre" do Rhema com o mesmo título e texto; a
 * primeira referência bíblica achada vira o texto principal.
 */
export function hubStudyBackup(material: Material) {
  const t = now();
  const firstRef = material.sections.flatMap((s) => readSection(s).references)[0];
  const sections = [
    ...(firstRef ? [{ id: uid('sec_'), kind: 'texto', text: firstRef.label }] : []),
    ...(material.centralIdea.trim()
      ? [{ id: uid('sec_'), kind: 'livre', title: 'Ideia central', text: material.centralIdea.trim() }]
      : []),
    ...material.sections.map((s) => ({ id: uid('sec_'), kind: 'livre', title: s.title || 'Seção', text: s.text })),
  ];
  const study = {
    id: `std_resumos_${material.id}`,
    userId: 'local',
    title: material.title,
    theme: material.centralIdea.trim().slice(0, 140),
    mainText: firstRef?.label ?? '',
    category: 'Discipulado',
    introduction: '',
    development: '',
    relatedVerses: [],
    comments: '',
    application: '',
    conclusion: '',
    notes: material.author ? `Autor: ${material.author}` : '',
    tags: [...material.tags, 'Hub Resumos'],
    createdAt: t,
    updatedAt: t,
    sections,
  };
  return {
    app: 'hub-bible',
    version: 2,
    exportedAt: new Date().toISOString(),
    counts: { studies: 1 },
    data: { studies: [study] },
  };
}

export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function readJsonFile(file: File): Promise<unknown> {
  return file.text().then((text) => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('O arquivo não é um JSON válido.');
    }
  });
}

/** Nome de arquivo seguro, mantendo acentos. */
export const safeName = (title: string) =>
  // eslint-disable-next-line no-control-regex
  title.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'material';
