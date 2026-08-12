import { useNavigate, useParams } from 'react-router-dom';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { useDocEditor } from '../common/useDocEditor';
import { NotesPanel } from '../common/NotesPanel';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import type { Sermon } from '../../core/db/types';

/**
 * Editor de sermão.
 *
 * Estrutura enxuta, a pedido: título · introdução · desenvolvimento ·
 * conclusão · aplicação. Sermões criados no formato antigo, em blocos de
 * tópico, continuam acessíveis e podem ser juntados ao desenvolvimento.
 */
export default function SermonEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
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

  const legacyBlocks = (doc.blocks ?? []).filter(
    (b) => b.title || b.comment || b.application || b.scripture,
  );
  const hasLegacy = legacyBlocks.length > 0 || !!doc.appeal?.trim();

  const mergeLegacy = () => {
    const parts = legacyBlocks.map((b, i) =>
      [
        `${i + 1}. ${b.title || 'Ponto'}`,
        b.scripture && `Texto: ${b.scripture}`,
        b.comment,
        b.application && `Aplicação: ${b.application}`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    set({
      development: [doc.development, ...parts].filter(Boolean).join('\n\n'),
      application: [doc.application, doc.appeal].filter(Boolean).join('\n\n'),
      blocks: [],
      appeal: '',
    });
    notify('Conteúdo antigo juntado ao desenvolvimento.');
  };

  const toMarkdown = () =>
    [
      `# ${doc.title || 'Sermão sem título'}`,
      doc.theme && `**Tema:** ${doc.theme}`,
      doc.mainText && `**Texto principal:** ${doc.mainText}`,
      doc.date && `**Data:** ${doc.date}`,
      doc.introduction && `## Introdução\n\n${doc.introduction}`,
      doc.development && `## Desenvolvimento\n\n${doc.development}`,
      doc.conclusion && `## Conclusão\n\n${doc.conclusion}`,
      doc.application && `## Aplicação\n\n${doc.application}`,
      doc.notes && `## Observações\n\n${doc.notes}`,
    ]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () => {
    const p = (v: string) => `<p>${escapeHtml(v)}</p>`;
    return [
      `<h1>${escapeHtml(doc.title || 'Sermão')}</h1>`,
      `<div class="meta">${escapeHtml([doc.theme, doc.mainText, doc.date].filter(Boolean).join(' · '))}</div>`,
      doc.mainTextContent ? `<blockquote>${escapeHtml(doc.mainTextContent)}</blockquote>` : '',
      doc.introduction ? `<h2>Introdução</h2>${p(doc.introduction)}` : '',
      doc.development ? `<h2>Desenvolvimento</h2>${p(doc.development)}` : '',
      doc.conclusion ? `<h2>Conclusão</h2>${p(doc.conclusion)}` : '',
      doc.application ? `<h2>Aplicação</h2>${p(doc.application)}` : '',
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
          rows={6}
          placeholder="Como você vai conduzir a igreja ao texto?"
        />
        <TextArea
          label="Desenvolvimento"
          value={doc.development}
          onChange={(development) => set({ development })}
          rows={16}
          placeholder="O corpo da mensagem — os pontos, o texto, os comentários."
        />
        <TextArea
          label="Conclusão"
          value={doc.conclusion}
          onChange={(conclusion) => set({ conclusion })}
          rows={6}
        />
        <TextArea
          label="Aplicação"
          value={doc.application}
          onChange={(application) => set({ application })}
          rows={6}
          placeholder="O que a igreja leva para a semana?"
        />

        {hasLegacy && (
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Conteúdo do formato anterior ({legacyBlocks.length} ponto(s))
            </summary>
            <div className="stack" style={{ marginTop: 'var(--sp-3)' }}>
              <p className="small muted">
                Este sermão foi escrito na estrutura antiga, em blocos. Nada foi perdido — junte
                tudo ao desenvolvimento quando quiser.
              </p>
              {legacyBlocks.map((b, i) => (
                <div key={b.id} className="notice" style={{ display: 'block' }}>
                  <strong>
                    {i + 1}. {b.title || 'Ponto'}
                  </strong>
                  {b.scripture && <p className="small dim">{b.scripture}</p>}
                  {b.comment && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{b.comment}</p>}
                  {b.application && (
                    <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
                      <em>Aplicação:</em> {b.application}
                    </p>
                  )}
                </div>
              ))}
              {doc.appeal && (
                <div className="notice" style={{ display: 'block' }}>
                  <strong>Apelo</strong>
                  <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{doc.appeal}</p>
                </div>
              )}
              <button className="btn btn-sm" onClick={mergeLegacy}>
                Juntar ao desenvolvimento
              </button>
            </div>
          </details>
        )}

        <div className="grid grid-2">
          <TextInput label="Data" value={doc.date} onChange={(date) => set({ date })} type="date" />
          <TagInput label="Etiquetas" tags={doc.tags} onChange={(tags) => set({ tags })} />
        </div>
        <TextArea label="Observações" value={doc.notes} onChange={(notes) => set({ notes })} rows={3} />

        <NotesPanel parentId={doc.id} targetType="sermon" contextLabel={doc.title || 'Sermão'} />
      </div>
    </EditorShell>
  );
}
