/**
 * Conjunto de ícones do aplicativo.
 *
 * Desenhados como traço contínuo de 24×24, peso 1.75 — a mesma linguagem em
 * todas as telas. Emoji foi abandonado de propósito: ele muda de desenho a cada
 * sistema, não acompanha a cor do tema e dá ao produto um ar improvisado.
 */

export type IconName =
  | 'home' | 'book' | 'search' | 'star' | 'note' | 'pray' | 'study' | 'sermon'
  | 'calendar' | 'library' | 'preach' | 'chart' | 'settings' | 'menu' | 'more'
  | 'close' | 'plus' | 'check' | 'chevron-right' | 'chevron-left' | 'chevron-down'
  | 'share' | 'copy' | 'trash' | 'edit' | 'download' | 'upload' | 'print'
  | 'sun' | 'moon' | 'sepia' | 'highlighter' | 'clock' | 'play' | 'pause'
  | 'reset' | 'swap' | 'text' | 'offline' | 'lock' | 'filter' | 'duplicate'
  | 'flame' | 'folder' | 'split' | 'warning' | 'info'
  | 'list' | 'quote' | 'arrow-up' | 'arrow-down';

const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  book: 'M4 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12A2 2 0 0 0 10.5 17H4zM20 4.5h-6A2.5 2.5 0 0 0 11.5 7v12A2 2 0 0 1 13.5 17H20z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16 16l4.5 4.5',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z',
  note: 'M4.5 4.5h10l5 5v10h-15zM14 4.5V10h5.5M8 13.5h8M8 17h5',
  pray: 'M12 21c-3 0-5.5-2.2-5.5-5V9.5a1.6 1.6 0 0 1 3.2 0V13m4.6 8c3 0 5.2-2.2 5.2-5V9.5a1.6 1.6 0 0 0-3.2 0V13M9.7 13V4.8a1.6 1.6 0 0 1 3.2 0V13',
  study: 'M4 5.5h5.5A2.5 2.5 0 0 1 12 8v11a2 2 0 0 0-2-1.7H4zM20 5.5h-5.5A2.5 2.5 0 0 0 12 8M6.5 9H9M6.5 12.5H9',
  sermon: 'M12 3.5a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5M6.5 10.5a5.5 5.5 0 0 0 11 0M12 16.5V21M9 21h6',
  calendar: 'M4.5 6.5h15v14h-15zM4.5 11h15M8.5 3.5v4M15.5 3.5v4',
  library: 'M3.5 20V6.5l8-3 8 3V20M3.5 20h16M8.5 20v-6h7v6M11 9.5h2',
  preach: 'M3.5 5.5h7A2.5 2.5 0 0 1 13 8v11M20.5 5.5h-7M13 8a2.5 2.5 0 0 1 2.5-2.5M3.5 5.5V19h17V5.5M12 19v2M8 21h8',
  chart: 'M4 20V4M4 20h16M8 20v-6M12.5 20V9M17 20v-9.5',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.1-1.2L14.2 3H9.8l-.3 2.7a7 7 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.1 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  'chevron-right': 'M9.5 5.5l6.5 6.5-6.5 6.5',
  'chevron-left': 'M14.5 5.5L8 12l6.5 6.5',
  'chevron-down': 'M5.5 9.5L12 16l6.5-6.5',
  share: 'M12 15.5V4M8 7.5L12 3.5l4 4M5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-5.5',
  copy: 'M9 9h9.5v11.5H9zM15 9V4.5H5.5V16H9',
  trash: 'M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5 7.5 20h9l1-13.5M10 10v6M14 10v6',
  edit: 'M4.5 19.5h4L20 8a2.1 2.1 0 0 0-3-3L5.5 16.5zM15 6.5l3 3',
  download: 'M12 3.5v11M8 11l4 4 4-4M4.5 17.5v3h15v-3',
  upload: 'M12 15.5v-11M8 8l4-4 4 4M4.5 17.5v3h15v-3',
  print: 'M7 8V3.5h10V8M7 18.5H4.5v-8h15v8H17M7 15h10v6H7z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5',
  sepia: 'M12 3.5c-4.7 0-8.5 3.8-8.5 8.5s3.8 8.5 8.5 8.5V3.5z',
  highlighter: 'M9 15.5 4.5 20h5l1.5-1.5M8 14.5 16.5 6a2.1 2.1 0 0 1 3 3L11 17.5zM4 21.5h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5.5l3.5 2',
  play: 'M7.5 4.8v14.4L19 12z',
  pause: 'M8.5 5v14M15.5 5v14',
  reset: 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4 4v4.5h4.5',
  swap: 'M4 8.5h14M14.5 5l3.5 3.5-3.5 3.5M20 15.5H6M9.5 12 6 15.5 9.5 19',
  text: 'M5 6.5V4.5h14v2M12 4.5V20M9 20h6',
  offline: 'M3 3l18 18M8.8 8.9A9 9 0 0 0 4 11M12 20h.01M8 15.5a5 5 0 0 1 5-1M2 8.5A14 14 0 0 1 6 6M22 8.5a14 14 0 0 0-8.5-3.4',
  lock: 'M6.5 10.5h11v10h-11zM8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5M12 14.5v2.5',
  filter: 'M3.5 5.5h17l-6.5 8v6l-4 2v-8z',
  duplicate: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
  flame: 'M12 21c3.3 0 6-2.4 6-5.5 0-4-3.5-5.5-3-9.5-2.5 1-4 3-4 5 0 1-1 1.5-1.5.8C8.8 10.5 8.5 9.5 8.5 9 7 10.3 6 12.4 6 15.5 6 18.6 8.7 21 12 21',
  folder: 'M3.5 6.5h6l2 2.5h9v11h-17zM3.5 6.5V19',
  split: 'M4 5h16v14H4zM12 5v14',
  warning: 'M12 4 2.5 20.5h19zM12 10v4.5M12 17.5h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11v5.5M12 7.5h.01',
  list: 'M4 6.5h.01M4 12h.01M4 17.5h.01M8.5 6.5H20M8.5 12H20M8.5 17.5H20',
  quote: 'M9.5 6.5C7 7.5 5.5 9.8 5.5 12.5v5h5v-5h-3c0-2 .8-3.4 2.6-4.2zM19 6.5c-2.5 1-4 3.3-4 6v5h5v-5h-3c0-2 .8-3.4 2.6-4.2z',
  'arrow-up': 'M12 20V4.5M6 10.5 12 4.5l6 6',
  'arrow-down': 'M12 4v15.5M6 13.5l6 6 6-6',
};

interface IconProps {
  name: IconName;
  size?: number;
  /** Preenche em vez de traçar — usado no estado ativo de estrela e favoritos. */
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 20, filled = false, className, style }: IconProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
