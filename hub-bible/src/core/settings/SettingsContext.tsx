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

export type ThemeChoice = 'system' | 'light' | 'dark' | 'sepia' | 'azul';

/** O tema de fato aplicado — `system` já resolvido em claro ou escuro. */
export type ResolvedTheme = Exclude<ThemeChoice, 'system'>;

/** Cor da barra do sistema, por tema. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#faf8f5',
  sepia: '#f3e9d8',
  dark: '#22262e',
  azul: '#24374f',
};

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
  /** Fundo escolhido para a imagem do versículo. Vazio = seguir o tema. */
  shareBackground?: string;
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
  /** Duração alvo da mensagem, em minutos. `null` = tempo livre. */
  preachingMinutes: number | null;
  /** Corpo do texto no Modo Pregação, independente do tamanho do leitor. */
  preachingScale: number;
  /** Corpo do texto na Bíblia ao lado (tela dividida), ajustável ali mesmo. */
  panelScale: number;
  /** Quanto da largura cabe à Bíblia na tela dividida, em porcentagem. */
  splitRatio: number;
  /** Ampliação do documento importado (PDF/Word) na tela cheia. */
  docZoom: number;
  /** Aparar as margens brancas do PDF, para a letra render mais na coluna. */
  trimMargins: boolean;
  /** Versão das preferências — permite reaplicar padrões melhores em quem já usa. */
  settingsVersion: number;
}

/** Larguras de leitura, em rem. "Cheia" aproveita quase toda a tela do tablet. */
export const MEASURE_PRESETS = [
  { label: 'Estreita', value: 38 },
  { label: 'Média', value: 48 },
  { label: 'Larga', value: 58 },
  { label: 'Cheia', value: 76 },
] as const;

/** Versão atual das preferências. Ao subir, `migrate` reaplica o que mudou. */
const SETTINGS_VERSION = 2;

const STORAGE_KEY = 'hub-bible:appearance';

export const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  theme: 'system',
  shareBackground: undefined,
  contrast: 'normal',
  fontScale: 1,
  leading: 1.75,
  measure: 58,
  readerFont: 'serif',
  verseLayout: 'paragraph',
  textAlign: 'left',
  dropCap: true,
  defaultTranslation: 'pt_almeida',
  compareTranslation: null,
  customCategories: [],
  lastPosition: null,
  onboarded: false,
  preachingMinutes: 40,
  preachingScale: 1,
  panelScale: 0.9,
  splitRatio: 42,
  docZoom: 1,
  trimMargins: true,
  settingsVersion: SETTINGS_VERSION,
};

/**
 * Aplica melhorias de padrão a quem já usava o app.
 * v2 — a largura de leitura padrão era estreita demais em tablets: quem nunca
 * mexeu no ajuste (ficou nos 38rem antigos) passa a usar a largura nova.
 */
function migrate(merged: AppSettings, storedVersion: number): AppSettings {
  let next = merged;
  if (storedVersion < 2) {
    // 38rem era o padrão antigo: quem está nele nunca ajustou a largura
    next = { ...next, measure: next.measure === 38 ? DEFAULT_SETTINGS.measure : next.measure };
  }
  return { ...next, settingsVersion: SETTINGS_VERSION };
}

function read(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // a versão precisa vir do que estava gravado, antes de misturar com os padrões
    return migrate({ ...DEFAULT_SETTINGS, ...parsed }, parsed.settingsVersion ?? 1);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
  reset: () => void;
  categories: HighlightCategory[];
  resolvedTheme: ResolvedTheme;
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

  const resolvedTheme = useMemo<ResolvedTheme>(() => {
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
    // o limite em vw garante que a coluna nunca estoure a tela do celular
    root.style.setProperty('--reader-measure', `min(${settings.measure}rem, 94vw)`);
    root.style.setProperty(
      '--font-reader',
      settings.readerFont === 'serif' ? 'var(--font-serif)' : 'var(--font-ui)',
    );
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', THEME_COLOR[resolvedTheme]);
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
