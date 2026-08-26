import { db, now, uid } from './db/db';
import {
  createBackup,
  restoreBackup,
  type BackupFile,
  type BackupOptions,
  type RestoreResult,
} from './backup';
import type { BackupSnapshot } from './db/types';
import { isNativeApp } from './platform';
import { saveFileNatively, shareFileNatively } from './nativeFiles';

/**
 * Cópias de segurança: as automáticas no aparelho e o envio para fora dele.
 *
 * A defesa é em duas camadas, porque os dois acidentes são diferentes:
 *
 *  1. **Cópia no aparelho** — protege do erro do dia a dia: apagar um sermão
 *     sem querer, uma restauração malfeita, um teste que deu errado. Não custa
 *     nada, não precisa de internet nem de decisão do usuário, e é a única que
 *     acontece sozinha. Não salva de perder o aparelho.
 *  2. **Cópia fora do aparelho** — é a que salva de verdade, e por isso o app
 *     insiste nela. Sai pelo `BackupTarget`.
 *
 * `BackupTarget` existe para que as telas não conheçam o destino. Hoje há dois
 * (a folha de compartilhamento do Android, por onde se salva no Google Drive, e
 * o arquivo baixado). Amanhã um servidor entra registrando outro destino, sem
 * mexer em tela nenhuma — do mesmo jeito que `core/sync/syncAdapter.ts` espera
 * pela sincronização.
 */

/** Quantas cópias automáticas guardar. Além disso, a mais antiga sai. */
export const KEEP_SNAPSHOTS = 6;

/** De quanto em quanto tempo o app faz a cópia sozinho. */
export const AUTO_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

/** Depois de quanto tempo sem cópia **fora** do aparelho o app avisa. */
export const NAG_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const LAST_EXPORT_KEY = 'hub-bible:backup:lastExport';

/* ------------------------------ no aparelho ------------------------------ */

export async function listSnapshots(): Promise<Array<Omit<BackupSnapshot, 'payload' | 'signature'>>> {
  const rows = await db.backups.orderBy('at').reverse().toArray();
  // o conteúdo não sobe para a tela: a lista mostra data, tamanho e contagem
  return rows.map(({ payload: _payload, signature: _signature, ...meta }) => meta);
}

export async function lastSnapshotAt(): Promise<number | undefined> {
  const row = await db.backups.orderBy('at').last();
  return row?.at;
}

/**
 * Grava uma cópia. Devolve `null` quando nada mudou desde a última — repetir a
 * mesma cópia só gastaria espaço e empurraria para fora uma cópia mais antiga,
 * que é justamente a que ainda teria valor.
 */
export async function saveSnapshot(
  reason: BackupSnapshot['reason'],
  settings?: unknown,
): Promise<BackupSnapshot | null> {
  const backup = await createBackup(settings);
  const payload = JSON.stringify(backup);
  const signature = JSON.stringify({ data: backup.data, settings: backup.settings });

  const newest = await db.backups.orderBy('at').last();
  if (newest && newest.signature === signature) return null;

  const snapshot: BackupSnapshot = {
    id: uid('bk_'),
    at: now(),
    reason,
    counts: backup.counts,
    records: Object.values(backup.counts).reduce((a, b) => a + b, 0),
    size: payload.length,
    payload,
    signature,
  };

  await db.backups.put(snapshot);
  await prune();
  return snapshot;
}

async function prune(): Promise<void> {
  const ids = await db.backups.orderBy('at').reverse().primaryKeys();
  const excess = ids.slice(KEEP_SNAPSHOTS);
  if (excess.length) await db.backups.bulkDelete(excess as string[]);
}

export async function restoreSnapshot(
  id: string,
  mode: 'merge' | 'replace' = 'merge',
): Promise<RestoreResult> {
  const snapshot = await db.backups.get(id);
  if (!snapshot) throw new Error('Esta cópia não existe mais.');
  /* Antes de sobrescrever, uma cópia do estado atual: quem restaurou a cópia
     errada precisa de um caminho de volta. */
  await saveSnapshot('auto');
  return restoreBackup(JSON.parse(snapshot.payload) as BackupFile, mode);
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.backups.delete(id);
}

/** Faz a cópia automática se já passou o intervalo. Silenciosa por natureza. */
export async function autoBackupIfDue(settings?: unknown): Promise<BackupSnapshot | null> {
  const last = await lastSnapshotAt();
  if (last && now() - last < AUTO_INTERVAL_MS) return null;
  return saveSnapshot('auto', settings);
}

/* --------------------------- fora do aparelho ---------------------------- */

