import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { useDocEditor } from '../common/useDocEditor';
import { NotesPanel } from '../common/NotesPanel';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { emptyBlock } from '../../core/data/documents';
import { escapeHtml } from '../../core/backup';
import type { Sermon } from '../../core/db/types';

/**
 * Editor de sermão com a estrutura da seção 14:
 * título · texto principal · introdução · pontos (texto/comentário/aplicação)
 * · conclusão · apelo.
 */
export default function SermonEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { doc, loading, dirty, saving, set } = useDocEditor<Sermon>('sermon', id);

  if (loading) return <Spinner label="Abrindo sermão…" />;
  if (!doc) {
    return (
      <div className="page">
        <p className="muted">Sermão não encontrado.</p>
        <button className="btn" onClick={() => navigate('/sermoes')}>
          Voltar
        </button>
      </div>
    );
  }

  const updateBlock = (blockId: string, patch: Partial<Sermon['blocks'][number]>) =>
    set({ blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) });

  const toMarkdown = () => {
    const lines = [
      `# ${doc.title || 'Sermão sem título'}`,
      doc.theme && `**Tema:** ${doc.theme}`,
      doc.mainText && `**Texto principal:** ${doc.mainText}`,
      doc.date && `**Data:** ${doc.date}`,
      '',
      doc.introduction && `## Introdução\n\n${doc.introduction}`,
      ...doc.blocks.map((b, i) =>
        [
          `## ${i + 1}. ${b.title || 'Ponto'}`,
          b.scripture && `**Texto bíblico:** ${b.scripture}`,
          b.scriptureText && `> ${b.scriptureText}`,
          b.comment && `**Comentário:** ${b.comment}`,
          b.application && `**Aplicação:** ${b.application}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
      doc.conclusion && `## Conclusão\n\n${doc.conclusion}`,
      doc.appeal && `## Apelo\n\n${doc.appeal}`,
      doc.notes && `## Observações\n\n${doc.notes}`,
    ];
    return lines.filter(Boolean).join('\n\n');
  };

  const toHtml = () => {
    const p = (v: string) => `<p>${escapeHtml(v)}</p>`;
    const blocks = doc.blocks
      .map((b, i) =>
        [
          `<h2>${i + 1}. ${escapeHtml(b.title || 'Ponto')}</h2>`,
          b.scriptureText ? `<blockquote>${escapeHtml(b.scriptureText)}<br><small>${escapeHtml(b.scripture)}</small></blockquote>` : b.scripture ? p(b.scripture) : '',
          b.comment ? p(b.comment) : '',
          b.application ? `<p><em>Aplicação:</em> ${escapeHtml(b.application)}</p>` : '',
        ].join(''),
      )
      .join('');
    return [
      `<h1>${escapeHtml(doc.title || 'Sermão')}</h1>`,
      `<div class="meta">${escapeHtml([doc.theme, doc.mainText, doc.date].filter(Boolean).join(' · '))}</div>`,
      doc.introduction ? `<h2>Introdução</h2>${p(doc.introduction)}` : '',
      blocks,
      doc.conclusion ? `<h2>Conclusão</h2>${p(doc.conclusion)}` : '',
      doc.appeal ? `<h2>Apelo</h2>${p(doc.appeal)}` : '',
    ].join('');
  };

  return (
    <EditorShell
      kind="sermon"
      title={doc.title}
      backTo="/sermoes"
      saving={saving}
      dirty={dirty}
      docId={doc.id}
      toMarkdown={toMarkdown}
      toHtml={toHtml}
      extraActions={
        <button className="btn btn-sm btn-primary" onClick={() => navigate(`/pregacao/${doc.id}`)}>
          Modo Pregação
        </button>
      }
    >
      <div className="stack doc-editor">
        <TextInput
          label="Título"
          value={doc.title}
          onChange={(title) => set({ title })}
          placeholder="A videira verdadeira"
        />
        <div className="grid grid-2">
          <TextInput label="Tema" value={doc.theme} onChange={(theme) => set({ theme })} placeholder="Permanência" />
          <SelectInput
            label="Categoria"
            value={doc.category}
            onChange={(category) => set({ category })}
            options={CONTENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div className="grid grid-2">
          <TextInput label="Data" value={doc.date} onChange={(date) => set({ date })} type="date" />
          <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />
        </div>

        <ScriptureField
          label="Texto principal"
          value={doc.mainText}
          onChange={(mainText) => set({ mainText })}
          onResolve={(text) => set({ mainTextContent: text })}
        />

        <TextArea
          label="Introdução"
          value={doc.introduction}
          onChange={(introduction) => set({ introduction })}
          rows={5}
          placeholder="Como você vai conduzir a igreja ao texto?"
        />

        <section className="stack">
          <div className="section-head">
            <h2 className="section-title">Pontos da mensagem</h2>
            <button className="btn btn-sm" onClick={() => set({ blocks: [...doc.blocks, emptyBlock()] })}>
              Adicionar ponto
            </button>
          </div>

          {doc.blocks.map((block, index) => (
            <div key={block.id} className="outline-block">
              <div className="outline-block-head">
                <span className="outline-index">{index + 1}</span>
                <input
                  className="input"
                  value={block.title}
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                  placeholder={`Título do ponto ${index + 1}`}
                />
                <button
                  className="icon-btn"
                  aria-label={`Remover ponto ${index + 1}`}
                  onClick={() => set({ blocks: doc.blocks.filter((b) => b.id !== block.id) })}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
              <ScriptureField
                label="Texto bíblico"
                value={block.scripture}
                onChange={(scripture) => updateBlock(block.id, { scripture })}
                onResolve={(text) => updateBlock(block.id, { scriptureText: text })}
              />
              <TextArea
                label="Comentário"
                value={block.comment}
                onChange={(comment) => updateBlock(block.id, { comment })}
                rows={4}
              />
              <TextArea
                label="Aplicação"
                value={block.application}
                onChange={(application) => updateBlock(block.id, { application })}
                rows={3}
              />
            </div>
          ))}
        </section>

        <TextArea label="Conclusão" value={doc.conclusion} onChange={(conclusion) => set({ conclusion })} rows={4} />
        <TextArea label="Apelo" value={doc.appeal} onChange={(appeal) => set({ appeal })} rows={4} />
        <TextArea label="Observações" value={doc.notes} onChange={(notes) => set({ notes })} rows={3} />

        <NotesPanel parentId={doc.id} targetType="sermon" contextLabel={doc.title || 'Sermão'} />
      </div>
    </EditorShell>
  );
}
