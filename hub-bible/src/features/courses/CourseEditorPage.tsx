import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { NotesPanel } from '../common/NotesPanel';
import { DocumentViewer } from '../common/DocumentViewer';
import { useDocEditor } from '../common/useDocEditor';
import { useAsync } from '../../hooks';
import { getAttachment } from '../../core/data/attachments';
import { ShareSheet } from '../share/ShareSheet';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import type { Devotional } from '../../core/db/types';

/**
 * Curso — o material da aula.
 *
 * Quando há arquivo importado, ele é o conteúdo: os campos de escrita saem da
 * frente e ficam as suas observações, as etiquetas e as anotações. Sem arquivo,
 * a tela continua sendo a de sempre (texto bíblico, reflexão, aplicação,
 * oração), para que os devocionais já escritos continuem abrindo do mesmo jeito.
 */
export default function CourseEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, loading, dirty, saving, set } = useDocEditor<Devotional>('devotional', id);
  const [sharing, setSharing] = useState(false);
  const attachment = useAsync(
    () => (doc?.attachmentId ? getAttachment(doc.attachmentId) : Promise.resolve(undefined)),
    [doc?.attachmentId],
  );

  if (loading) return <Spinner label="Abrindo…" />;
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Curso não encontrado.</p>
        <button className="btn" onClick={() => navigate('/cursos')}>
          Voltar
        </button>
      </div>
    );
  }

  const imported = !!doc.attachmentId;

  const toMarkdown = () =>
    [
      `# ${doc.title || 'Curso'}`,
      imported && '_Material importado — o conteúdo está no arquivo original._',
      doc.date && `**Data:** ${doc.date}`,
      doc.scripture && `**Texto:** ${doc.scripture}`,
      doc.scriptureText && `> ${doc.scriptureText}`,
      doc.reflection && `## ${imported ? 'Observações' : 'Reflexão'}\n\n${doc.reflection}`,
      doc.application && `## Aplicação\n\n${doc.application}`,
      doc.prayer && `## Oração\n\n${doc.prayer}`,
      doc.notes && `## Anotações\n\n${doc.notes}`,
    ]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () => {
    const p = (v: string) => `<p>${escapeHtml(v)}</p>`;
    return [
      `<h1>${escapeHtml(doc.title || 'Curso')}</h1>`,
      `<div class="meta">${escapeHtml([doc.date, doc.scripture].filter(Boolean).join(' · '))}</div>`,
      doc.scriptureText ? `<blockquote class="s-scripture">${escapeHtml(doc.scriptureText)}</blockquote>` : '',
      doc.reflection ? `<h2>${imported ? 'Observações' : 'Reflexão'}</h2>${p(doc.reflection)}` : '',
      doc.application ? `<h2>Aplicação</h2>${p(doc.application)}` : '',
      doc.prayer ? `<h2>Oração</h2>${p(doc.prayer)}` : '',
    ].join('');
  };

  return (
    <EditorShell
      kind="devotional"
      title={doc.title}
      backTo="/cursos"
      saving={saving}
      dirty={dirty}
      docId={doc.id}
      toMarkdown={toMarkdown}
      toHtml={toHtml}
      extraActions={
        imported ? (
          <button className="btn btn-sm btn-primary" onClick={() => navigate(`/aula/${doc.id}`)}>
            Modo Aula
          </button>
        ) : (
          <button className="btn btn-sm" onClick={() => setSharing(true)} disabled={!doc.scriptureText}>
            Imagem do texto
          </button>
        )
      }
    >
      <div className="stack doc-editor">
        <TextInput label="Título" value={doc.title} onChange={(title) => set({ title })} />

        {/* Material importado: aparece como veio, e é dele que se ensina. */}
        {imported && (
          <section className="stack">
            <div className="row row-wrap">
              <button className="btn btn-primary" onClick={() => navigate(`/aula/${doc.id}`)}>
                <Icon name="preach" size={17} /> Modo Aula — Bíblia ao lado
              </button>
            </div>
            {attachment.loading && <p className="small dim">Carregando o material…</p>}
            {attachment.data && <DocumentViewer attachment={attachment.data} />}
            {!attachment.loading && !attachment.data && (
              <div className="notice">
                <Icon name="warning" size={20} style={{ flex: 'none' }} />
                <span>O arquivo deste curso não foi encontrado no aparelho.</span>
              </div>
            )}
          </section>
        )}

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
        <TextArea
          label={imported ? 'Suas observações sobre o material' : 'Reflexão'}
          value={doc.reflection}
          onChange={(reflection) => set({ reflection })}
          rows={imported ? 5 : 7}
        />
        {!imported && (
          <>
            <TextArea label="Aplicação" value={doc.application} onChange={(application) => set({ application })} rows={4} />
            <TextArea label="Oração" value={doc.prayer} onChange={(prayer) => set({ prayer })} rows={4} />
          </>
        )}
        <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />

        <NotesPanel parentId={doc.id} targetType="devotional" contextLabel={doc.title || 'Curso'} />
      </div>

      {doc.scriptureText && (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          reference={doc.scripture}
          text={doc.scriptureText}
          title="Compartilhar texto"
        />
      )}
    </EditorShell>
  );
}
