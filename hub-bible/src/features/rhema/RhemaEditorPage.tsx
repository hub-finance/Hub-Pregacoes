import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { useNavigate, useParams } from 'react-router-dom';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { DocumentViewer } from '../common/DocumentViewer';
import { useDocEditor } from '../common/useDocEditor';
import { useAsync } from '../../hooks';
import { getAttachment } from '../../core/data/attachments';
import { SelectInput, Spinner, TagInput, TextInput } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import {
  SECTION_KINDS,
  SECTION_LABEL,
  filledSections,
  newSection,
  sectionTitle,
  sectionsOf,
} from '../../core/data/studySections';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import { formatReference, parseReference } from '../../core/bible/reference';
import type { Study, StudySection, StudySectionKind } from '../../core/db/types';

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
  const [addingSection, setAddingSection] = useState(false);
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

  /* As seções do corpo. Estudos escritos antes desta mudança são convertidos na
     leitura por `sectionsOf`; a primeira edição grava a lista, e os campos
     antigos ficam onde estão — nada do que já foi escrito se perde. */
  const sections = sectionsOf(doc);
  const setSections = (next: StudySection[]) => set({ sections: next });

  const addSection = (kind: StudySectionKind) => {
    setSections([...sections, newSection(kind)]);
    setAddingSection(false);
  };

  const editSection = (sectionId: string, patch: Partial<StudySection>) =>
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));

  const removeSection = (sectionId: string) =>
    setSections(sections.filter((s) => s.id !== sectionId));

  /** Sobe ou desce a seção. `delta` é -1 ou 1. */
  const moveSection = (index: number, delta: number) => {
    const alvo = index + delta;
    if (alvo < 0 || alvo >= sections.length) return;
    const next = [...sections];
    [next[index], next[alvo]] = [next[alvo], next[index]];
    setSections(next);
  };

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
      ...filledSections(doc).map((s) =>
        s.kind === 'texto'
          ? `**Texto principal:** ${s.text}`
          : `## ${sectionTitle(s)}\n\n${s.text}`,
      ),
      doc.relatedVerses.length && `## Versículos relacionados\n\n${doc.relatedVerses.map((v) => `- ${v}`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () => {
    const p = (v: string) => `<p>${escapeHtml(v)}</p>`;
    return [
      `<h1>${escapeHtml(doc.title || 'Rhema')}</h1>`,
      `<div class="meta">${escapeHtml(doc.theme)}</div>`,
      ...filledSections(doc).map((s) =>
        s.kind === 'texto'
          ? `<div class="meta">${escapeHtml(s.text)}</div>`
          : `<h2>${escapeHtml(sectionTitle(s))}</h2>${p(s.text)}`,
      ),
      doc.relatedVerses.length
        ? `<h2>Versículos relacionados</h2><p>${doc.relatedVerses.map(escapeHtml).join(' · ')}</p>`
        : '',
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

        {/* O corpo do estudo, num painel só. Antes eram campos fixos sempre na
            tela, vazios ou não; agora o autor acrescenta a seção que precisa,
            na ordem que precisa, quantas vezes precisar. */}
        <section className="stack study-body">
          {sections.map((section, index) => (
            <article key={section.id} className="study-section">
              <header className="study-section-head">
                {section.kind === 'livre' ? (
                  <input
                    className="study-section-title"
                    value={section.title ?? ''}
                    onChange={(e) => editSection(section.id, { title: e.target.value })}
                    placeholder="Título da seção"
                    aria-label="Título da seção"
                  />
                ) : (
                  <h2 className="study-section-title">{SECTION_LABEL[section.kind]}</h2>
                )}
                <div className="spacer" />
                <button
                  className="icon-btn"
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  aria-label={`Subir ${sectionTitle(section)}`}
                >
                  <Icon name="arrow-up" size={17} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === sections.length - 1}
                  aria-label={`Descer ${sectionTitle(section)}`}
                >
                  <Icon name="arrow-down" size={17} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => removeSection(section.id)}
                  aria-label={`Excluir ${sectionTitle(section)}`}
                >
                  <Icon name="close" size={17} />
                </button>
              </header>

              {section.kind === 'texto' ? (
                /* referência bíblica: o texto vem do próprio aplicativo, e
                   nunca é digitado pelo sistema */
                <ScriptureField
                  label=""
                  value={section.text}
                  onChange={(text) => editSection(section.id, { text })}
                />
              ) : (
                <textarea
                  className="textarea"
                  value={section.text}
                  onChange={(e) => editSection(section.id, { text: e.target.value })}
                  rows={section.kind === 'desenvolvimento' ? 10 : 5}
                  placeholder="Escreva aqui…"
                  aria-label={sectionTitle(section)}
                />
              )}
            </article>
          ))}

          <button className="btn btn-outline study-add" onClick={() => setAddingSection(true)}>
            <Icon name="plus" size={18} />
            Acrescentar seção
          </button>
        </section>

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

        <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />
      </div>

      {/* O "+" pergunta qual seção antes de criá-la: é a escolha que dá a este
          editor a forma do estudo, e ela não cabe num botão só. */}
      <Sheet open={addingSection} title="Acrescentar seção" onClose={() => setAddingSection(false)}>
        <div className="list">
          {SECTION_KINDS.map((kind) => (
            <button key={kind} className="list-item" onClick={() => addSection(kind)}>
              <Icon name={kind === 'texto' ? 'book' : 'note'} size={20} />
              <span className="list-body">
                <span className="list-title">{SECTION_LABEL[kind]}</span>
                {kind === 'texto' && (
                  <span className="list-meta">O texto bíblico vem do próprio aplicativo.</span>
                )}
                {kind === 'livre' && (
                  <span className="list-meta">Com o título que você escolher.</span>
                )}
              </span>
              <Icon name="chevron-right" size={18} className="dim" />
            </button>
          ))}
        </div>
      </Sheet>
    </EditorShell>
  );
}
