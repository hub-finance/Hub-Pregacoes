import { DocList } from '../common/DocList';
import { newDevotional } from '../../core/data/documents';
import type { Devotional } from '../../core/db/types';

/** Devocionais — seção 11 da especificação. */
export default function DevotionalsPage() {
  return (
    <DocList<Devotional>
      kind="devotional"
      title="Devocionais"
      lead="Registre o que Deus tem falado, dia após dia."
      icon="🙏"
      route="/devocionais"
      create={newDevotional}
      subtitleOf={(d) => [d.date, d.scripture].filter(Boolean).join(' · ')}
      emptyDescription="Cada devocional guarda texto bíblico, reflexão, aplicação e oração — formando o seu histórico."
    />
  );
}
