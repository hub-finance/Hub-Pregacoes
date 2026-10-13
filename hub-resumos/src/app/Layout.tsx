import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { applyTheme, currentTheme, resolveTheme, THEME_LABEL, THEME_ORDER, type ResolvedTheme } from './theme';

const themeIcon = (t: ResolvedTheme): IconName => (t === 'sepia' ? 'sepia' : t === 'dark' || t === 'azul' || t === 'ministerial' ? 'moon' : 'sun');

/** Tema atual, acompanhando as trocas feitas em qualquer tela. */
function useResolvedTheme() {
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(currentTheme()));
  useEffect(() => {
    const on = (e: Event) => setTheme((e as CustomEvent<ResolvedTheme>).detail);
    window.addEventListener('hub-resumos:theme', on);
    return () => window.removeEventListener('hub-resumos:theme', on);
  }, []);
  return theme;
}

const NAV: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Biblioteca', icon: 'library' },
  { to: '/revisar', label: 'Revisar cartões', icon: 'layers' },
  { to: '/config', label: 'Dados e ajustes', icon: 'settings' },
];

/** Casca do app: menu lateral em tela larga, barra inferior no celular. */
export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const current = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
  const theme = useResolvedTheme();
  const cycleTheme = () => applyTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]);

  return (
    <div className="app-shell">
      <nav className="rail" aria-label="Menu principal">
        <div className="brand" style={{ padding: 'var(--sp-2) var(--sp-3) var(--sp-4)' }}>
          <span className="brand-mark" aria-hidden="true">
            HR
          </span>
          <span>
            <span style={{ display: 'block', fontWeight: 660, letterSpacing: '-0.01em' }}>Hub Resumos</span>
            <span className="small dim">Resumos e interpretações</span>
          </span>
        </div>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `rail-item${isActive ? ' active' : ''}`}>
            <span className="ico">
              <Icon name={item.icon} />
            </span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
        <div className="spacer" />
        <button className="rail-item" onClick={cycleTheme}>
          <span className="ico">
            <Icon name={themeIcon(theme)} />
          </span>
          <span>Tema: {THEME_LABEL[theme]}</span>
        </button>
      </nav>

      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => navigate('/')} aria-label="Ir para a biblioteca">
            <Icon name="home" size={22} />
          </button>
          <div className="brand" style={{ flex: 1, minWidth: 0 }}>
            <span className="topbar-title truncate">{current?.label ?? 'Hub Resumos'}</span>
          </div>
          <button className="icon-btn" onClick={() => navigate('/config')} aria-label="Dados e ajustes">
            <Icon name="settings" />
          </button>
          <button className="icon-btn" onClick={cycleTheme} aria-label={`Alternar tema (atual: ${THEME_LABEL[theme]})`} title={`Tema: ${THEME_LABEL[theme]}`}>
            <Icon name={themeIcon(theme)} />
          </button>
        </header>
        {children}
      </div>

      <nav className="bottom-nav" aria-label="Navegação rápida">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
            <span className="ico">
              <Icon name={item.icon} size={22} />
            </span>
            <span>{item.label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
