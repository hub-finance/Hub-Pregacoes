import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { NotesPanel } from '../common/NotesPanel';
import { useDocEditor } from '../common/useDocEditor';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import { formatReference, parseReference } from '../../core/bible/reference';
import type { Study } from '../../core/db/types';

/** Editor de estudo bíblico com vários versículos vinculados. */
export default function StudyEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, loading, dirty, saving, set } = useDocEditor<Study>('study', id);
  const [verseDraft, setVerseDraft] = useState('');

  if (loading) return <Spinner label="Abrindo estudo…" />;
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Estudo não encontrado.</p>
        <button className="btn" onClick={() => navigate('/estudos')}>
          Voltar
        </button>
      </div>
    );
  }

  const addVerse = () => {
    const parsed = parseReference(verseDraft);
    if (!parsed) return;
    const reference = formatReference(parsed);
    if (!doc.relatedVerses.includes(reference)) {
      set({ relatedVerses: [...doc.relatedVerses, reference] });
    }
    setVerseDraft('');
  };

  const toMarkdown = () =>
    [
      `# ${doc.title || 'Estudo sem título'}`,
      doc.theme && `**Tema:** ${doc.theme}`,
      doc.mainText && `**Texto principal:** ${doc.mainText}`,
      doc.introduction && `## Introdução\n\n${doc.introduction}`,
      doc.development && `## Desenvolvimento\n\n${doc.development}`,
      doc.relatedVerses.length && `## Versículos relacionados\n\n${doc.relatedVerses.map((v) => `- ${v}`).join('\n')}`,
      doc.comments && `## Comentários\n\n${doc.comments}`,
      doc.application && `## Aplicações\n\n${doc.application}`,
      doc.conclusion && `## Conclusão\n\n${doc.conclusion}`,
      doc.notes && `## Anotações\n\n${doc.notes}`,
    ]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () => {
    const p = (v: string) => `<p>${escapeHtml(v)}</p>`;
    return [
      `<h1>${escapeHtml(doc.title || 'Estudo')}</h1>`,
      `<div class="meta">${escapeHtml([doc.theme, doc.mainText].filter(Boolean).join(' · '))}</div>`,
      doc.introduction ? `<h2>Introdução</h2>${p(doc.introduction)}` : '',
      doc.development ? `<h2>Desenvolvimento</h2>${p(doc.development)}` : '',
      doc.relatedVerses.length
        ? `<h2>Versículos relacionados</h2><p>${doc.relatedVerses.map(escapeHtml).join(' · ')}</p>`
        : '',
      doc.comments ? `<h2>Comentários</h2>${p(doc.comments)}` : '',
      doc.application ? `<h2>Aplicações</h2>${p(doc.application)}` : '',
      doc.conclusion ? `<h2>Conclusão</h2>${p(doc.conclusion)}` : '',
    ].join('');
  };

  return (
    <EditorShell
      kind="study"
      title={doc.title}
      backTo="/estudos"
      saving={saving}
      dirty={dirty}
      docId={doc.id}
      toMarkdown={toMarkdown}
      toHtml={toHtml}
    >
      <div className="stack doc-editor">
        <TextInput label="Título" value={doc.title} onChange={(title) => set({ title })} />
        <div className="grid grid-2">
          <TextInput label="Tema" value={doc.theme} onChange={(theme) => set({ theme })} />
          <SelectInput
            label="Categoria"
            value={doc.category}
            onChange={(category) => set({ category })}
            options={CONTENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <ScriptureField label="Texto principal" value={doc.mainText} onChange={(mainText) => set({ mainText })} />
        <TextArea label="Introdução" value={doc.introduction} onChange={(introduction) => set({ introduction })} rows={4} />
        <TextArea label="Desenvolvimento" value={doc.development} onChange={(development) => set({ development })} rows={8} />

        <section className="stack">
          <div className="section-head">
            <h2 className="section-title">Versículos relacionados</h2>
          </div>
          <div className="row">
            <input
              className="input"
              value={verseDraft}
              onChange={(e) => setVerseDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVerse()}
              placeholder="Ex.: Efésios 2:8"
              aria-label="Adicionar versículo relacionado"
            />
            <button className="btn" onClick={addVerse}>
              Adicionar
            </button>
          </div>
          <div className="row row-wrap">
            {doc.relatedVerses.map((reference) => {
              const parsed = parseReference(reference);
              return (
                <span key={reference} className="chip">
                  <button
                    onClick={() =>
                      parsed && navigate(`/biblia/${parsed.book}/${parsed.chapter}?v=${parsed.verse ?? 1}`)
                    }
                    style={{ color: 'inherit' }}
                  >
                    {reference}
                  </button>
                  <button
                    aria-label={`Remover ${reference}`}
                    onClick={() => set({ relatedVerses: doc.relatedVerses.filter((v) => v !== reference) })}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            {!doc.relatedVerses.length && <span className="small dim">Nenhum versículo vinculado ainda.</span>}
          </div>
        </section>

        <TextArea label="Comentários" value={doc.comments} onChange={(comments) => set({ comments })} rows={5} />
        <TextArea label="Aplicações" value={doc.application} onChange={(application) => set({ application })} rows={4} />
        <TextArea label="Conclusão" value={doc.conclusion} onChange={(conclusion) => set({ conclusion })} rows={4} />
        <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />

        <NotesPanel parentId={doc.id} targetType="study" contextLabel={doc.title || 'Estudo'} />
      </div>
    </EditorShell>
  );
}
