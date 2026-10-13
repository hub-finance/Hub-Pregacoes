/**
 * Modelos visuais dos arquivos gerados.
 *
 * Um modelo visual decide só a aparência — fonte, tamanhos, cores e o desenho
 * dos quadros. O texto é sempre o do autor; nenhum modelo acrescenta, tira ou
 * reordena conteúdo.
 *
 * As fontes: no PDF vão embutidas (Lora e Source Sans 3, licença OFL, em
 * `public/fonts/`), para que acentos e símbolos saiam iguais em qualquer
 * aparelho. No Word o arquivo indica Georgia e Calibri, que acompanham o
 * Office; embutir a fonte no .docx triplicaria o tamanho do arquivo.
 */

export type FontKind = 'serif' | 'sans';

export interface ExportTheme {
  id: string;
  label: string;
  description: string;
  body: FontKind;
  headings: FontKind;
  /** Proporções em relação ao tamanho do corpo. */
  titleScale: number;
  h1Scale: number;
  h2Scale: number;
  h1Uppercase: boolean;
  justify: boolean;
  /** Cores em `RRGGBB`. */
  colors: {
    text: string;
    muted: string;
    title: string;
    heading: string;
    /** Linhas, fio da citação e detalhes. */
    accent: string;
    highlightBg: string;
    quoteBg: string;
  };
  /** Fio abaixo dos títulos de seção. */
  headingRule: boolean;
}

export const EXPORT_THEMES: ExportTheme[] = [
  {
    id: 'classico',
    label: 'Clássico',
    description: 'Simples e formal, em preto, próprio para imprimir.',
    body: 'serif',
    headings: 'serif',
    titleScale: 1.9,
    h1Scale: 1.3,
    h2Scale: 1.1,
    h1Uppercase: false,
    justify: true,
    colors: {
      text: '1A1A1A',
      muted: '5C5C5C',
      title: '111111',
      heading: '111111',
      accent: '444444',
      highlightBg: 'F2F2F2',
      quoteBg: 'F7F7F7',
    },
    headingRule: false,
  },
  {
    id: 'pastoral',
    label: 'Pastoral',
    description: 'Azul e dourado, para pregações, mensagens e devocionais.',
    body: 'serif',
    headings: 'serif',
    titleScale: 1.85,
    h1Scale: 1.22,
    h2Scale: 1.08,
    h1Uppercase: false,
    justify: true,
    colors: {
      text: '14120F',
      muted: '6B645B',
      title: '1F4E79',
      heading: '1F4E79',
      accent: '8A6A2F',
      highlightBg: 'EEF3F9',
      quoteBg: 'FAF6EE',
    },
    headingRule: true,
  },
  {
    id: 'academico',
    label: 'Acadêmico',
    description: 'Sóbrio e denso, para estudos aprofundados.',
    body: 'serif',
    headings: 'sans',
    titleScale: 1.7,
    h1Scale: 1.2,
    h2Scale: 1.05,
    h1Uppercase: false,
    justify: true,
    colors: {
      text: '1B1B1B',
      muted: '595959',
      title: '2B2B2B',
      heading: '2B3A4A',
      accent: '2B3A4A',
      highlightBg: 'F1F3F5',
      quoteBg: 'F6F7F8',
    },
    headingRule: false,
  },
  {
    id: 'didatico',
    label: 'Didático',
    description: 'Títulos marcados e quadros de destaque, para apostilas e treinamentos.',
    body: 'sans',
    headings: 'sans',
    titleScale: 1.9,
    h1Scale: 1.35,
    h2Scale: 1.12,
    h1Uppercase: false,
    justify: false,
    colors: {
      text: '1E2328',
      muted: '5D6770',
      title: '1D5C4D',
      heading: '1D5C4D',
      accent: '2E8B73',
      highlightBg: 'E8F4F0',
      quoteBg: 'F3F7F6',
    },
    headingRule: true,
  },
  {
    id: 'institucional',
    label: 'Institucional',
    description: 'Limpo e objetivo, para relatórios, manuais e comunicados.',
    body: 'sans',
    headings: 'sans',
    titleScale: 1.75,
    h1Scale: 1.22,
    h2Scale: 1.06,
    h1Uppercase: true,
    justify: false,
    colors: {
      text: '1F2933',
      muted: '616E7C',
      title: '1B2A41',
      heading: '1B2A41',
      accent: '3E5C76',
      highlightBg: 'EEF2F6',
      quoteBg: 'F5F7FA',
    },
    headingRule: true,
  },
];

export const themeById = (id: string): ExportTheme =>
  EXPORT_THEMES.find((t) => t.id === id) ?? EXPORT_THEMES[1];

/**
 * Tema com a cor escolhida pelo usuário no lugar da cor do modelo: títulos e
 * detalhes passam a ela; o texto continua escuro, por legibilidade.
 */
export function resolveTheme(id: string, accentColor?: string): ExportTheme {
  const base = themeById(id);
  const hex = accentColor?.replace('#', '').toUpperCase();
  if (!hex || !/^[0-9A-F]{6}$/.test(hex)) return base;
  return {
    ...base,
    colors: { ...base.colors, title: hex, heading: hex, accent: hex },
  };
}

/** Margens em milímetros. */
export const MARGINS_MM: Record<'estreita' | 'normal' | 'larga', number> = {
  estreita: 15,
  normal: 22,
  larga: 28,
};

/** Tamanho da folha em milímetros. */
export const PAGE_MM: Record<'A4' | 'A5' | 'LETTER', { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4' },
  A5: { width: 148, height: 210, label: 'A5 (livreto)' },
  LETTER: { width: 215.9, height: 279.4, label: 'Carta' },
};

/** Nome da fonte no Word para cada família. */
export const DOCX_FONT: Record<FontKind, string> = {
  serif: 'Georgia',
  sans: 'Calibri',
};

/** Nome da família registrada no gerador de PDF. */
export const PDF_FONT: Record<FontKind, string> = {
  serif: 'Lora',
  sans: 'SourceSans',
};

/** Cores oferecidas para a "cor institucional". */
export const ACCENT_CHOICES = [
  { value: '', label: 'Do modelo' },
  { value: '#1F4E79', label: 'Azul' },
  { value: '#8A6A2F', label: 'Dourado' },
  { value: '#7A1F2B', label: 'Vinho' },
  { value: '#1D5C4D', label: 'Verde' },
  { value: '#3B3B3B', label: 'Grafite' },
  { value: '#4B2E83', label: 'Roxo' },
];
