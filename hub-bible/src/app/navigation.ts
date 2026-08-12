/** Mapa de navegação — fonte única para menu lateral, barra inferior e Home. */

export interface NavItem {
  to: string;
  label: string;
  /** Rótulo curto usado na barra inferior do celular. */
  shortLabel?: string;
  icon: string;
  /** Mostrado nos atalhos da tela inicial. */
  quick?: boolean;
  group: 'principal' | 'ministerio' | 'sistema';
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: '🏠', group: 'principal' },
  { to: '/biblia', label: 'Bíblia', icon: '📖', quick: true, group: 'principal' },
  { to: '/busca', label: 'Buscar', icon: '🔎', quick: true, group: 'principal' },
  { to: '/favoritos', label: 'Favoritos', icon: '⭐', quick: true, group: 'principal' },
  { to: '/anotacoes', label: 'Anotações', icon: '📝', quick: true, group: 'principal' },
  { to: '/devocionais', label: 'Devocional', icon: '🙏', quick: true, group: 'ministerio' },
  { to: '/estudos', label: 'Estudos', icon: '📚', quick: true, group: 'ministerio' },
  { to: '/sermoes', label: 'Sermões', icon: '🎙️', quick: true, group: 'ministerio' },
  { to: '/planos', label: 'Plano de leitura', icon: '📅', quick: true, group: 'ministerio' },
  {
    to: '/biblioteca',
    label: 'Biblioteca Ministerial',
    shortLabel: 'Biblioteca',
    icon: '📂',
    quick: true,
    group: 'ministerio',
  },
  { to: '/pregacao', label: 'Modo Pregação', icon: '🕮', quick: true, group: 'ministerio' },
  { to: '/painel', label: 'Minha vida ministerial', icon: '📊', group: 'sistema' },
  { to: '/config', label: 'Configurações', icon: '⚙️', group: 'sistema' },
];

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  principal: 'Bíblia',
  ministerio: 'Ministério',
  sistema: 'Aplicativo',
};

/** Itens fixos da barra inferior no celular. */
export const BOTTOM_NAV = ['/', '/biblia', '/busca', '/biblioteca'];
