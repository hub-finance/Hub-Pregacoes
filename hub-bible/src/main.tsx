import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { SettingsProvider } from './core/settings/SettingsContext';
import { ToastProvider } from './components/Toast';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/reader.css';

/**
 * HashRouter: o app precisa funcionar servido de subdiretório, de arquivo local
 * e dentro de um WebView Android — o hash evita qualquer dependência de
 * reescrita de rotas no servidor.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ToastProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ToastProvider>
    </SettingsProvider>
  </StrictMode>,
);
