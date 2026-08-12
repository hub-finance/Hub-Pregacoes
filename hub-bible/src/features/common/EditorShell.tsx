import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { exportAsMarkdown, exportAsPdf, exportAsText } from '../../core/backup';
import { removeDoc, type DocKind } from '../../core/data/documents';
import { shareText } from '../../core/share/share';

interface Props {
  kind: DocKind;
  title: string;
  backTo: string;
  saving: boolean;
  dirty: boolean;
  docId: string;
  /** Conteúdo exportável em texto puro / markdown. */
  toMarkdown: () => string;
  /** Conteúdo exportável em HTML (impressão / PDF). */
  toHtml: () => string;
  extraActions?: ReactNode;
  children: ReactNode;
}

/** Moldura comum dos editores: status de gravação, exportação e exclusão. */
export function EditorShell({
  kind,
  title,
  backTo,
  saving,
  dirty,
  docId,
  toMarkdown,
  toHtml,
  extraActions,
  children,
}: Props) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [removing, setRemoving] = useState(false);
  const [menu, setMenu] = useState(false);
  const safeName = (title || 'documento').replace(/[^\w\-À-ÿ ]+/g, '').trim() || 'documento';

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(backTo)}>
          ← Voltar
        </button>
        <div className="spacer" />
        <span className="small dim" aria-live="polite">
          {saving ? 'Salvando…' : dirty ? 'Alterações pendentes' : 'Salvo'}
        </span>
        <button className="icon-btn" onClick={() => setMenu((v) => !v)} aria-label="Mais ações">
          …
        </button>
      </div>

      {menu && (
        <div className="card stack" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="row row-wrap">
            {extraActions}
            <button
              className="btn btn-sm"
              onClick={async () => {
                const result = await shareText({ title, text: toMarkdown() });
                notify(result === 'shared' ? 'Compartilhado.' : 'Conteúdo copiado.');
              }}
            >
              Compartilhar
            </button>
            <button className="btn btn-sm" onClick={() => exportAsMarkdown(safeName, toMarkdown())}>
              Markdown
            </button>
            <button className="btn btn-sm" onClick={() => exportAsText(safeName, toMarkdown())}>
              TXT
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                try {
                  exportAsPdf(title, toHtml());
                } catch (err) {
                  notify((err as Error).message, 'error');
                }
              }}
            >
              PDF
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => setRemoving(true)}>
              Excluir
            </button>
          </div>
        </div>
      )}

      {children}

      <ConfirmDialog
        open={removing}
        title="Excluir"
        message={`"${title || 'Sem título'}" será removido deste dispositivo.`}
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          await removeDoc(kind, docId);
          setRemoving(false);
          notify('Excluído.');
          navigate(backTo);
        }}
      />
    </div>
  );
}
