import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isNativeApp } from '../core/platform';
import { checkApkUpdate, dismissApkUpdate, wasDismissed, type ApkUpdate } from '../core/apkUpdate';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { lastExportAt, relativeDay } from '../core/backupStore';
import { HAS_RHEMA } from '../core/edition';

/**
 * Atualização do PWA: o service worker novo só assume quando o usuário aceita,
 * evitando recarregar a tela no meio de uma leitura ou de um sermão em edição.
 *
 * Dentro do APK isto não existe. O conteúdo web já vem embutido no aplicativo,
 * não há servidor de onde buscar versão nova, e um service worker cacheando por
 * cima dos arquivos do próprio pacote só criaria chance de servir tela velha
 * depois de uma atualização. Lá a atualização é instalar o APK novo — e o
 * aviso vem de `ApkUpdatePrompt`, que confere a versão no GitHub.
 */
export function UpdatePrompt() {
  if (isNativeApp()) return <ApkUpdatePrompt />;
  return <ServiceWorkerPrompt />;
}

/**
 * No APK: ao abrir com internet, confere se há versão mais nova **desta
 * edição** e oferece o arquivo certo. O botão abre o navegador do aparelho no
 * arquivo; o Android instala por cima, mantendo os dados.
 */
function ApkUpdatePrompt() {
  const [update, setUpdate] = useState<ApkUpdate | null>(null);
  // "Atenção" antes de baixar (pedido do usuário): backup e instalar por cima
  const [attention, setAttention] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let alive = true;
    // espera a tela abrir: a consulta não pode atrasar a primeira leitura
    const timer = setTimeout(() => {
      checkApkUpdate().then((u) => { if (alive && u && !wasDismissed(u.build)) setUpdate(u); });
    }, 4000);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  if (!update) return null;
  return (
    <div className="toast-wrap top">
      <div className="toast">
        <Icon name="download" size={18} />
        <span style={{ flex: 1 }}>Nova versão disponível ({update.build}).</span>
        <button className="btn btn-sm btn-primary" onClick={() => setAttention(true)}>
          Atualizar
        </button>
        <button
          className="icon-btn"
          style={{ width: 32, height: 32 }}
          aria-label="Depois"
          onClick={() => { dismissApkUpdate(update.build); setUpdate(null); }}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <UpdateAttention
        open={attention}
        update={update}
        onClose={() => setAttention(false)}
        onBackup={() => { setAttention(false); navigate('/config'); }}
      />
    </div>
  );
}

/**
 * Atenção antes de atualizar: o que protege os dados de quem instala.
 * Desinstalar o app antigo apaga tudo — por isso o aviso insiste em
 * "instalar por cima" e no backup antes, mostrando quando foi o último.
 */
function UpdateAttention({ open, update, onClose, onBackup }: {
  open: boolean;
  update: ApkUpdate;
  onClose: () => void;
  onBackup: () => void;
}) {
  const last = lastExportAt();
  const edition = HAS_RHEMA ? 'completa (1.0)' : '2.0';
  const version = `${HAS_RHEMA ? '1.0' : '2.0'}.${update.build}`;
  return (
    <Sheet
      open={open}
      title="Atenção antes de atualizar"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onBackup} style={{ flex: 1 }}>
            Fazer o backup antes
          </button>
          {/* link comum, sem nova janela: no APK o Android abre o navegador */}
          <a className="btn btn-primary" href={update.url} onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            Baixar a versão {update.build}
          </a>
        </>
      }
    >
      <div className="update-attention">
        <div className="notice update-attention-head" role="alert">
          <Icon name="warning" size={20} style={{ flex: 'none' }} />
          <strong>Para não perder nada do que você fez, siga estes passos.</strong>
        </div>
        <ol className="update-attention-steps">
          <li>
            <strong>Faça o backup antes.</strong> Configurações › Backup e privacidade › “Salvar no Google Drive”.{' '}
            <span className={last ? 'dim' : 'update-attention-warn'}>
              {last ? `Seu último backup fora do aparelho: ${relativeDay(last)}.` : 'Você ainda não fez nenhum backup fora do aparelho.'}
            </span>
          </li>
          <li>
            <strong>Instale por cima. Não desinstale o aplicativo antigo:</strong> desinstalar apaga os seus sermões,
            anotações, apostilas e Bíblias importadas.
          </li>
          <li>
            Ao abrir o arquivo baixado, se o Android perguntar, permita instalar desta fonte e toque em <strong>Atualizar</strong>.
          </li>
          <li>
            Depois, abra o app e confira em Configurações › Sobre: deve aparecer <strong>v{version}</strong>.
          </li>
          <li>
            Esta é a edição <strong>{edition}</strong>, e o arquivo baixado é o da mesma edição: uma não substitui a outra.
          </li>
        </ol>
      </div>
    </Sheet>
  );
}

function ServiceWorkerPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  // o aviso "pronto para offline" é informativo: some sozinho
  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="toast-wrap top">
      <div className="toast">
        <Icon name={needRefresh ? 'download' : 'offline'} size={18} />
        <span style={{ flex: 1 }}>
          {needRefresh
            ? 'Nova versão disponível.'
            : 'Aplicativo pronto para funcionar offline.'}
        </span>
        {needRefresh ? (
          <button className="btn btn-sm btn-primary" onClick={() => updateServiceWorker(true)}>
            Atualizar
          </button>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setOfflineReady(false)}>
            Ok
          </button>
        )}
        {needRefresh && (
          <button
            className="icon-btn"
            style={{ width: 32, height: 32 }}
            aria-label="Depois"
            onClick={() => setNeedRefresh(false)}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
