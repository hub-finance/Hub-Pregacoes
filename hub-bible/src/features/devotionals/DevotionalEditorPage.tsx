import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { NotesPanel } from '../common/NotesPanel';
import { useDocEditor } from '../common/useDocEditor';
import { ShareSheet } from '../share/ShareSheet';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import type { Devotional } from '../../core/db/types';

/** Editor de devocional: texto bíblico, reflexão, aplicação e oração. */
export default function DevotionalEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, loading, dirty, saving, set } = useDocEditor<Devotional>('devotional', id);
  const [sharing, setSharing] = useState(false);

  if (loading) return <Spinner label="Abrindo devocional…" />;
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Devocional não encontrado.</p>
        <button className="btn" onClick={() => navigate('/devocionais')}>
          Voltar
        </button>
      </div>
    );
  }

  const toMarkdown = () =>
    [
      `# ${doc.title || 'Devocional'}`,
      doc.date && `**Data:** ${doc.date}`,
      doc.scripture && `**Texto:** ${doc.scripture}`,
      doc.scriptureText && `> ${doc.scriptureText}`,
      doc.reflection && `## Reflexão\n\n${doc.reflection}`,
      doc.application && `## Aplicação\n\n${doc.application}`,
      doc.prayer && `## Oração\n\n${doc.prayer}`,
      doc.notes && `## Anotações\n\n${doc.notes}`,
    ]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () => {
    const p = (v: string) => `<p>${escapeHtml(v)}</p>`;
    return [
      `<h1>${escapeHtml(doc.title || 'Devocional')}</h1>`,
      `<div class="meta">${escapeHtml([doc.date, doc.scripture].filter(Boolean).join(' · '))}</div>`,
      doc.scriptureText ? `<blockquote>${escapeHtml(doc.scriptureText)}</blockquote>` : '',
      doc.reflection ? `<h2>Reflexão</h2>${p(doc.reflection)}` : '',
      doc.application ? `<h2>Aplicação</h2>${p(doc.application)}` : '',
      doc.prayer ? `<h2>Oração</h2>${p(doc.prayer)}` : '',
    ].join('');
  };

  return (
    <EditorShell
      kind="devotional"
      title={doc.title}
      backTo="/devocionais"
      saving={saving}
      dirty={dirty}
      docId={doc.id}
      toMarkdown={toMarkdown}
      toHtml={toHtml}
      extraActions={
        <button className="btn btn-sm" onClick={() => setSharing(true)} disabled={!doc.scriptureText}>
          🖼️ Imagem do texto
        </button>
      }
    >
      <div className="stack doc-editor">
        <TextInput label="Título" value={doc.title} onChange={(title) => set({ title })} />
        <div className="grid grid-2">
          <TextInput label="Data" value={doc.date} onChange={(date) => set({ date })} type="date" />
          <SelectInput
            label="Categoria"
            value={doc.category}
            onChange={(category) => set({ category })}
            options={CONTENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <ScriptureField
          label="Texto bíblico"
          value={doc.scripture}
          onChange={(scripture) => set({ scripture })}
          onResolve={(text) => set({ scriptureText: text })}
        />
        <TextArea label="Reflexão" value={doc.reflection} onChange={(reflection) => set({ reflection })} rows={7} />
        <TextArea label="Aplicação" value={doc.application} onChange={(application) => set({ application })} rows={4} />
        <TextArea label="Oração" value={doc.prayer} onChange={(prayer) => set({ prayer })} rows={4} />
        <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />

        <NotesPanel parentId={doc.id} targetType="devotional" contextLabel={doc.title || 'Devocional'} />
      </div>

      {doc.scriptureText && (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          reference={doc.scripture}
          text={doc.scriptureText}
          title="Compartilhar devocional"
        />
      )}
    </EditorShell>
  );
}
