import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
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
  /**
   * O conteúdo tem texto para virar arquivo. Falso no material que só existe
   * como PDF/Word importado — esse já é um arquivo, não há o que formatar.
   */
  exportable?: boolean;
  children: ReactNode;
}

/**
 * O atalho para o Gerar e Exportar, com o nome que cada tela pede: quem
 * termina uma mensagem quer "finalizar e exportar"; quem termina um estudo
 * pode querer transformá-lo em apostila.
 */
const EXPORT_ACTIONS: Record<DocKind, Array<{ label: string; categoria: string; modelo: string }>> = {
  sermon: [{ label: 'Finalizar e exportar', categoria: 'pregacao', modelo: 'mensagem-completa' }],
  devotional: [{ label: 'Gerar Word ou PDF', categoria: 'devocional', modelo: 'diario' }],
  study: [
    { label: 'Exportar estudo', categoria: 'estudo', modelo: 'tematico' },
    { label: 'Transformar em apostila', categoria: 'treinamento', modelo: 'apostila' },
  ],
  doc: [{ label: 'Exportar', categoria: 'institucional', modelo: 'mensagem' }],
};

export const exportLink = (kind: string, id: string, categoria: string, modelo: string) =>
  `/exportar?${new URLSearchParams({ origem: kind, id, categoria, modelo })}`;

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
  exportable = true,
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

      {exportable && (
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          {EXPORT_ACTIONS[kind].map((action) => (
            <button
              key={action.label}
              className="btn btn-sm btn-outline"
              onClick={() => navigate(exportLink(kind, docId, action.categoria, action.modelo))}
            >
              <Icon name="download" size={16} />
              {action.label}
            </button>
          ))}
        </div>
      )}

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
