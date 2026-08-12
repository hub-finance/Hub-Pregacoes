import type { IconName } from '../components/Icon';

/** Mapa de navegação — fonte única para menu lateral, barra inferior e Home. */

export interface NavItem {
  to: string;
  label: string;
  /** Rótulo curto usado na barra inferior do celular. */
  shortLabel?: string;
  icon: IconName;
  /** Mostrado nos atalhos da tela inicial. */
  quick?: boolean;
  group: 'principal' | 'ministerio' | 'sistema';
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: 'home', group: 'principal' },
  { to: '/biblia', label: 'Bíblia', icon: 'book', quick: true, group: 'principal' },
  { to: '/busca', label: 'Buscar', icon: 'search', quick: true, group: 'principal' },
  { to: '/favoritos', label: 'Favoritos', icon: 'star', quick: true, group: 'principal' },
  { to: '/anotacoes', label: 'Anotações', icon: 'note', quick: true, group: 'principal' },
  { to: '/devocionais', label: 'Devocional', icon: 'pray', quick: true, group: 'ministerio' },
  { to: '/estudos', label: 'Estudos', icon: 'study', quick: true, group: 'ministerio' },
  { to: '/sermoes', label: 'Sermões', icon: 'sermon', quick: true, group: 'ministerio' },
  { to: '/planos', label: 'Plano de leitura', icon: 'calendar', quick: true, group: 'ministerio' },
  {
    to: '/biblioteca',
    label: 'Biblioteca Ministerial',
    shortLabel: 'Biblioteca',
    icon: 'library',
    quick: true,
    group: 'ministerio',
  },
  { to: '/pregacao', label: 'Modo Pregação', icon: 'preach', quick: true, group: 'ministerio' },
  { to: '/painel', label: 'Minha vida ministerial', icon: 'chart', group: 'sistema' },
  { to: '/config', label: 'Configurações', icon: 'settings', group: 'sistema' },
];

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  principal: 'Bíblia',
  ministerio: 'Ministério',
  sistema: 'Aplicativo',
};

/** Itens fixos da barra inferior no celular. */
export const BOTTOM_NAV = ['/', '/biblia', '/busca', '/biblioteca'];
