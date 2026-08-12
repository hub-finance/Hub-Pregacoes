import { DocList } from '../common/DocList';
import { newStudy } from '../../core/data/documents';
import type { Study } from '../../core/db/types';

/** Estudos bíblicos — seção 12 da especificação. */
export default function StudiesPage() {
  return (
    <DocList<Study>
      kind="study"
      title="Estudos"
      lead="Aprofunde temas e organize o ensino."
      icon="study"
      route="/estudos"
      create={newStudy}
      subtitleOf={(s) => [s.theme, s.mainText].filter(Boolean).join(' · ')}
      emptyDescription="Monte estudos com introdução, desenvolvimento, versículos relacionados, aplicação e conclusão."
    />
  );
}
