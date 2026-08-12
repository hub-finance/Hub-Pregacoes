import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { NotesPanel } from '../common/NotesPanel';
import { DocumentViewer } from '../common/DocumentViewer';
import { useDocEditor } from '../common/useDocEditor';
import { useAsync } from '../../hooks';
import { getAttachment } from '../../core/data/attachments';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import { formatReference, parseReference } from '../../core/bible/reference';
import type { Study } from '../../core/db/types';

/**
 * Rhema — o estudo escrito no aplicativo ou a apostila importada em PDF.
 *
 * Quando há apostila, os campos de redação dão lugar a ela: o material já veio
 * pronto do Rhema Brasil e reescrevê-lo seria trabalho perdido. O que continua
 * valendo são as anotações, as etiquetas e os versículos vinculados — o que o
 * aluno acrescenta ao material, e não o material em si.
 */
export default function RhemaEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, loading, dirty, saving, set } = useDocEditor<Study>('study', id);
  const [verseDraft, setVerseDraft] = useState('');
  const attachment = useAsync(
    () => (doc?.attachmentId ? getAttachment(doc.attachmentId) : Promise.resolve(undefined)),
    [doc?.attachmentId],
  );

  if (loading) return <Spinner label="Abrindo…" />;
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Item do Rhema não encontrado.</p>
        <button className="btn" onClick={() => navigate('/rhema')}>
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
      `# ${doc.title || 'Rhema sem título'}`,
      doc.attachmentId && '_Apostila importada — o conteúdo está no arquivo original._',
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
      `<h1>${escapeHtml(doc.title || 'Rhema')}</h1>`,
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
      backTo="/rhema"
      saving={saving}
      dirty={dirty}
      docId={doc.id}
      toMarkdown={toMarkdown}
      toHtml={toHtml}
      extraActions={
        doc.attachmentId ? (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => navigate(`/aula/${doc.id}`)}
          >
            Modo Aula
          </button>
        ) : undefined
      }
    >
      <div className="stack doc-editor">
        <TextInput label="Título" value={doc.title} onChange={(title) => set({ title })} />

        {/* Apostila importada: aparece como veio, e é dela que se ensina. */}
        {doc.attachmentId && (
          <section className="stack">
            <div className="row row-wrap">
              <button className="btn btn-primary" onClick={() => navigate(`/aula/${doc.id}`)}>
                <Icon name="preach" size={17} /> Modo Aula — Bíblia ao lado
              </button>
            </div>
            {attachment.loading && <p className="small dim">Carregando a apostila…</p>}
            {attachment.data && <DocumentViewer attachment={attachment.data} />}
            {!attachment.loading && !attachment.data && (
              <div className="notice">
                <Icon name="warning" size={20} style={{ flex: 'none' }} />
                <span>O arquivo desta apostila não foi encontrado no aparelho.</span>
              </div>
            )}
          </section>
        )}

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
        {!doc.attachmentId && (
          <>
            <TextArea label="Introdução" value={doc.introduction} onChange={(introduction) => set({ introduction })} rows={4} />
            <TextArea label="Desenvolvimento" value={doc.development} onChange={(development) => set({ development })} rows={8} />
          </>
        )}

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
                    <Icon name="close" size={14} />
                  </button>
                </span>
              );
            })}
            {!doc.relatedVerses.length && <span className="small dim">Nenhum versículo vinculado ainda.</span>}
          </div>
        </section>

        <TextArea
          label={doc.attachmentId ? 'Suas observações sobre a apostila' : 'Comentários'}
          value={doc.comments}
          onChange={(comments) => set({ comments })}
          rows={5}
        />
        {!doc.attachmentId && (
          <>
            <TextArea label="Aplicações" value={doc.application} onChange={(application) => set({ application })} rows={4} />
            <TextArea label="Conclusão" value={doc.conclusion} onChange={(conclusion) => set({ conclusion })} rows={4} />
          </>
        )}
        <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />

        <NotesPanel parentId={doc.id} targetType="study" contextLabel={doc.title || 'Rhema'} />
      </div>
    </EditorShell>
  );
}
