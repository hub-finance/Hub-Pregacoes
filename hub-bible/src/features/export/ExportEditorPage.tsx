import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmDialog, Spinner } from '../../components/ui';
import { deleteExportDoc, duplicateExportDoc, restoreOriginal } from '../../core/data/exportDocs';
import type { Attachment } from '../../core/db/types';
import { buildRenderDoc } from '../../core/export/model';
import { categoryById, modelById } from '../../core/export/templates';
import { DocumentViewer } from '../common/DocumentViewer';
import { ContentTab } from './ContentTab';
import { ExportPreview } from './ExportPreview';
import { FilesTab } from './FilesTab';
import { LayoutTab } from './LayoutTab';
import { STATUS_LABEL } from './status';
import { useExportDoc } from './useExportDoc';
import '../../styles/export.css';

type Tab = 'conteudo' | 'formatacao' | 'revisar' | 'arquivos';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'formatacao', label: 'Formatação' },
  { id: 'revisar', label: 'Visualizar' },
  { id: 'arquivos', label: 'Aprovar e gerar' },
];

/** Revisão do documento: conteúdo → formatação → visualização → aprovação e arquivos. */
export default function ExportEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS.find((t) => t.id === params.get('aba'))?.id ?? 'conteudo') as Tab;
  const { doc, loading, dirty, saving, error, set, save, replace } = useExportDoc(id);
  const [removing, setRemoving] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ attachment: Attachment; pages?: number } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const render = useMemo(
    () => (doc ? buildRenderDoc({ title: doc.title, content: doc.content, structure: doc.structure, layout: doc.layout }) : null),
    [doc],
  );

  if (loading) return <Spinner label="Abrindo documento…" />;
  if (!doc || !render) {
    return (
      <div className="page">
        <p className="muted">Documento não encontrado.</p>
        <button className="btn" onClick={() => navigate('/exportar')}>
          Voltar
        </button>
      </div>
    );
  }

  const goTab = (next: Tab) => {
    setParams(next === 'conteudo' ? {} : { aba: next }, { replace: true });
    if (next !== 'revisar') setPdfPreview(null);
  };

  /** Gera o PDF da revisão atual só para ver — não guarda nem conta como versão. */
  const previewPdf = async () => {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const [{ buildPdf }, { validateFile }] = await Promise.all([import('../../core/export/pdf'), import('../../core/export/files')]);
      const blob = await buildPdf(render);
      const check = await validateFile(blob, 'pdf');
      if (!check.ok) throw new Error(check.reason);
      setPdfPreview({
        pages: check.pages,
        attachment: {
          id: `preview-${doc.id}`,
          userId: doc.userId,
          docId: doc.id,
          name: `${doc.title}.pdf`,
          mime: 'application/pdf',
          size: blob.size,
          format: 'pdf',
          blob,
          createdAt: Date.now(),
        },
      });
    } catch (err) {
      setPdfError(`Não foi possível montar o PDF: ${(err as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="page page-wide">
      <div className="row row-wrap" style={{ marginBottom: 'var(--sp-3)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/exportar')}>
          ← Documentos
        </button>
        <span className="spacer" />
        <span className="small dim" aria-live="polite">
          {error ? <span className="xp-error">Não foi possível salvar: {error}</span> : saving ? 'Salvando…' : dirty ? 'Alterações pendentes' : 'Rascunho salvo'}
        </span>
        <button
          className="btn btn-sm"
          onClick={async () => {
            await save();
            notify('Rascunho salvo.');
          }}
        >
          Salvar rascunho
        </button>
      </div>

      <header className="stack" style={{ gap: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
          <span className={`xp-status ${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
          {doc.approvedVersion ? <span className="badge">versão aprovada: v{doc.approvedVersion}</span> : null}
          <span className="small dim">
            {categoryById(doc.category).label} · {modelById(doc.category, doc.model).label}
          </span>
        </div>
        <h1 className="page-title" style={{ overflowWrap: 'anywhere' }}>
          {doc.title || 'Documento sem título'}
        </h1>
      </header>

      <div className="tabs" role="tablist" style={{ marginBottom: 'var(--sp-4)' }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => goTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'conteudo' && (
        <ContentTab
          doc={doc}
          set={set}
          onRestoreOriginal={async () => {
            await save();
            replace(await restoreOriginal(doc.id));
            notify('Texto original restaurado.');
          }}
        />
      )}

      {tab === 'formatacao' && <LayoutTab doc={doc} set={set} />}

      {tab === 'revisar' && (
        <div className="stack">
          <div className="notice">
            <Icon name="info" size={18} />
            <span>
              Visualização da revisão atual, com as fontes, cores e proporções do arquivo. Para ver página por página
              exatamente como sairá, gere o PDF de conferência.
            </span>
          </div>
          <div className="row row-wrap">
            <button className="btn btn-primary btn-sm" onClick={previewPdf} disabled={pdfBusy}>
              {pdfBusy ? 'Montando o PDF…' : pdfPreview ? 'Atualizar o PDF de conferência' : 'Ver o PDF de conferência'}
            </button>
            {pdfPreview && (
              <button className="btn btn-sm" onClick={() => setPdfPreview(null)}>
                Voltar à visualização rápida
              </button>
            )}
            {pdfPreview?.pages ? <span className="small dim">{pdfPreview.pages} página(s)</span> : null}
          </div>
          {pdfError && (
            <p className="small xp-error" role="alert">
              {pdfError}
            </p>
          )}
          {pdfPreview ? <DocumentViewer attachment={pdfPreview.attachment} trim={false} /> : <ExportPreview doc={render} />}
          <div>
            <button className="btn btn-primary" onClick={() => goTab('arquivos')}>
              Seguir para aprovar e gerar →
            </button>
          </div>
        </div>
      )}

      {tab === 'arquivos' && <FilesTab doc={doc} flush={save} replace={replace} />}

      <div className="row row-wrap" style={{ marginTop: 'var(--sp-6)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
        <button
          className="btn btn-sm"
          onClick={async () => {
            await save();
            const copy = await duplicateExportDoc(doc.id);
            notify('Cópia criada como novo documento.');
            navigate(`/exportar/${copy.id}`);
          }}
        >
          Duplicar como novo documento
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => setRemoving(true)}>
          Excluir documento
        </button>
      </div>

      <ConfirmDialog
        open={removing}
        title="Excluir documento"
        message={`"${doc.title}" será removido deste aparelho, com todas as versões e arquivos gerados. O conteúdo de origem não é tocado.`}
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          await deleteExportDoc(doc.id);
          setRemoving(false);
          notify('Documento excluído.');
          navigate('/exportar');
        }}
      />
    </div>
  );
}
