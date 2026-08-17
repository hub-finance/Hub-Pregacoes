import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../core/settings/SettingsContext';
import { readJsonFile, restoreBackup } from '../../core/backup';
import {
  deleteSnapshot,
  exportOverdue,
  formatSize,
  lastExportAt,
  listBackupTargets,
  listSnapshots,
  relativeDay,
  restoreSnapshot,
  saveSnapshot,
  sendBackupTo,
} from '../../core/backupStore';
import { installKind } from '../../core/platform';
import {
  formatBytes,
  requestPersistence,
  storageStatus,
  type StorageStatus,
} from '../../core/storage';
import type { BackupSnapshot } from '../../core/db/types';

type SnapshotMeta = Omit<BackupSnapshot, 'payload' | 'signature'>;

/**
 * Onde os dados desta instalação moram.
 *
 * O aplicativo e a versão do navegador podem ser usados lado a lado, mas cada
 * um guarda os próprios dados — um sermão escrito num não aparece no outro. Não
 * dizer isso deixaria o usuário achando que perdeu o que escreveu.
 */
const WHERE = {
  app: {
    title: 'Você está no aplicativo instalado (APK)',
    detail:
      'Os dados ficam na área do próprio aplicativo. Limpar o navegador não os afeta. A versão do navegador tem os dados dela, separados — para levar de uma para a outra, use a cópia.',
  },
  pwa: {
    title: 'Você está na versão instalada pelo navegador',
    detail:
      'Os dados ficam na área do navegador. Limpar os dados dele apaga tudo. Se você também usa o aplicativo (APK), ele tem os dados dele, separados.',
  },
  browser: {
    title: 'Você está usando pelo navegador, sem instalar',
    detail:
      'Instale pelo menu do navegador: além da tela cheia, os dados passam a ser tratados como de um aplicativo, e não como de um site qualquer.',
  },
} as const;

/**
 * Cópias de segurança.
 *
 * A tela é organizada pela pergunta que importa — *"se eu perder este tablet
 * agora, o que sobra?"* — e não pela lista de botões disponíveis. Por isso o
 * estado da cópia **fora** do aparelho vem primeiro e em destaque: as cópias
 * locais são conforto, a de fora é a que salva.
 */
