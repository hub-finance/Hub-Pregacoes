import { useNavigate, useParams } from 'react-router-dom';
import { DocumentStage } from './DocumentStage';
import { EmptyState, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getAttachment } from '../../core/data/attachments';
import { getDoc } from '../../core/data/documents';
import type { Devotional, Study } from '../../core/db/types';

/**
 * MODO AULA — o material em tela cheia, com a Bíblia ao lado.
 *
 * É o Modo Pregação aplicado ao ensino: mesma tela dividida, mesmo cronômetro,
 * mesma tela que não apaga. A Bíblia já abre aberta, porque numa aula o texto é
 * consultado o tempo todo; quem quiser só estudar fecha o painel num toque.
 *
 * Serve às duas abas que têm material importado — Rhema e Cursos —, e por isso
 * procura o documento nas duas: o endereço traz só o identificador, e ele é
 * único entre elas.
 */
export default function ClassPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const doc = useAsync(async () => {
    if (!id) return undefined;
    const study = await getDoc<Study>('study', id);
    if (study) return { doc: study, back: '/rhema' };
    const course = await getDoc<Devotional>('devotional', id);
    return course ? { doc: course, back: '/cursos' } : undefined;
  }, [id]);

  const attachment = useAsync(
    () =>
      doc.data?.doc.attachmentId
        ? getAttachment(doc.data.doc.attachmentId)
        : Promise.resolve(undefined),
    [doc.data?.doc.attachmentId],
  );

  if (doc.loading || attachment.loading) return <Spinner label="Abrindo o material…" />;

  if (!attachment.data) {
    return (
      <div className="preach">
        <div className="preach-stage">
          <EmptyState
            icon="study"
            title="Nada para exibir"
            description="Este item não tem material anexado. O Modo Aula abre o arquivo importado em PDF, Word ou apresentação."
            action={
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(doc.data?.back ?? '/rhema')}
              >
                Voltar
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return <DocumentStage title={doc.data?.doc.title ?? ''} attachment={attachment.data} splitByDefault />;
}
