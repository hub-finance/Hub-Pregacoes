import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { useTranslationImport } from '../bible/useTranslationImport';
import {
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
 * qualquer outra tradução — só que gravada apenas neste aparelho.
 */
export function TranslationManager() {
  const { notify } = useToast();
  const catalog = useAsync(() => loadCatalog(true), []);
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, number>>({});

  const refreshInstalled = async (list: TranslationInfo[]) => {
    const entries = await Promise.all(
      list.map(async (t) => [t.id, await installedBookCount(t.id)] as const),
    );
    setInstalledMap(Object.fromEntries(entries));
  };

  if (catalog.data && !Object.keys(installedMap).length) void refreshInstalled(catalog.data);

  const { input, pick, busy } = useTranslationImport({
    catalog: catalog.data ?? [],
    onImported: () => {
      catalog.reload();
      setInstalledMap({});
    },
  });

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

  const available = (catalog.data ?? []).filter((t) => t.bundled || t.imported);
  const licensed = (catalog.data ?? []).filter((t) => !t.bundled && !t.imported);

  return (
    <div className="stack">
      {input}

      <div className="list">
        {available.map((t) => {
          const installed = installedMap[t.id] ?? 0;
          const busyDownload = progress?.id === t.id;
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

              {busyDownload && progress && (
                <ProgressBar value={(progress.done / progress.total) * 100} label="Baixando" />
              )}

              <div className="row row-wrap">
                {/* traduções importadas já chegam inteiras: não há de onde baixar */}
                {installed < 66 && !t.imported && (
                  <button className="btn btn-sm" disabled={busyDownload} onClick={() => download(t)}>
                    Baixar para uso offline
                  </button>
                )}
                {installed > 0 && !t.imported && (
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
                  <>
                    <button className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => pick(t)}>
                      Substituir arquivo
                    </button>
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="notice notice-accent">
        <Icon name="lock" size={20} style={{ flex: 'none' }} />
        <span>
          As traduções abaixo pertencem às suas editoras e <strong>não acompanham</strong> o
          aplicativo. Se você tem uma cópia que pode usar, importe o arquivo aqui: ele é gravado{' '}
          <strong>somente neste aparelho</strong> — não vai para a internet nem para quem instalar o
          app depois.
        </span>
      </div>

      <button className="btn btn-block" disabled={!!busy} onClick={() => pick(null)}>
        <Icon name="download" size={18} />
        {busy === '?' ? 'Importando…' : 'Importar um arquivo de tradução'}
      </button>
      <p className="small dim" style={{ marginTop: 'calc(var(--sp-2) * -1)' }}>
        Reconhece a tradução pelo nome do arquivo (ARA.json, NVI.json…). Se o nome não for
        conhecido, entra como uma tradução sua, com o nome do próprio arquivo.
      </p>

      {licensed.length > 0 && (
        <div className="list">
          {licensed.map((t) => (
            <div key={t.id} className="list-item">
              <span className="badge">{t.abbrev}</span>
              <span className="list-body">
                <span className="list-title">{t.name}</span>
                <span className="list-meta">
                  {t.publisher}
                  {t.year ? ` · ${t.year}` : ''}
                </span>
              </span>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => pick(t)}>
                {busy === t.id ? '…' : 'Importar'}
              </button>
            </div>
          ))}
        </div>
      )}

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
          <p>
            O formato 2 é o que sai das coletâneas abertas em JSON — é só escolher o arquivo, sem
            converter nada.
          </p>
        </div>
      </details>
    </div>
  );
}