export function BackupPanel() {
  const { notify } = useToast();
  const { settings } = useSettings();
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportedAt, setExportedAt] = useState<number | null>(lastExportAt());
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setSnapshots(await listSnapshots());
    setExportedAt(lastExportAt());
    setStorage(await storageStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const targets = listBackupTargets();
  const overdue = exportOverdue();

  const send = async (targetId: string) => {
    setBusy(targetId);
    try {
      const { result, records } = await sendBackupTo(targetId, settings);
      notify(
        result === 'sent'
          ? `Cópia enviada — ${records.toLocaleString('pt-BR')} registros.`
          : `Arquivo baixado — ${records.toLocaleString('pt-BR')} registros. Guarde-o fora do aparelho.`,
      );
      await refresh();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      {/* ---------------------- o estado, sem rodeios --------------------- */}
      <div className={`notice backup-status ${overdue ? '' : 'notice-accent'}`} style={overdue ? { borderColor: 'var(--danger)' } : undefined}>
        <Icon name={overdue ? 'lock' : 'check'} size={20} style={{ flex: 'none' }} />
        <span>
          {exportedAt ? (
            <>
              Última cópia guardada fora do aparelho: <strong>{relativeDay(exportedAt)}</strong>.
              {overdue && ' Já passou do tempo — vale fazer outra.'}
            </>
          ) : (
            <>
              <strong>Você ainda não guardou nenhuma cópia fora do aparelho.</strong> Se este tablet
              se perder ou os dados do navegador forem limpos, seus sermões e anotações vão junto.
            </>
          )}
        </span>
      </div>

      {/* --------------- em qual instalação estes dados moram -------------- */}
      <div className="card row" style={{ gap: 'var(--sp-3)' }}>
        <Icon name="info" size={20} style={{ flex: 'none', color: 'var(--text-3)' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="list-title">{WHERE[installKind()].title}</span>
          <span className="list-meta">{WHERE[installKind()].detail}</span>
        </span>
      </div>

      {/* ------------- o navegador pode apagar isto sozinho? ------------- */}
      {storage && (
        <div className="card row" style={{ gap: 'var(--sp-3)' }}>
          <Icon
            name={storage.persisted ? 'check' : 'lock'}
            size={20}
            style={{ flex: 'none', color: storage.persisted ? 'var(--accent-strong)' : 'var(--danger)' }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="list-title">
              {storage.persisted
                ? 'Armazenamento protegido neste aparelho'
                : 'O navegador pode apagar estes dados sozinho'}
            </span>
            <span className="list-meta">
              {storage.persisted
                ? 'O navegador não vai descartar seus dados para liberar espaço.'
                : 'Sem a marca de permanente, o Android pode limpar o app quando faltar espaço.'}
              {storage.usage !== undefined && ` · ${formatBytes(storage.usage)} em uso`}
            </span>
          </span>
          {!storage.persisted && storage.supported && (
            <button
              className="btn btn-sm"
              onClick={async () => {
                const ok = await requestPersistence();
                notify(
                  ok
                    ? 'Armazenamento protegido.'
                    : 'O navegador não concedeu. A cópia fora do aparelho continua sendo a garantia.',
                  ok ? undefined : 'error',
                );
                await refresh();
              }}
            >
              Proteger
            </button>
          )}
        </div>
      )}

      <div className="row row-wrap">
        {targets.map((target) => (
          <button
            key={target.id}
            className={`btn${target.id === 'share' ? ' btn-primary' : ''}`}
            disabled={!!busy}
            onClick={() => send(target.id)}
            title={target.hint}
          >
            {busy === target.id ? 'Preparando…' : target.label}
          </button>
        ))}
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => restoreInput.current?.click()}>
          Restaurar de um arquivo
        </button>
      </div>

      <div className="notice">
        <Icon name="info" size={20} style={{ flex: 'none' }} />
        <span>
          <strong>Nada protege de você limpar os dados do navegador</strong> — nem a marca de
          permanente, nem as cópias guardadas aqui. Se isso acontecer, o que traz tudo de volta é
          o arquivo que você guardou fora do aparelho. É por isso que ele é o botão em destaque.
        </span>
      </div>

      <p className="small muted">
        A cópia leva favoritos, marcações, anotações, sermões, Rhema, cursos, planos e histórico.
        Não leva os arquivos importados (PDF, Word, apresentações) nem as traduções que você
        importou — são grandes demais; guarde os originais e importe de novo quando precisar.
      </p>

      {/* -------------------- as cópias que ficam aqui -------------------- */}
      <div className="card stack" style={{ gap: 'var(--sp-3)' }}>
        <div className="row">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="list-title">Cópias neste aparelho</span>
            <span className="list-meta">
              O app guarda as últimas sozinho. Servem para desfazer um engano — não substituem a
              cópia de fora.
            </span>
          </span>
          <button
            className="btn btn-sm"
            disabled={!!busy}
            onClick={async () => {
              setBusy('local');
              try {
                const snap = await saveSnapshot('manual', settings);
                notify(snap ? 'Cópia feita neste aparelho.' : 'Nada mudou desde a última cópia.');
                await refresh();
              } finally {
                setBusy(null);
              }
            }}
          >
            Fazer agora
          </button>
        </div>

        {!snapshots.length && <p className="small dim">Nenhuma cópia ainda.</p>}

        {snapshots.map((snap) => (
          <div key={snap.id} className="list-item">
            <span className="list-body">
              <span className="list-title">
                {new Date(snap.at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="list-meta">
                {snap.records.toLocaleString('pt-BR')} registros · {formatSize(snap.size)}
                {snap.reason === 'auto' ? ' · automática' : ''}
              </span>
            </span>
            <button
              className="btn btn-sm btn-ghost"
              disabled={!!busy}
              onClick={async () => {
                setBusy(snap.id);
                try {
                  const result = await restoreSnapshot(snap.id, 'merge');
                  const total = Object.values(result.restored).reduce((a, b) => a + b, 0);
                  notify(`Restaurado: ${total.toLocaleString('pt-BR')} registros.`);
                  await refresh();
                } catch (err) {
                  notify((err as Error).message, 'error');
                } finally {
                  setBusy(null);
                }
              }}
            >
              Restaurar
            </button>
            <button
              className="icon-btn"
              aria-label="Excluir esta cópia"
              disabled={!!busy}
              onClick={async () => {
                await deleteSnapshot(snap.id);
                await refresh();
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>

      <input
        ref={restoreInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            /* rede de segurança: restaurar por cima do que existe é destrutivo
               por natureza, então o estado atual vira cópia antes */
            await saveSnapshot('auto', settings);
            const data = await readJsonFile(file);
            const result = await restoreBackup(data, 'merge');
            const total = Object.values(result.restored).reduce((a, b) => a + b, 0);
            notify(`Backup restaurado: ${total.toLocaleString('pt-BR')} registros.`);
            await refresh();
          } catch (err) {
            notify((err as Error).message, 'error');
          } finally {
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
