import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { deliverFile, shareExportFile } from '../../core/export/deliver';
import { getMeta } from '../../core/bible/repository';
import type { AssistantMessage } from '../../core/ai/assistant';
import {
  exportDocument,
  GOAL_TITLE_LABEL,
  sendToExport,
  sendToSermon,
  sendToStudy,
  type AssistantDocument,
} from '../../core/ai/assistantDocument';
import type { PreviewTarget } from '../bible/VersePreview';
import { Markdown } from './Markdown';

interface Props {
  doc: AssistantDocument;
  messages: AssistantMessage[];
  translation: string;
  author: string;
  aiEnabled: boolean;
  /** A IA está redigindo ou revendo o texto. */
  working: boolean;
  onChange: (doc: AssistantDocument) => void;
  /** Pede à IA o documento inteiro revisto com o ajuste. */
  onRevise: (request: string) => Promise<boolean>;
  /** Redige de novo a partir da conversa. */
  onRedraft: () => void;
  onRef: (target: PreviewTarget, from: HTMLElement) => void;
}

type Busy = '' | 'pdf' | 'docx' | 'share' | 'sermon' | 'study' | 'export';

/**
 * O documento montado da conversa: um texto só, corrido, que o pregador lê,
 * edita de cima a baixo, ajusta com a IA e leva para fora.
 */
export function DocumentEditor({
  doc, messages, translation, author, aiEnabled, working, onChange, onRevise, onRedraft, onRef,
}: Props) {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Busy>('');
  const [tab, setTab] = useState<'ver' | 'editar'>('ver');
  const [request, setRequest] = useState('');
  const meta = useAsync(() => getMeta(translation), [translation]);
  const translationLabel = meta.data?.shortName ?? meta.data?.name ?? translation;

  const update = (patch: Partial<AssistantDocument>) => onChange({ ...doc, ...patch, updatedAt: Date.now() });
  const canExport = doc.text.trim().length > 0 && !busy && !working;

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

  const revise = async () => {
    if (!request.trim() || working) return;
    if (await onRevise(request.trim())) setRequest('');
  };

  const undo = () => {
    if (doc.previousText === undefined) return;
    update({ text: doc.previousText, previousText: doc.text });
  };

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
        {doc.manual && (
          <p className="small dim" style={{ margin: 0 }}>
            {aiEnabled
              ? 'Estas são as respostas da conversa juntas. Toque em "Redigir com a IA" para receber o texto corrido, ou costure você mesmo.'
              : 'Sem IA configurada, o documento junta as respostas da conversa na ordem. Edite para costurar as partes.'}
          </p>
        )}
      </div>

      <div className="card assistant-doc-body">
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)', justifyContent: 'space-between' }}>
          <div className="tabs" role="tablist" aria-label="Ver ou editar">
            <button type="button" role="tab" aria-selected={tab === 'ver'} className={`tab${tab === 'ver' ? ' active' : ''}`} onClick={() => setTab('ver')}>
              Ver como fica
            </button>
            <button type="button" role="tab" aria-selected={tab === 'editar'} className={`tab${tab === 'editar' ? ' active' : ''}`} onClick={() => setTab('editar')}>
              Editar texto
            </button>
          </div>
          <div className="row" style={{ gap: 'var(--sp-1)' }}>
            {doc.previousText !== undefined && (
              <button className="btn btn-ghost btn-sm" onClick={undo} disabled={working}>
                <Icon name="reset" size={16} />
                <span>Desfazer</span>
              </button>
            )}
            {aiEnabled && (
              <button className="btn btn-ghost btn-sm" onClick={onRedraft} disabled={working}>
                <Icon name="sparkle" size={16} />
                <span>{doc.manual ? 'Redigir com a IA' : 'Redigir de novo'}</span>
              </button>
            )}
          </div>
        </div>

        {working ? (
          <div className="row" style={{ gap: 'var(--sp-2)', padding: 'var(--sp-5) 0' }}>
            <span className="spinner" />
            <span className="small dim">A IA está escrevendo o documento inteiro…</span>
          </div>
        ) : tab === 'editar' ? (
          <textarea
            className="textarea assistant-doc-text"
            value={doc.text}
            aria-label="Texto do documento"
            onChange={(e) => update({ text: e.target.value })}
          />
        ) : (
          <div className="assistant-doc-preview">
            <Markdown text={doc.text} validRefs={new Set(doc.validRefs)} onRef={onRef} />
          </div>
        )}
        {tab === 'editar' && !working && (
          <p className="small dim" style={{ margin: 0 }}>
            "## " no começo da linha abre uma parte; "- " faz lista; **negrito** entre dois asteriscos; "&gt; " destaca.
          </p>
        )}
      </div>

      {aiEnabled && (
        <form className="card assistant-doc-revise" onSubmit={(e) => { e.preventDefault(); revise(); }}>
          <label htmlFor="assistant-doc-request" className="small" style={{ fontWeight: 600 }}>Pedir um ajuste à IA</label>
          <div className="row" style={{ gap: 'var(--sp-2)' }}>
            <input
              id="assistant-doc-request"
              className="input"
              value={request}
              placeholder='Ex.: "deixe a introdução mais curta" ou "acrescente o hebraico de tsedaqah"'
              onChange={(e) => setRequest(e.target.value)}
            />
            <button type="submit" className="btn" disabled={!request.trim() || working}>
              <Icon name="sparkle" size={16} />
              <span>Ajustar</span>
            </button>
          </div>
          <span className="small dim">A IA devolve o documento inteiro revisto, sem desligar as partes. Dá para desfazer.</span>
        </form>
      )}

      <div className="card assistant-doc-out">
        <h2 className="section-title" style={{ margin: 0 }}>Levar para fora</h2>
        <label className="row assistant-doc-check">
          <input
            type="checkbox"
            checked={doc.includeVerses}
            onChange={(e) => update({ includeVerses: e.target.checked })}
          />
          <span>Incluir no fim os versículos citados, com o texto da sua Bíblia ({translationLabel})</span>
        </label>
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
        <p className="small dim" style={{ margin: 0 }}>
          O arquivo abre com um aviso de que há comentário gerado com apoio de IA.
        </p>
      </div>
    </section>
  );
}
