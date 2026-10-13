/**
 * Temas do Hub Resumos: os oito do Hub Bible (mesmas cores, em
 * styles/tokens.css) e o Verde, cor própria do Hub Resumos.
 */
export type ResolvedTheme = 'verde' | 'light' | 'sepia' | 'celeste' | 'safira' | 'jardim' | 'dark' | 'azul' | 'ministerial';
export type Theme = 'system' | ResolvedTheme;

export const THEME_LABEL: Record<Theme, string> = {
  system: 'Do aparelho (verde ou escuro)',
  verde: 'Verde (Hub Resumos)',
  light: 'Claro',
  sepia: 'Sépia',
  celeste: 'Azul e branco',
  safira: 'Azul safira',
  jardim: 'Verde e branco',
  dark: 'Escuro',
  azul: 'Noite azul',
  ministerial: 'Ministerial',
};

/** Ordem do botão de troca rápida: do papel ao mais escuro, como no Hub Bible. */
export const THEME_ORDER: ResolvedTheme[] = ['verde', 'light', 'sepia', 'celeste', 'safira', 'jardim', 'dark', 'azul', 'ministerial'];

export const isDarkTheme = (t: ResolvedTheme) => t === 'dark' || t === 'azul' || t === 'ministerial';

const KEY = 'hub-resumos:theme';

export function currentTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY) as Theme | null;
    return saved && saved in THEME_LABEL ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'verde';
}

export function applyTheme(theme: Theme): ResolvedTheme {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // sem armazenamento local, o tema vale só nesta visita
  }
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#1d5c4d');
  window.dispatchEvent(new CustomEvent('hub-resumos:theme', { detail: resolved }));
  return resolved;
}
