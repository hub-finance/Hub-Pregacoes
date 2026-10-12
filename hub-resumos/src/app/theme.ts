/** Tema do app — guardado no aparelho e aplicado na raiz do documento. */
export type Theme = 'system' | 'light' | 'sepia' | 'dark';

export const THEME_LABEL: Record<Theme, string> = {
  system: 'Do aparelho',
  light: 'Claro',
  sepia: 'Sépia',
  dark: 'Escuro',
};

const KEY = 'hub-resumos:theme';

export function currentTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // sem armazenamento local, o tema vale só nesta visita
  }
  const resolved =
    theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
}
