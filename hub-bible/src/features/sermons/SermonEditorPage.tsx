import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks';
import { DocumentViewer } from '../common/DocumentViewer';
import { getAttachment } from '../../core/data/attachments';
import { EditorShell } from '../common/EditorShell';
import { ScriptureField } from '../common/ScriptureField';
import { SermonBlocksEditor } from './SermonBlocksEditor';
import { useDocEditor } from '../common/useDocEditor';
import { NotesPanel } from '../common/NotesPanel';
import { SelectInput, Spinner, TagInput, TextArea, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { Icon } from '../../components/Icon';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { escapeHtml } from '../../core/backup';
import {
  blocksFromSermon,
  blocksToHtml,
  blocksToMarkdown,
  newBlock,
} from '../../core/data/sermonContent';
import type { Sermon, SermonBlock } from '../../core/db/types';

/**
 * Editor de sermão.
 *
 * O sermão escrito aqui é montado em blocos — seção, parágrafo, destaque,
 * citação bíblica e lista — com formatação dentro de cada um, para chegar perto
 * do que se faz no Word. Sermões antigos, escritos nos quatro campos de texto
 * corrido, são convertidos em blocos na primeira abertura, sem perder nada.
 * Sermão importado em PDF ou Word não é editado: aparece como veio.
 */
export default function SermonEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { doc, loading, dirty, saving, set } = useDocEditor<Sermon>('sermon', id);
  const attachment = useAsync(
    () => (doc?.attachmentId ? getAttachment(doc.attachmentId) : Promise.resolve(undefined)),
    [doc?.attachmentId],
  );

  // conversão do formato antigo: os quatro campos viram blocos e são esvaziados,
  // porque o mesmo texto passa a viver em `content` — mantê-los duplicaria o
  // sermão na busca e deixaria sobras ao editar
  const needsSeed = !!doc && !doc.attachmentId && !doc.content;
  useEffect(() => {
    if (!doc || !needsSeed) return;
    set({
      content: blocksFromSermon(doc),
      introduction: '',
      development: '',
      conclusion: '',
      application: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, needsSeed]);

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

  const content = doc.content ?? [];

  const legacyBlocks = (doc.blocks ?? []).filter(
    (b) => b.title || b.comment || b.application || b.scripture,
  );
  const hasLegacy = legacyBlocks.length > 0 || !!doc.appeal?.trim();

  /** Traz o conteúdo do formato em tópicos para o fim do sermão, como blocos. */
  const mergeLegacy = () => {
    const converted: SermonBlock[] = [];
    legacyBlocks.forEach((b, i) => {
      converted.push(newBlock('section', escapeHtml(`${i + 1}. ${b.title || 'Ponto'}`)));
      if (b.scriptureText) {
        const quote = newBlock('scripture', escapeHtml(b.scriptureText));
        quote.reference = b.scripture;
        converted.push(quote);
      } else if (b.scripture) {
        converted.push(newBlock('text', escapeHtml(`Texto: ${b.scripture}`)));
      }
      if (b.comment) converted.push(newBlock('text', escapeHtml(b.comment).replace(/\n/g, '<br>')));
      if (b.application) {
        converted.push(newBlock('highlight', escapeHtml(b.application).replace(/\n/g, '<br>')));
      }
    });
    if (doc.appeal?.trim()) {
      converted.push(newBlock('section', 'Apelo'));
      converted.push(newBlock('text', escapeHtml(doc.appeal).replace(/\n/g, '<br>')));
    }
    set({ content: [...content, ...converted], blocks: [], appeal: '' });
    notify('Conteúdo antigo trazido para os blocos.');
  };

  const toMarkdown = () =>
    [
      `# ${doc.title || 'Sermão sem título'}`,
      doc.theme && `**Tema:** ${doc.theme}`,
      doc.mainText && `**Texto principal:** ${doc.mainText}`,
      doc.date && `**Data:** ${doc.date}`,
      doc.attachmentId && '_Sermão importado — o conteúdo está no arquivo original._',
      blocksToMarkdown(content),
      doc.notes && `## Observações\n\n${doc.notes}`,
    ]
      .filter(Boolean)
      .join('\n\n');

  const toHtml = () =>
    [
      `<h1>${escapeHtml(doc.title || 'Sermão')}</h1>`,
      `<div class="meta">${escapeHtml([doc.theme, doc.mainText, doc.date].filter(Boolean).join(' · '))}</div>`,
      doc.mainTextContent ? `<blockquote class="s-scripture">${escapeHtml(doc.mainTextContent)}<cite>${escapeHtml(doc.mainText)}</cite></blockquote>` : '',
      blocksToHtml(content),
    ].join('');

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

        {/* Sermão importado: o documento aparece como foi escrito, e os campos
            de redação dão lugar a ele — reescrever seria trabalho perdido. */}
        {doc.attachmentId && (
          <section className="stack">
            {attachment.loading && <p className="small dim">Carregando o arquivo…</p>}
            {attachment.data && <DocumentViewer attachment={attachment.data} />}
            {!attachment.loading && !attachment.data && (
              <div className="notice">
                <Icon name="warning" size={20} style={{ flex: 'none' }} />
                <span>O arquivo deste sermão não foi encontrado no aparelho.</span>
              </div>
            )}
          </section>
        )}

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

        {!doc.attachmentId && (
          <SermonBlocksEditor blocks={content} onChange={(next) => set({ content: next })} />
        )}

        {hasLegacy && (
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Conteúdo do formato anterior ({legacyBlocks.length} ponto(s))
            </summary>
            <div className="stack" style={{ marginTop: 'var(--sp-3)' }}>
              <p className="small muted">
                Este sermão foi escrito na estrutura antiga, em tópicos. Nada foi perdido — traga
                tudo para os blocos quando quiser.
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
                Trazer para os blocos
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
