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

/** Um estudo novo já na prateleira da Escola. */
const newEscolaStudy = (): Study => ({ ...newStudy(), shelf: 'escola', category: 'Escola de Ministros' });

/**
 * Escola de Ministros — igual ao Rhema (pedido do usuário): importar a
 * apostila, abrir e dar aula no Modo Aula com a Bíblia ao lado. Usa o mesmo
 * documento `study` e o mesmo editor; o que separa as duas abas é `shelf`.
 */
export default function EscolaPage() {
  const navigate = useNavigate();

  const importFile = async (file: File) => {
    const { baseName, format } = detectFormat(file);
    const title = (await extractTitle(file, format)) || baseName || file.name;
    const study: Study = { ...newEscolaStudy(), title };
    const attachment = await saveAttachment(study.id, file);
    await saveDoc('study', {
      ...study,
      attachmentId: attachment.id,
      attachmentFormat: attachment.format,
    });
    navigate(`/escola/${study.id}`);
  };

  return (
    <DocList<Study>
      kind="study"
      title="Escola de Ministros"
      lead="Apostilas e estudos da Escola de Ministros, para estudar e ensinar."
      icon="school"
      route="/escola"
      create={newEscolaStudy}
      subtitleOf={(s) =>
        [s.attachmentId ? 'Apostila' : '', s.theme, mainTextOf(s)].filter(Boolean).join(' · ')
      }
      emptyDescription="Importe a apostila em PDF ou Word e dê a aula com a Bíblia ao lado — ou escreva um estudo."
      onImportFile={importFile}
      importAccept={`${ACCEPTED_MIME},${ACCEPTED_EXTENSIONS}`}
      filter={(s) => s.shelf === 'escola'}
    />
  );
}
