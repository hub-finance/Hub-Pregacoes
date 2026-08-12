import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { HighlightCategory } from '../categories';
import { HIGHLIGHT_CATEGORIES } from '../categories';

export type ThemeChoice = 'system' | 'light' | 'dark' | 'sepia';

export interface ReadingPosition {
  translation: string;
  book: string;
  chapter: number;
  verse?: number;
  at: number;
}

export interface AppSettings {
  userName: string;
  theme: ThemeChoice;
  contrast: 'normal' | 'high';
  fontScale: number;
  leading: number;
  measure: number;
  readerFont: 'serif' | 'sans';
  verseLayout: 'paragraph' | 'lines';
  /** Alinhamento do texto bíblico. */
  textAlign: 'left' | 'justify';
  /** Capitular: número do capítulo em corpo grande no início do texto. */
  dropCap: boolean;
  defaultTranslation: string;
  compareTranslation: string | null;
  customCategories: HighlightCategory[];
  lastPosition: ReadingPosition | null;
  onboarded: boolean;
}

const STORAGE_KEY = 'hub-bible:appearance';

export const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  theme: 'system',
  contrast: 'normal',
  fontScale: 1,
  leading: 1.75,
  measure: 38,
  readerFont: 'serif',
  verseLayout: 'paragraph',
  textAlign: 'left',
  dropCap: true,
  defaultTranslation: 'pt_almeida',
  compareTranslation: null,
  customCategories: [],
  lastPosition: null,
  onboarded: false,
};

function read(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  categories: HighlightCategory[];
  resolvedTheme: 'light' | 'dark' | 'sepia';
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(read);
  const [systemDark, setSystemDark] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = useMemo<'light' | 'dark' | 'sepia'>(() => {
    if (settings.theme === 'system') return systemDark ? 'dark' : 'light';
    return settings.theme;
  }, [settings.theme, systemDark]);

  // aplica tokens no <html> — um único ponto de verdade para o visual
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.contrast = settings.contrast;
    root.style.setProperty('--reader-scale', String(settings.fontScale));
    root.style.setProperty('--reader-leading', String(settings.leading));
    root.style.setProperty('--reader-measure', `${settings.measure}rem`);
    root.style.setProperty(
      '--font-reader',
      settings.readerFont === 'serif' ? 'var(--font-serif)' : 'var(--font-ui)',
    );
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#0f1115' : '#faf8f5');
  }, [resolvedTheme, settings.contrast, settings.fontScale, settings.leading, settings.measure, settings.readerFont]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* armazenamento indisponível (modo privado) — o app segue funcionando */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const categories = useMemo(
    () => [...HIGHLIGHT_CATEGORIES, ...settings.customCategories],
    [settings.customCategories],
  );

  const value = useMemo(
    () => ({ settings, update, reset, categories, resolvedTheme }),
    [settings, update, reset, categories, resolvedTheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings precisa estar dentro de <SettingsProvider>');
  return ctx;
}
