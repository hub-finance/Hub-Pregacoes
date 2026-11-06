import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, PageHeader } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { SidePanel } from '../../components/SidePanel';
import { useToast } from '../../components/Toast';
import { useIsWide } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { AI_DISCLAIMER, isAiEnabled } from '../../core/ai/provider';
import {
  runAssistant,
  type AssistantDepth,
  type AssistantMessage,
  type AssistantMode,
} from '../../core/ai/assistant';
import {
  conversationTitle,
  listConversations,
  newConversation,
  removeConversation,
  saveConversation,
  type AssistantConversation,
} from '../../core/data/assistant';
import { createNote } from '../../core/data/notes';
import { formatReference, parseReference } from '../../core/bible/reference';
import { VersePreview, previewLabel, type PreviewTarget } from '../bible/VersePreview';
import { Markdown, markdownToPlain } from './Markdown';

/** Comandos naturais do Prompt Mestre — um toque preenche o pedido. */
const EXAMPLES = [
  'Analise Romanos 5:1.',
  'Estude profundamente a justificação.',
  'Qual o significado de pistis?',
  'Faça o estudo de emunah.',
  'Compare fé no AT e no NT.',
  'O que significa "justificado pela fé"?',
  'Mostre a relação entre Abraão e Romanos 4.',
  'Faça uma exegese de Marcos 11:23-24.',
  'Analise logos e rhema.',
  'Estude cura na Bíblia.',
  'Faça uma doutrina sobre autoridade do crente.',
  'Prepare uma pregação sobre justiça pela fé.',
];

const MODES: { id: AssistantMode; label: string }[] = [
  { id: 'livre', label: 'Pedido livre' },
  { id: 'auditoria', label: 'Conferir interpretação' },
];

