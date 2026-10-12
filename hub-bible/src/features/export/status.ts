import type { ExportStatus } from '../../core/db/types';

export const STATUS_LABEL: Record<ExportStatus, string> = {
  rascunho: 'Rascunho',
  aprovado: 'Aprovado',
  finalizado: 'Finalizado',
};
