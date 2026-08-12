import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { readJsonFile } from '../../core/backup';
import {
  importTranslation,
  installTranslation,
  installedBookCount,
  loadCatalog,
  removeImportedTranslation,
} from '../../core/bible/repository';
import { clearScriptureCache } from '../../core/db/db';
import type { TranslationInfo } from '../../core/db/types';

/**
 * Gerenciamento de traduções.
 *
 * Traduções em domínio público acompanham o aplicativo. As protegidas por
 * direitos autorais aparecem como "espaço reservado": o usuário instala uma
 * cópia que já possua licença para usar, e o app passa a tratá-la como
 * qualquer outra tradução.
 */
export function TranslationManager() {
  const { notify } = useToast();
  const catalog = useAsync(() => loadCatalog(true), []);
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, number>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<TranslationInfo | null>(null);

  const refreshInstalled = async (list: TranslationInfo[]) => {
    const entries = await Promise.all(
      list.map(async (t) => [t.id, await installedBookCount(t.id)] as const),
    );
    setInstalledMap(Object.fromEntries(entries));
  };

  if (catalog.data && !Object.keys(installedMap).length) void refreshInstalled(catalog.data);

  const download = async (info: TranslationInfo) => {
    setProgress({ id: info.id, done: 0, total: 66 });
    try {
      await installTranslation(info.id, (p) => setProgress({ id: info.id, done: p.done, total: p.total }));
      notify(`${info.shortName} disponível offline.`);
      if (catalog.data) await refreshInstalled(catalog.data);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setProgress(null);
    }
  };

  const pickFile = (info: TranslationInfo) => {
    pendingSlot.current = info;
    fileInput.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const slot = pendingSlot.current;
    if (!file || !slot) return;
    try {
      const data = await readJsonFile(file);
      const result = await importTranslation(slot, data);
      notify(`${slot.shortName}: ${result.books} livros e ${result.verses} versículos importados.`);
      catalog.reload();
      setInstalledMap({});
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      pendingSlot.current = null;
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const available = (catalog.data ?? []).filter((t) => t.bundled || t.imported);
  const licensed = (catalog.data ?? []).filter((t) => !t.bundled && !t.imported);

  return (
    <div className="stack">
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="list">
        {available.map((t) => {
          const installed = installedMap[t.id] ?? 0;
          const busy = progress?.id === t.id;
          return (
            <div key={t.id} className="card stack" style={{ gap: 'var(--sp-2)' }}>
              <div className="row">
                <span className="badge">{t.abbrev}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="list-title truncate">{t.name}</span>
                  <span className="list-meta">
                    {t.languageLabel} · {t.license}
                    {t.imported ? ' · importada por você' : ''}
                  </span>
                </span>
                <span className="small dim mono-num">{installed}/66</span>
              </div>

              {busy && progress && (
                <ProgressBar value={(progress.done / progress.total) * 100} label="Baixando" />
              )}

              <div className="row row-wrap">
                {installed < 66 && (
                  <button className="btn btn-sm" disabled={busy} onClick={() => download(t)}>
                    Baixar para uso offline
                  </button>
                )}
                {installed > 0 && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={async () => {
                      await clearScriptureCache(t.id);
                      notify('Texto local removido.');
                      if (catalog.data) await refreshInstalled(catalog.data);
                    }}
                  >
                    Limpar do dispositivo
                  </button>
                )}
                {t.imported && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={async () => {
                      await removeImportedTranslation(t.id);
                      notify('Tradução removida.');
                      catalog.reload();
                      setInstalledMap({});
                    }}
                  >
                    Remover tradução
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {licensed.length > 0 && (
        <>
          <div className="notice notice-accent">
            <Icon name="lock" size={20} style={{ flex: "none" }} />
            <span>
              As traduções abaixo são protegidas por direitos autorais e <strong>não acompanham</strong> o
              aplicativo. Se você tem autorização do detentor dos direitos (ou um arquivo licenciado),
              importe-o aqui — ele fica somente no seu dispositivo.
            </span>
          </div>

          <div className="list">
            {licensed.map((t) => (
              <div key={t.id} className="list-item">
                <span className="badge">{t.abbrev}</span>
                <span className="list-body">
                  <span className="list-title">{t.name}</span>
                  <span className="list-meta">{t.publisher}</span>
                </span>
                <button className="btn btn-sm" onClick={() => pickFile(t)}>
                  Importar
                </button>
              </div>
            ))}
          </div>

          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Formatos aceitos na importação</summary>
            <div className="stack small muted" style={{ marginTop: 'var(--sp-3)' }}>
              <p>O arquivo precisa ser JSON em um destes formatos:</p>
              <pre
                style={{
                  overflowX: 'auto',
                  background: 'var(--surface-2)',
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '0.78rem',
                }}
              >{`// 1) Hub Bible
{ "books": { "GEN": [["No princípio…", "…"]], "JHN": [[…]] } }

// 2) Lista na ordem canônica (66 livros)
[ { "abbrev": "gn", "chapters": [["No princípio…"]] }, … ]

// 3) Tabela de versículos
{ "resultset": { "row": [ { "field": [1001001, 1, 1, 1, "texto"] } ] } }`}</pre>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