const DEPTHS: { id: AssistantDepth; label: string }[] = [
  { id: 'auto', label: 'Automática' },
  { id: 'objetivo', label: 'Objetiva' },
  { id: 'profundo', label: 'Profunda' },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // WebView antiga sem a API de área de transferência
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export default function AssistantPage() {
  const { settings } = useSettings();
  const { notify } = useToast();
  const isWide = useIsWide();
  const translation = settings.defaultTranslation;

  const [conv, setConv] = useState<AssistantConversation>(() => newConversation());
  const [history, setHistory] = useState<AssistantConversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toRemove, setToRemove] = useState<AssistantConversation | null>(null);

  const [mode, setMode] = useState<AssistantMode>('livre');
  const [depth, setDepth] = useState<AssistantDepth>('auto');
  const [text, setText] = useState('');
  const [passage, setPassage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const lastAnswer = useRef<HTMLDivElement | null>(null);
  const enabled = isAiEnabled();

  const refreshHistory = useCallback(() => {
    listConversations().then(setHistory).catch(() => setHistory([]));
  }, []);
  useEffect(refreshHistory, [refreshHistory]);

  const position = settings.lastPosition;
  const positionLabel = position
    ? formatReference({ book: position.book, chapter: position.chapter, verse: position.verse })
    : '';

  const passageInvalid = passage.trim() !== '' && !parseReference(passage);

  const send = async (override?: string) => {
    const request = (override ?? text).trim();
    if (!request || loading || passageInvalid) return;
    setLoading(true);
    setError('');
    const userMsg: AssistantMessage = {
      role: 'user', content: request, mode, depth, passage: passage.trim() || undefined, at: Date.now(),
    };
    // a pergunta aparece na hora; só entra na conversa salva com a resposta
    const pending = { ...conv, messages: [...conv.messages, userMsg] };
    setConv(pending);
    setText('');
    try {
      const answer = await runAssistant({
        text: request, mode, depth, passage, translation, history: conv.messages,
      });
      const done: AssistantConversation = {
        ...pending,
        title: conv.title || conversationTitle(request),
        messages: [...pending.messages, {
          role: 'assistant', content: answer.content, validRefs: answer.validRefs, sources: answer.sources, at: Date.now(),
        }],
      };
      setConv(done);
      await saveConversation(done);
      refreshHistory();
      requestAnimationFrame(() => lastAnswer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setConv(conv);
      setText(request);
      setError(err instanceof Error ? err.message : 'Não foi possível falar com a IA.');
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setConv(newConversation());
    setText('');
    setError('');
    setPreview(null);
  };

  const openConversation = (c: AssistantConversation) => {
    setConv(c);
    setHistoryOpen(false);
    setError('');
    setPreview(null);
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    await removeConversation(toRemove.id);
    if (toRemove.id === conv.id) startNew();
    setToRemove(null);
    refreshHistory();
  };

  const saveAsNote = async (answer: AssistantMessage, question?: AssistantMessage) => {
    const parsed = question?.passage ? parseReference(question.passage) : null;
    await createNote({
      targetType: 'free',
      reference: parsed ? formatReference(parsed) : 'Assistente bíblico',
      title: conversationTitle(question?.content ?? conv.title ?? 'Assistente bíblico'),
      content: `${question ? `Pedido: ${question.content}\n\n` : ''}${markdownToPlain(answer.content)}\n\n— Gerado pelo Assistente bíblico (IA). ${AI_DISCLAIMER}`,
      tags: ['assistente'],
    });
    notify('Salvo nas anotações.');
  };

  const copyAnswer = async (answer: AssistantMessage) => {
    const ok = await copyText(markdownToPlain(answer.content));
    notify(ok ? 'Resposta copiada.' : 'Não foi possível copiar neste aparelho.');
  };

  const openRef = useCallback((target: PreviewTarget) => setPreview(target), []);

  const lastAssistantIndex = useMemo(() => {
    for (let i = conv.messages.length - 1; i >= 0; i--) if (conv.messages[i].role === 'assistant') return i;
    return -1;
  }, [conv.messages]);

  const previewBody = preview && (
    <VersePreview
      target={preview}
      translation={translation}
      onBack={() => setPreview(null)}
      onNavigate={() => setPreview(null)}
    />
  );

  return (
    <div className={`page assistant-layout${isWide && preview ? ' has-panel page-wide' : ''}`}>
      <div className="assistant-main">
      <PageHeader
        title="Assistente bíblico"
        lead="Pesquisa, exegese e doutrina na linha da Palavra da Fé. A Escritura primeiro; você no comando."
      />
      {/* os botões ficam numa linha própria: ao lado do título, no celular, espremiam o texto */}
      <div className="row row-wrap assistant-toolbar">
        <button className="btn btn-sm" onClick={() => setHistoryOpen(true)}>
          <Icon name="list" size={16} />
          <span>Conversas{history.length ? ` (${history.length})` : ''}</span>
        </button>
        {conv.messages.length > 0 && (
          <button className="btn btn-sm" onClick={startNew}>
            <Icon name="plus" size={16} />
            <span>Nova conversa</span>
          </button>
        )}
      </div>

      {!enabled && (
        <div className="card assistant-off">
          <p style={{ margin: 0 }}>
            O assistente usa a IA que você configura com a sua própria chave. Nada sai do aparelho
            a não ser o pedido, enviado direto ao serviço escolhido.
          </p>
          <Link className="btn btn-primary btn-sm" to="/config" style={{ alignSelf: 'flex-start' }}>
            <Icon name="settings" size={16} />
            <span>Configurar a IA</span>
          </Link>
        </div>
      )}

      {conv.messages.length === 0 && (
        <section className="section">
          <h2 className="section-title">Experimente pedir</h2>
          <div className="assistant-examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </section>
      )}

      {conv.messages.length > 0 && (
        <section className="assistant-thread" aria-live="polite">
          {conv.messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="assistant-msg user">
                <div className="assistant-msg-meta small dim">
                  {m.mode === 'auditoria' ? 'Conferir interpretação' : 'Pedido'}
                  {m.passage ? ` · ${m.passage}` : ''}
                  {m.depth && m.depth !== 'auto' ? ` · ${DEPTHS.find((d) => d.id === m.depth)?.label}` : ''}
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
              </div>
            ) : (
              <div key={i} className="assistant-msg ai" ref={i === lastAssistantIndex ? lastAnswer : undefined}>
                <div className="row assistant-msg-head">
                  <span className="badge">Comentário da IA</span>
                  {m.sources && m.sources.length > 0 && (
                    <span className="small dim truncate">Com dados do aparelho: {m.sources.join(', ')}</span>
                  )}
                </div>
                <Markdown text={m.content} validRefs={new Set(m.validRefs ?? [])} onRef={openRef} />
                <div className="row row-wrap assistant-msg-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => copyAnswer(m)}>
                    <Icon name="copy" size={16} />
                    <span>Copiar</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => saveAsNote(m, conv.messages[i - 1]?.role === 'user' ? conv.messages[i - 1] : undefined)}
                  >
                    <Icon name="note" size={16} />
                    <span>Salvar como anotação</span>
                  </button>
                </div>
              </div>
            )
          ))}
          {loading && (
            <div className="assistant-msg ai row" style={{ gap: 'var(--sp-2)' }}>
              <span className="spinner" />
              <span className="small dim">Estudando o texto…</span>
            </div>
          )}
          <p className="small dim assistant-disclaimer">{AI_DISCLAIMER}</p>
        </section>
      )}

      {error && (
        <div className="card assistant-error" role="alert">
          <p className="small" style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      <form
        className="card assistant-composer"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <div className="tabs" role="tablist" aria-label="Tipo de pedido">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`tab${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="assistant-text">
            {mode === 'auditoria' ? 'Cole a interpretação ou o trecho da mensagem' : 'O que você quer estudar?'}
          </label>
          <textarea
            id="assistant-text"
            className="textarea"
            rows={mode === 'auditoria' ? 7 : 3}
            value={text}
            placeholder={mode === 'auditoria'
              ? 'Ex.: Em Marcos 11:23 a palavra falada tem poder por si mesma, por isso…'
              : 'Ex.: Qual a diferença entre justificação e santificação?'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
            }}
          />
        </div>

        <div className="assistant-options">
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label htmlFor="assistant-passage">Passagem em foco (opcional)</label>
            <div className="row" style={{ gap: 'var(--sp-2)' }}>
              <input
                id="assistant-passage"
                className="input"
                value={passage}
                placeholder="Ex.: Romanos 5:1-5"
                aria-invalid={passageInvalid}
                onChange={(e) => setPassage(e.target.value)}
              />
              {position && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setPassage(positionLabel)}
                  title={`Usar ${positionLabel}`}
                >
                  <Icon name="book" size={16} />
                  <span>Onde parei</span>
                </button>
              )}
            </div>
            {passageInvalid && <span className="small" style={{ color: 'var(--danger)' }}>Referência não reconhecida.</span>}
          </div>

          <div className="field">
            <label id="assistant-depth">Profundidade</label>
            <div className="row row-wrap" role="radiogroup" aria-labelledby="assistant-depth" style={{ gap: 'var(--sp-2)' }}>
              {DEPTHS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={depth === d.id}
                  className={`chip${depth === d.id ? ' active' : ''}`}
                  onClick={() => setDepth(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="row row-wrap" style={{ gap: 'var(--sp-2)', justifyContent: 'space-between' }}>
          <span className="small dim">
            A IA recebe o texto da Bíblia, o léxico e o dicionário do aparelho. Confira sempre com a Escritura.
          </span>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!enabled || loading || !text.trim() || passageInvalid}
          >
            <Icon name="sparkle" size={18} />
            <span>{loading ? 'Estudando…' : conv.messages.length ? 'Continuar' : 'Estudar'}</span>
          </button>
        </div>
      </form>

      </div>

      {isWide ? (
        <SidePanel open={!!preview} title={preview ? previewLabel(preview) : ''} onClose={() => setPreview(null)}>
          {previewBody}
        </SidePanel>
      ) : (
        <Sheet open={!!preview} title={preview ? previewLabel(preview) : ''} onClose={() => setPreview(null)}>
          {previewBody}
        </Sheet>
      )}

      <Sheet open={historyOpen} title="Conversas" onClose={() => setHistoryOpen(false)}>
        {history.length === 0 ? (
          <p className="dim" style={{ padding: 'var(--sp-3)' }}>Nenhuma conversa salva ainda.</p>
        ) : (
          <ul className="assistant-history">
            {history.map((c) => (
              <li key={c.id} className="row">
                <button type="button" className="assistant-history-item" onClick={() => openConversation(c)}>
                  <span className="truncate" style={{ fontWeight: 600 }}>{c.title || 'Conversa'}</span>
                  <span className="small dim">
                    {new Date(c.updatedAt).toLocaleDateString('pt-BR')} · {c.messages.filter((m) => m.role === 'assistant').length} respostas
                  </span>
                </button>
                <button className="icon-btn" aria-label={`Apagar a conversa ${c.title}`} onClick={() => setToRemove(c)}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!toRemove}
        title="Apagar conversa?"
        message="A conversa sai deste aparelho. O que você salvou como anotação continua nas anotações."
        confirmLabel="Apagar"
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
