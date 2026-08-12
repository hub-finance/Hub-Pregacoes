import { DocList } from '../common/DocList';
import { newSermon } from '../../core/data/documents';
import type { Sermon } from '../../core/db/types';

/** Organizador de sermões — seção 13 da especificação. */
export default function SermonsPage() {
  return (
    <DocList<Sermon>
      kind="sermon"
      title="Sermões"
      lead="Prepare, organize e pregue com clareza."
      icon="🎙️"
      route="/sermoes"
      create={newSermon}
      subtitleOf={(s) => [s.theme, s.mainText].filter(Boolean).join(' · ')}
      emptyDescription="Crie seu primeiro sermão com introdução, pontos, conclusão e apelo — tudo em um só lugar."
    />
  );
}
