/** Categorias padrão do aplicativo (o usuário pode criar as suas). */

export interface HighlightCategory {
  id: string;
  label: string;
  /** Variável CSS com a cor da categoria. */
  color: string;
}

export const HIGHLIGHT_CATEGORIES: HighlightCategory[] = [
  { id: 'promessas', label: 'Promessas', color: 'var(--hl-promessas)' },
  { id: 'fe', label: 'Fé', color: 'var(--hl-fe)' },
  { id: 'cura', label: 'Cura', color: 'var(--hl-cura)' },
  { id: 'santidade', label: 'Santidade', color: 'var(--hl-santidade)' },
  { id: 'espirito-santo', label: 'Espírito Santo', color: 'var(--hl-espirito)' },
  { id: 'lideranca', label: 'Liderança', color: 'var(--hl-lideranca)' },
  { id: 'familia', label: 'Família', color: 'var(--hl-familia)' },
  { id: 'salvacao', label: 'Salvação', color: 'var(--hl-salvacao)' },
  { id: 'graca', label: 'Graça', color: 'var(--hl-graca)' },
  { id: 'amor', label: 'Amor', color: 'var(--hl-amor)' },
  { id: 'ministerio', label: 'Ministério', color: 'var(--hl-ministerio)' },
];

/** Categorias da Biblioteca Ministerial (seção 15 da especificação). */
export const LIBRARY_CATEGORIES = [
  'Sermões',
  'Rhema',
  'Cursos',
  'Liderança',
  'GC',
  'Discipulado',
  'Escola de Líderes',
  'Treinamento',
  'Ministério',
  'Evangelismo',
  'Família',
  'Vida cristã',
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

/** Categorias sugeridas para sermões, Rhema e cursos. */
export const CONTENT_CATEGORIES = [
  'Culto',
  'Célula / GC',
  'Discipulado',
  'Escola de Líderes',
  'Treinamento',
  'Evangelismo',
  'Família',
  'Juventude',
  'Liderança',
  'Ministério',
  'Vida cristã',
  'Outros',
] as const;

export function categoryColor(id: string): string {
  return HIGHLIGHT_CATEGORIES.find((c) => c.id === id)?.color ?? 'var(--hl-custom)';
}

export function categoryLabel(id: string): string {
  return HIGHLIGHT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Converte um rótulo livre em id estável ("Espírito Santo" -> "espirito-santo"). */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
