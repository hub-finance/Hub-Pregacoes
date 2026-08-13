import { useNavigate } from 'react-router-dom';
import { DocList } from '../common/DocList';
import { newDevotional, saveDoc } from '../../core/data/documents';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME,
  detectFormat,
  extractTitle,
  saveAttachment,
} from '../../core/data/attachments';
import type { Devotional } from '../../core/db/types';

/**
 * Cursos — o material de aula que chega pronto.
 *
 * Mesma ideia do Rhema, para outro tipo de material: importa-se o arquivo do
 * curso (PDF, Word ou apresentação) e ensina-se a partir dele, com a Bíblia ao
 * lado. Internamente continua sendo o documento `devotional`, que já existia.
 */
export default function CoursesPage() {
  const navigate = useNavigate();

  const importFile = async (file: File) => {
    const { baseName, format } = detectFormat(file);
    // o título de dentro do arquivo vence o nome do arquivo
    const title = (await extractTitle(file, format)) || baseName || file.name;
    const course: Devotional = { ...newDevotional(), title, category: 'Escola de Líderes' };
    const attachment = await saveAttachment(course.id, file);
    await saveDoc('devotional', {
      ...course,
      attachmentId: attachment.id,
      attachmentFormat: attachment.format,
    });
    navigate(`/cursos/${course.id}`);
  };

  return (
    <DocList<Devotional>
      kind="devotional"
      title="Cursos"
      lead="O material das aulas, para estudar e ensinar."
      icon="study"
      route="/cursos"
      create={newDevotional}
      subtitleOf={(d) =>
        [d.attachmentId ? 'Material' : '', d.date, d.scripture].filter(Boolean).join(' · ')
      }
      emptyDescription="Importe o material do curso em PDF, Word ou apresentação — e ensine com a Bíblia ao lado."
      onImportFile={importFile}
      importAccept={`${ACCEPTED_MIME},${ACCEPTED_EXTENSIONS}`}
    />
  );
}
