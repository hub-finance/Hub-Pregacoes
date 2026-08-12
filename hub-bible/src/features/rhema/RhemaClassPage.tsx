import { useNavigate, useParams } from 'react-router-dom';
import { DocumentStage } from '../common/DocumentStage';
import { EmptyState, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getAttachment } from '../../core/data/attachments';
import { getDoc } from '../../core/data/documents';
import type { Study } from '../../core/db/types';

/**
 * MODO AULA — a apostila do Rhema em tela cheia, com a Bíblia ao lado.
 *
 * É o Modo Pregação aplicado ao ensino: mesma tela dividida, mesmo cronômetro,
 * mesma tela que não apaga. A Bíblia já abre aberta, porque numa aula o texto
 * é consultado o tempo todo; quem quiser só estudar a apostila fecha o painel
 * num toque.
 */
export default function RhemaClassPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const study = useAsync(
    () => (id ? getDoc<Study>('study', id) : Promise.resolve(undefined)),
    [id],
  );
  const attachment = useAsync(
    () =>
      study.data?.attachmentId
        ? getAttachment(study.data.attachmentId)
        : Promise.resolve(undefined),
    [study.data?.attachmentId],
  );

  if (study.loading || attachment.loading) return <Spinner label="Abrindo a apostila…" />;

  if (!attachment.data) {
    return (
      <div className="preach">
        <div className="preach-stage">
          <EmptyState
            icon="study"
            title="Nada para exibir"
            description="Este item do Rhema não tem apostila anexada. O Modo Aula abre a apostila importada em PDF ou Word."
            action={
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/rhema')}>
                Voltar ao Rhema
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <DocumentStage
      title={study.data?.title ?? ''}
      attachment={attachment.data}
      splitByDefault
    />
  );
}
