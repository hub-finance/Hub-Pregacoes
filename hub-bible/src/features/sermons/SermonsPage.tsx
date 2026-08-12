import { useNavigate } from 'react-router-dom';
import { DocList } from '../common/DocList';
import { newSermon, saveDoc } from '../../core/data/documents';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME,
  detectFormat,
  saveAttachment,
} from '../../core/data/attachments';
import type { Sermon } from '../../core/db/types';

/** Organizador de sermões — seção 13 da especificação. */
export default function SermonsPage() {
  const navigate = useNavigate();

  /**
   * Sermão que já veio pronto em PDF ou Word: o arquivo entra inteiro e é
   * exibido como está. O título nasce do nome do arquivo e pode ser trocado.
   */
  const importFile = async (file: File) => {
    const { baseName } = detectFormat(file);
    const sermon: Sermon = { ...newSermon(), title: baseName || file.name };
    const attachment = await saveAttachment(sermon.id, file);
    await saveDoc('sermon', {
      ...sermon,
      attachmentId: attachment.id,
      attachmentFormat: attachment.format,
    });
    navigate(`/sermoes/${sermon.id}`);
  };

  return (
    <DocList<Sermon>
      kind="sermon"
      title="Sermões"
      lead="Prepare, organize e pregue com clareza."
      icon="sermon"
      route="/sermoes"
      create={newSermon}
      subtitleOf={(s) => [s.theme, s.mainText].filter(Boolean).join(' · ')}
      emptyDescription="Crie seu primeiro sermão com introdução, desenvolvimento, conclusão e aplicação — ou importe um que já esteja pronto em PDF ou Word."
      onImportFile={importFile}
      importAccept={`${ACCEPTED_MIME},${ACCEPTED_EXTENSIONS}`}
    />
  );
}
