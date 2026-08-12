import { useEffect } from 'react';
import { Icon } from '../components/Icon';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Atualização do PWA: o service worker novo só assume quando o usuário aceita,
 * evitando recarregar a tela no meio de uma leitura ou de um sermão em edição.
 */
export function UpdatePrompt() {
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
