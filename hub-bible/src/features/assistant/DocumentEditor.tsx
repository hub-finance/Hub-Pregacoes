import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { deliverFile, shareExportFile } from '../../core/export/deliver';
import type { AssistantMessage } from '../../core/ai/assistant';
import {
  appendNewAnswers,
  exportDocument,
  GOAL_TITLE_LABEL,
  newAnswerCount,
  sendToExport,
  sendToSermon,
  sendToStudy,
  type AssistantDocument,
  type DocSection,
} from '../../core/ai/assistantDocument';
import { uid } from '../../core/db/db';
import { useAsync } from '../../hooks';
import { getMeta } from '../../core/bible/repository';

interface Props {
  doc: AssistantDocument;
  messages: AssistantMessage[];
  translation: string;
  author: string;
  onChange: (doc: AssistantDocument) => void;
}

type Busy = '' | 'pdf' | 'docx' | 'share' | 'sermon' | 'study' | 'export';

/**
 * O documento montado da conversa: o pregador escolhe as partes, edita, põe
 * em ordem e leva para fora — PDF, Word, Gerador, Rhema ou Gerar e Exportar.
 */
export function DocumentEditor({ doc, messages, translation, author, onChange }: Props) {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Busy>('');
  const meta = useAsync(() => getMeta(translation), [translation]);
  const translationLabel = meta.data?.shortName ?? meta.data?.name ?? translation;

  const update = (patch: Partial<AssistantDocument>) => onChange({ ...doc, ...patch, updatedAt: Date.now() });
  const updateSection = (id: string, patch: Partial<DocSection>) =>
    update({ sections: doc.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (index: number, delta: number) => {
    const next = [...doc.sections];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    update({ sections: next });
  };
  const remove = (id: string) => update({ sections: doc.sections.filter((s) => s.id !== id) });
  const addSection = () =>
    update({ sections: [...doc.sections, { id: uid('dsec_'), heading: 'Nova seção', text: '', include: true }] });

  const fresh = newAnswerCount(doc, messages);
  const included = doc.sections.filter((s) => s.include && s.text.trim()).length;
  const canExport = included > 0 && !busy;

  const run = async (kind: Busy, task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setBusy('');
    }
  };

  const download = (format: 'pdf' | 'docx') =>
    run(format, async () => {
      const { blob, filename } = await exportDocument(doc, messages, translation, format, author);
      notify(await deliverFile(blob, filename));
    });

  const share = () =>
    run('share', async () => {
      const { blob, filename } = await exportDocument(doc, messages, translation, 'pdf', author);
      notify(await shareExportFile(blob, filename));
    });

  return (
    <section className="assistant-doc" aria-label="Documento">
      <div className="card assistant-doc-head">
        <div className="field">
          <label htmlFor="assistant-doc-title">{GOAL_TITLE_LABEL[doc.goal]}</label>
          <input
            id="assistant-doc-title"
            className="input"
            value={doc.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <label className="row assistant-doc-check">
          <input
            type="checkbox"
            checked={doc.includeVerses}
            onChange={(e) => update({ includeVerses: e.target.checked })}
          />
          <span>Incluir no fim os versículos citados, com o texto da sua Bíblia ({translationLabel})</span>
        </label>
        <p className="small dim" style={{ margin: 0 }}>
          Marque as partes que entram, edite o texto e ponha na ordem. O arquivo abre com um aviso de que há
          comentário gerado com apoio de IA.
        </p>
        {fresh > 0 && (
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange(appendNewAnswers(doc, messages))}>
            <Icon name="plus" size={16} />
            <span>Trazer {fresh === 1 ? 'a resposta nova' : `as ${fresh} respostas novas`} da conversa</span>
          </button>
        )}
      </div>

      <ol className="assistant-doc-sections">
        {doc.sections.map((s, i) => (
          <li key={s.id} className={`card assistant-doc-section${s.include ? '' : ' off'}`}>
            <div className="row assistant-doc-section-head">
              <input
                type="checkbox"
                checked={s.include}
                aria-label={`Incluir a seção ${s.heading}`}
                onChange={(e) => updateSection(s.id, { include: e.target.checked })}
              />
              <input
                className="input"
                value={s.heading}
                aria-label="Título da seção"
                onChange={(e) => updateSection(s.id, { heading: e.target.value })}
              />
            </div>
            <textarea
              className="textarea"
              rows={Math.min(14, Math.max(4, Math.ceil(s.text.length / 70)))}
              value={s.text}
              aria-label={`Texto da seção ${s.heading}`}
              onChange={(e) => updateSection(s.id, { text: e.target.value })}
            />
            <div className="row assistant-doc-section-actions">
              <button className="icon-btn" aria-label="Subir a seção" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="arrow-up" size={18} />
              </button>
              <button className="icon-btn" aria-label="Descer a seção" disabled={i === doc.sections.length - 1} onClick={() => move(i, 1)}>
                <Icon name="arrow-down" size={18} />
              </button>
              <button className="icon-btn" aria-label={`Remover a seção ${s.heading}`} onClick={() => remove(s.id)}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn-sm" onClick={addSection} style={{ marginBottom: 'var(--sp-4)' }}>
        <Icon name="plus" size={16} />
        <span>Seção em branco</span>
      </button>

      <div className="card assistant-doc-out">
        <h2 className="section-title" style={{ margin: 0 }}>Levar para fora</h2>
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
          <button className="btn btn-primary" disabled={!canExport} onClick={() => download('pdf')}>
            <Icon name="download" size={18} />
            <span>{busy === 'pdf' ? 'Gerando…' : 'Baixar PDF'}</span>
          </button>
          <button className="btn" disabled={!canExport} onClick={share}>
            <Icon name="share" size={18} />
            <span>{busy === 'share' ? 'Gerando…' : 'Compartilhar PDF'}</span>
          </button>
          <button className="btn" disabled={!canExport} onClick={() => download('docx')}>
            <Icon name="text" size={18} />
            <span>{busy === 'docx' ? 'Gerando…' : 'Word'}</span>
          </button>
        </div>
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
          {doc.goal === 'mensagem' ? (
            <button
              className="btn btn-ghost btn-sm"
              disabled={!canExport}
              onClick={() => run('sermon', async () => navigate(`/sermoes/${await sendToSermon(doc, messages, translation)}`))}
            >
              <Icon name="sermon" size={16} />
              <span>Continuar no Gerador</span>
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              disabled={!canExport}
              onClick={() => run('study', async () => navigate(`/rhema/${await sendToStudy(doc)}`))}
            >
              <Icon name="study" size={16} />
              <span>Continuar no Rhema</span>
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            disabled={!canExport}
            onClick={() => run('export', async () => navigate(`/exportar/${await sendToExport(doc, messages, translation)}`))}
          >
            <Icon name="layers" size={16} />
            <span>Personalizar no Gerar e Exportar</span>
          </button>
        </div>
        {included === 0 && <p className="small dim" style={{ margin: 0 }}>Marque ao menos uma seção com texto.</p>}
      </div>
    </section>
  );
}