export interface BackupTarget {
  id: string;
  label: string;
  /** Descrição curta para a tela — o que acontece ao tocar. */
  hint: string;
  /** O destino funciona neste aparelho/navegador? */
  available(): boolean;
  /** `path` aparece quando o arquivo ficou numa pasta que o usuário pode abrir. */
  send(blob: Blob, filename: string): Promise<{ result: 'sent' | 'downloaded'; path?: string }>;
}

const targets = new Map<string, BackupTarget>();

export function registerBackupTarget(target: BackupTarget): void {
  targets.set(target.id, target);
}

export function listBackupTargets(): BackupTarget[] {
  return [...targets.values()].filter((t) => t.available());
}

export const getBackupTarget = (id: string): BackupTarget | undefined => targets.get(id);

/**
 * Folha de compartilhamento do aparelho — é por ela que se salva no Google
 * Drive, no e-mail ou no WhatsApp, com um toque e sem conta nenhuma.
 *
 * O caminho totalmente automático (subir para o Drive sem tocar em nada) exige
 * um cadastro OAuth no Google Cloud feito pelo próprio dono do aplicativo; se
 * um dia valer a pena, entra aqui como mais um destino.
 */
const shareTarget: BackupTarget = {
  id: 'share',
  label: 'Salvar no Google Drive',
  hint: 'Abre a folha de compartilhamento: escolha Drive, e-mail ou o que preferir.',
  /* No aplicativo empacotado a folha vem do lado nativo — a WebView do Android
     não traz `navigator.share`, e testar só por ele escondia o botão justamente
     onde ele é mais necessário. */
  available: () =>
    isNativeApp() || (typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare),
  async send(blob, filename) {
    if (await shareFileNatively(blob, filename)) return { result: 'sent' };

    const file = new File([blob], filename, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return { result: 'sent' };
      } catch (err) {
        // desistir da folha não é erro: o usuário fechou
        if ((err as Error)?.name === 'AbortError') return { result: 'sent' };
      }
    }
    downloadFile(blob, filename);
    return { result: 'downloaded' };
  },
};

const fileTarget: BackupTarget = {
  id: 'file',
  label: 'Baixar o arquivo',
  hint: 'Guarda na pasta Download, para você mover para onde quiser.',
  available: () => true,
  async send(blob, filename) {
    /* Um download `blob:` some sem erro nenhum dentro da WebView. Gravar pelo
       lado nativo é a diferença entre a cópia existir e só parecer que existe. */
    const path = await saveFileNatively(blob, filename);
    if (path) return { result: 'downloaded', path };
    downloadFile(blob, filename);
    return { result: 'downloaded' };
  },
};

registerBackupTarget(shareTarget);
registerBackupTarget(fileTarget);

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function backupFileName(at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `hub-bible-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}.json`;
}

/**
 * Manda a cópia para fora do aparelho e anota a data. É essa data — e não a das
 * cópias locais — que diz se o usuário está protegido de verdade.
 */
export async function sendBackupTo(
  targetId: string,
  settings?: unknown,
  options?: BackupOptions,
): Promise<{ result: 'sent' | 'downloaded'; path?: string; records: number; bytes: number }> {
  const target = targets.get(targetId);
  if (!target) throw new Error('Destino desconhecido.');

  const backup = await createBackup(settings, options);
  /* Sem indentação quando o texto bíblico vai junto: a formatação bonita custa
     dezenas de MB num arquivo que ninguém vai ler à mão. Sem as Bíblias o
     arquivo é pequeno, e aí vale deixá-lo legível. */
  const payload = backup.translations
    ? JSON.stringify(backup)
    : JSON.stringify(backup, null, 2);
  const { result, path } = await target.send(
    new Blob([payload], { type: 'application/json' }),
    backupFileName(),
  );

  // guarda também uma cópia local: o esforço já foi feito
  await saveSnapshot('manual', settings);
  localStorage.setItem(LAST_EXPORT_KEY, String(now()));

  return {
    result,
    path,
    records: Object.values(backup.counts).reduce((a, b) => a + b, 0),
    bytes: payload.length,
  };
}

export function lastExportAt(): number | null {
  const raw = Number(localStorage.getItem(LAST_EXPORT_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Está na hora de insistir na cópia fora do aparelho? */
export function exportOverdue(): boolean {
  const last = lastExportAt();
  return !last || now() - last > NAG_AFTER_MS;
}

/** "há 3 dias", "hoje" — a forma como se fala de uma cópia. */
export function relativeDay(at: number): string {
  const days = Math.floor((now() - at) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
