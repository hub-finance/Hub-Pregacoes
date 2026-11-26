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

/** Um estudo novo já na prateleira de Estudos. */
const newEstudo = (): Study => ({ ...newStudy(), shelf: 'estudos', category: 'Estudos' });

/**
 * Estudos — material de apoio para estudar e preparar a pregação: apostilas,
 * estudos e mensagens em PDF, Word ou HTML (pedido do usuário). É o mesmo
 * documento `study` do Rhema e da Escola, com o mesmo editor e o Modo Aula;
 * o que separa as abas é `shelf`. Existe nas duas edições.
 */
export default function EstudosPage() {
  const navigate = useNavigate();

  const importFile = async (file: File) => {
    const { baseName, format } = detectFormat(file);
    const title = (await extractTitle(file, format)) || baseName || file.name;
    const study: Study = { ...newEstudo(), title };
    const attachment = await saveAttachment(study.id, file);
    await saveDoc('study', {
      ...study,
      attachmentId: attachment.id,
      attachmentFormat: attachment.format,
    });
    navigate(`/estudos/${study.id}`);
  };

  return (
    <DocList<Study>
      kind="study"
      itemLabel="Estudo"
      title="Estudos"
      lead="Material de apoio para estudar e pregar: apostilas e estudos em PDF, Word ou HTML."
      icon="folder"
      route="/estudos"
      create={newEstudo}
      subtitleOf={(s) =>
        [s.attachmentId ? 'Apostila' : '', s.theme, mainTextOf(s)].filter(Boolean).join(' · ')
      }
      emptyDescription="Importe a apostila ou o estudo em PDF, Word ou HTML e estude com a Bíblia ao lado — ou escreva um estudo."
      onImportFile={importFile}
      importAccept={`${ACCEPTED_MIME},${ACCEPTED_EXTENSIONS}`}
      filter={(s) => s.shelf === 'estudos'}
    />
  );
}
