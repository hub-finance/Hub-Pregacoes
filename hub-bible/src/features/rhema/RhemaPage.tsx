import { useNavigate } from 'react-router-dom';
import { mainTextOf } from '../../core/data/studySections';
import { DocList } from '../common/DocList';
import { newStudy, saveDoc } from '../../core/data/documents';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME,
  detectFormat,
  extractTitle,
  saveAttachment,
} from '../../core/data/attachments';
import type { Study } from '../../core/db/types';

/**
 * Rhema — estudo bíblico e as apostilas do Rhema Brasil.
 *
 * Duas portas para o mesmo lugar: escrever o estudo aqui dentro, ou importar a
 * apostila em PDF e ensinar a partir dela, com a Bíblia ao lado. Internamente
 * continua sendo o documento `study`, que já existia (seção 12 da
 * especificação).
 */
export default function RhemaPage() {
  const navigate = useNavigate();

  /** Apostila pronta em PDF ou Word: entra inteira e é exibida como está. */
  const importFile = async (file: File) => {
    const { baseName, format } = detectFormat(file);
    // o título de dentro do documento vence o nome do arquivo
    const title = (await extractTitle(file, format)) || baseName || file.name;
    const study: Study = { ...newStudy(), title, category: 'Escola de Líderes' };
    const attachment = await saveAttachment(study.id, file);
    await saveDoc('study', {
      ...study,
      attachmentId: attachment.id,
      attachmentFormat: attachment.format,
    });
    navigate(`/rhema/${study.id}`);
  };

  return (
    <DocList<Study>
      kind="study"
      title="Rhema"
      lead="Estudos e apostilas para estudar e ensinar."
      icon="study"
      route="/rhema"
      create={newStudy}
      subtitleOf={(s) =>
        [s.attachmentId ? 'Apostila' : '', s.theme, mainTextOf(s)].filter(Boolean).join(' · ')
      }
      emptyDescription="Escreva um estudo — ou importe uma apostila em PDF e ensine com a Bíblia ao lado."
      onImportFile={importFile}
      importAccept={`${ACCEPTED_MIME},${ACCEPTED_EXTENSIONS}`}
    />
  );
}
