import type { IconName } from '../components/Icon';
import { HAS_RHEMA } from '../core/edition';

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

const ALL_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: 'home', group: 'principal' },
  { to: '/biblia', label: 'Bíblia', icon: 'book', quick: true, group: 'principal' },
  { to: '/busca', label: 'Buscar', icon: 'search', quick: true, group: 'principal' },
  { to: '/favoritos', label: 'Favoritos', icon: 'star', quick: true, group: 'principal' },
  { to: '/anotacoes', label: 'Anotações', icon: 'note', quick: true, group: 'principal' },
  { to: '/dicionario', label: 'Dicionário', icon: 'dictionary', quick: true, group: 'principal' },
  { to: '/cursos', label: 'Cursos', icon: 'library', quick: true, group: 'ministerio' },
  { to: '/rhema', label: 'Rhema', icon: 'study', quick: true, group: 'ministerio' },
  { to: '/escola', label: 'Escola de Ministros', shortLabel: 'Escola', icon: 'school', quick: true, group: 'ministerio' },
  { to: '/sermoes', label: 'Gerador', icon: 'sermon', quick: true, group: 'ministerio' },
  { to: '/guias', label: 'Guias Doutrinários', shortLabel: 'Guias', icon: 'layers', quick: true, group: 'ministerio' },
  { to: '/assistente', label: 'Assistente bíblico', shortLabel: 'Assistente', icon: 'bible-study', quick: true, group: 'ministerio' },
  { to: '/planos', label: 'Plano de leitura', icon: 'calendar', quick: true, group: 'ministerio' },
  { to: '/exportar', label: 'Gerar e Exportar', shortLabel: 'Exportar', icon: 'download', quick: true, group: 'ministerio' },
  { to: '/pregacao', label: 'Modo Pregação', icon: 'preach', quick: true, group: 'ministerio' },
  { to: '/painel', label: 'Minha vida ministerial', icon: 'chart', group: 'sistema' },
  { to: '/config', label: 'Configurações', icon: 'settings', quick: true, group: 'sistema' },
  { to: '/ajuda', label: 'Ajuda', icon: 'info', group: 'sistema' },
];

/** Na edição 2.0 (reduzida), Rhema e Escola de Ministros não aparecem. */
export const NAV_ITEMS: NavItem[] = ALL_ITEMS.filter(
  (item) => HAS_RHEMA || (item.to !== '/rhema' && item.to !== '/escola'),
);

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  principal: 'Bíblia',
  ministerio: 'Ministério',
  sistema: 'Aplicativo',
};

/** Itens fixos da barra inferior no celular. */
export const BOTTOM_NAV = ['/', '/biblia', '/busca', '/assistente'];
