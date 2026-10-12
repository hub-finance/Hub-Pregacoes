import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/Toast';
import { askPersistence } from './core/db';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/resumos.css';

// pedir ao navegador que guarde os dados de vez (não apagar sozinho)
void askPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ToastProvider>
  </StrictMode>,
);
