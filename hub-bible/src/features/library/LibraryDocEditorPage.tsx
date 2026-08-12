import { useNavigate, useParams } from 'react-router-dom';
import { EditorShell } from '../common/EditorShell';
import { useDocEditor } from '../common/useDocEditor';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { LIBRARY_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import type { LibraryDoc } from '../../core/db/types';

/** Material livre da Biblioteca Ministerial (liderança, GC, discipulado…). */
export default function LibraryDocEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, loading, dirty, saving, set } = useDocEditor<LibraryDoc>('doc', id);

  if (loading) return <Spinner label="Abrindo material…" />;
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Material não encontrado.</p>
        <button className="btn" onClick={() => navigate('/biblioteca')}>
          Voltar
        </button>
      </div>
    );
  }

  const toMarkdown = () =>
    [`# ${doc.title || 'Material'}`, doc.summary && `_${doc.summary}_`, doc.content]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () =>
    [
      `<h1>${escapeHtml(doc.title || 'Material')}</h1>`,
      `<div class="meta">${escapeHtml(doc.category)}</div>`,
      doc.summary ? `<p><em>${escapeHtml(doc.summary)}</em></p>` : '',
      `<p>${escapeHtml(doc.content)}</p>`,
    ].join('');

  return (
    <EditorShell
      kind="doc"
      title={doc.title}
      backTo="/biblioteca"
      saving={saving}
      dirty={dirty}
      docId={doc.id}
      toMarkdown={toMarkdown}
      toHtml={toHtml}
    >
      <div className="stack doc-editor">
        <TextInput label="Título" value={doc.title} onChange={(title) => set({ title })} />
        <SelectInput
          label="Categoria"
          value={doc.category}
          onChange={(category) => set({ category })}
          options={LIBRARY_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <TextInput label="Resumo" value={doc.summary} onChange={(summary) => set({ summary })} />
        <TextArea label="Conteúdo" value={doc.content} onChange={(content) => set({ content })} rows={16} />
        <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />
      </div>
    </EditorShell>
  );
}
