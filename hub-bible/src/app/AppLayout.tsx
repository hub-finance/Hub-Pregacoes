import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BOTTOM_NAV, GROUP_LABEL, NAV_ITEMS, type NavItem } from './navigation';
import { useOnline } from '../hooks';
import { useSettings } from '../core/settings/SettingsContext';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { SearchScopeProvider, useScopedSearch } from './SearchScope';

const groups: NavItem['group'][] = ['principal', 'ministerio', 'sistema'];

export function AppLayout({ children }: { children: ReactNode }) {
  /* O provider precisa envolver `children` para que as telas registrem a busca
     delas, e a barra precisa ler o registro — por isso a casca fica aqui e o
     conteúdo, num componente de dentro. */
  return (
    <SearchScopeProvider>
      <AppShell>{children}</AppShell>
    </SearchScopeProvider>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const online = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, update, resolvedTheme } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const searchHere = useScopedSearch();

  const cycleTheme = () => {
    const order = ['light', 'dark', 'sepia'] as const;
    const current = order.indexOf(resolvedTheme);
    update({ theme: order[(current + 1) % order.length] });
  };

  const bottomItems = BOTTOM_NAV.map((to) => NAV_ITEMS.find((i) => i.to === to)!).filter(Boolean);

  return (
    <div className="app-shell">
      <nav className="rail" aria-label="Menu principal">
        <div className="brand" style={{ padding: 'var(--sp-2) var(--sp-3) var(--sp-4)' }}>
          <span className="brand-mark" aria-hidden="true">
            HB
          </span>
          <span>
            <span style={{ display: 'block', fontWeight: 660, letterSpacing: '-0.01em' }}>
              Hub Bible
            </span>
            <span className="small dim">Bíblia e ministério</span>
          </span>
        </div>

        {groups.map((group) => (
          <div key={group}>
            <div className="rail-group-label">{GROUP_LABEL[group]}</div>
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `rail-item${isActive ? ' active' : ''}`}
              >
                <span className="ico">
                  <Icon name={item.icon} />
                </span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        <div className="spacer" />
        <button className="rail-item" onClick={cycleTheme}>
          <span className="ico">
            <Icon name={resolvedTheme === 'dark' ? 'moon' : resolvedTheme === 'sepia' ? 'sepia' : 'sun'} />
          </span>
          <span>
            Tema: {resolvedTheme === 'dark' ? 'escuro' : resolvedTheme === 'sepia' ? 'sépia' : 'claro'}
          </span>
        </button>
      </nav>

      <div className="app-main">
        {!online && (
          <div className="net-banner" role="status">
            <Icon name="offline" size={18} />
            <span>
              Você está offline. Seus dados e o texto já baixado continuam disponíveis.
            </span>
          </div>
        )}

        <header className="topbar">
          {/* no tablet/desktop o menu lateral já está visível */}
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <Icon name="menu" size={22} />
          </button>
          <div className="brand" style={{ flex: 1, minWidth: 0 }}>
            <span className="topbar-title truncate">
              {NAV_ITEMS.find((i) =>
                i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to),
              )?.label ?? 'Hub Bible'}
            </span>
          </div>
          {/* Em Cursos, Rhema e Sermões a lupa procura naquilo que está aberto.
              Só na falta de uma busca da tela é que ela leva à busca bíblica. */}
          <button
            className="icon-btn"
            onClick={() => (searchHere ? searchHere() : navigate('/busca'))}
            aria-label={searchHere ? 'Procurar nesta tela' : 'Buscar na Bíblia'}
          >
            <Icon name="search" />
          </button>
          <button
            className="icon-btn"
            onClick={cycleTheme}
            aria-label={`Alternar tema (atual: ${resolvedTheme})`}
          >
            <Icon name={resolvedTheme === 'dark' ? 'moon' : resolvedTheme === 'sepia' ? 'sepia' : 'sun'} />
          </button>
        </header>

        {children}
      </div>

      <nav className="bottom-nav" aria-label="Navegação rápida">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="ico">
              <Icon name={item.icon} size={22} />
            </span>
            <span>{item.shortLabel ?? item.label}</span>
          </NavLink>
        ))}
        <button className="bottom-nav-item" onClick={() => setMenuOpen(true)}>
          <span className="ico">
            <Icon name="more" size={22} />
          </span>
          <span>Mais</span>
        </button>
      </nav>

      <Sheet open={menuOpen} title="Menu" onClose={() => setMenuOpen(false)}>
        <div className="list">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="list-item"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} size={22} />
              <span className="list-body">
                <span className="list-title">{item.label}</span>
              </span>
              <Icon name="chevron-right" size={18} className="dim" />
            </NavLink>
          ))}
        </div>
        {settings.userName && (
          <p className="small dim center">Que Deus abençoe seu ministério, {settings.userName}.</p>
        )}
      </Sheet>
    </div>
  );
}
