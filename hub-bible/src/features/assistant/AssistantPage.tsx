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
  draftDocumentText,
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
import { DocumentEditor } from './DocumentEditor';
import { buildStudyWithoutAi } from '../../core/data/studyEngine';
import {
  getMaterial,
  importMaterial,
  listMaterials,
  removeMaterial,
  renameMaterial,
  type MaterialSummary,
} from '../../core/data/assistantMaterials';
import { documentFromAnswers, GOAL_LABEL, splitTitle, type AssistantDocument, type AssistantGoal } from '../../core/ai/assistantDocument';

const MODES: { id: AssistantMode; label: string }[] = [
  { id: 'livre', label: 'Pedido livre' },
  { id: 'auditoria', label: 'Conferir interpretação' },
];

const GOALS: { id: AssistantGoal; hint: string }[] = [
  { id: 'livre', hint: 'Tirar uma dúvida, estudar uma palavra, um versículo ou um tema.' },
  { id: 'estudo', hint: 'Estudo em seções: texto, contexto, original, doutrina, Cristo e aplicação.' },
  { id: 'mensagem', hint: 'Pregação: texto principal, introdução, pontos, aplicação e conclusão.' },
  { id: 'resumo', hint: 'O essencial em poucos pontos, com os textos-chave.' },
];

type Engine = 'ia' | 'aparelho';

/** Pedido padrão quando há material e a caixa ficou vazia. */
const MATERIAL_REQUEST: Record<AssistantGoal | 'auditoria', string> = {
  livre: 'Estude este material.',
  estudo: 'Faça um estudo sistemático deste material.',
  mensagem: 'Monte uma mensagem a partir deste material.',
  resumo: 'Resuma este material.',
  auditoria: 'Confira este material: onde o autor está bem sustentado pelo texto e onde não está.',
};

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
  const [view, setView] = useState<'conversa' | 'documento'>('conversa');
  const goal: AssistantGoal = conv.goal ?? 'livre';
  const saveTimer = useRef<number | undefined>(undefined);
  const [docWorking, setDocWorking] = useState(false);
  // a IA demora: quando ela volta, o documento é aplicado sobre a conversa atual
  const convRef = useRef(conv);
  convRef.current = conv;

  const lastAnswer = useRef<HTMLDivElement | null>(null);
  const enabled = isAiEnabled();
  // como o Hub Resumos: com IA quando houver chave; sem ela, o motor do aparelho
  const [enginePick, setEnginePick] = useState<Engine>('ia');
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [materialBusy, setMaterialBusy] = useState('');
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialToRemove, setMaterialToRemove] = useState<MaterialSummary | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const selectedMaterial = materials.find((m) => m.id === materialId) ?? null;
  const refreshMaterials = useCallback(() => {
    listMaterials().then(setMaterials).catch(() => setMaterials([]));
  }, []);
  useEffect(refreshMaterials, [refreshMaterials]);
  const engine: Engine = enabled ? enginePick : 'aparelho';

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
    const typed = (override ?? text).trim();
    // com um material escolhido, dá para pedir sem escrever: o pedido padrão vale
    const request = typed || (selectedMaterial ? MATERIAL_REQUEST[mode === 'auditoria' ? 'auditoria' : goal] : '');
    if (!request || loading || passageInvalid) return;
    setLoading(true);
    setError('');
    const userMsg: AssistantMessage = {
      role: 'user', content: request, mode, depth, passage: passage.trim() || undefined,
      material: selectedMaterial?.title, at: Date.now(),
    };
    // a pergunta aparece na hora; só entra na conversa salva com a resposta
    const pending = { ...conv, messages: [...conv.messages, userMsg] };
    setConv(pending);
    setText('');
    try {
      const material = materialId ? await getMaterial(materialId) : null;
      if (materialId && !material) throw new Error('O material escolhido não está mais no aparelho.');
      const answer = engine === 'ia'
        ? await runAssistant({ text: request, mode, depth, passage, translation, history: conv.messages, goal, material })
        : await buildStudyWithoutAi({ text: request, mode, depth, passage, translation, goal, material });
      const done: AssistantConversation = {
        ...pending,
        title: conv.title || conversationTitle(request),
        messages: [...pending.messages, {
          role: 'assistant', content: answer.content, validRefs: answer.validRefs, sources: answer.sources, engine, at: Date.now(),
        }],
      };
      setConv(done);
      await saveConversation(done);
      refreshHistory();
      requestAnimationFrame(() => lastAnswer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      setConv(conv);
      setText(request);
      setError(err instanceof Error ? err.message : engine === 'ia' ? 'Não foi possível falar com a IA.' : 'Não foi possível montar o estudo.');
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setView('conversa');
    setConv(newConversation());
    setText('');
    // conversa nova, foco novo: a passagem do pedido anterior não vale mais
    setPassage('');
    setError('');
    setPreview(null);
  };

  const openConversation = (c: AssistantConversation) => {
    setView('conversa');
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

  /** Edições do documento: na tela na hora, gravadas logo depois de parar de digitar. */
  const updateDocument = (doc: AssistantDocument) => {
    const next = { ...convRef.current, document: doc };
    setConv(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveConversation(next).then(refreshHistory).catch(() => notify('Não foi possível salvar o documento.'));
    }, 500);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  /** Mudança vinda da IA: aplica e grava na hora, guardando a versão anterior. */
  const commitDocument = async (doc: AssistantDocument) => {
    window.clearTimeout(saveTimer.current);
    const next = { ...convRef.current, document: doc };
    setConv(next);
    await saveConversation(next).catch(() => notify('Não foi possível salvar o documento.'));
    refreshHistory();
  };

  const lastPassage = () => [...conv.messages].reverse().find((m) => m.role === 'user' && m.passage)?.passage;

  /** A IA redige o documento inteiro, corrido, a partir da conversa. */
  const draftWithAi = async (base: AssistantDocument) => {
    setDocWorking(true);
    try {
      const out = await draftDocumentText({
        goal: base.goal, history: convRef.current.messages, translation, passage: lastPassage(),
      });
      const { title, body } = splitTitle(out.content);
      await commitDocument({
        ...base,
        title: base.manual && title ? title : base.title,
        text: body,
        previousText: base.text,
        validRefs: out.validRefs,
        // o texto da IA cita os versículos só pela referência: eles entram no fim
        includeVerses: base.manual ? true : base.includeVerses,
        manual: false,
        updatedAt: Date.now(),
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'A IA não conseguiu redigir o documento.');
    } finally {
      setDocWorking(false);
    }
  };

  const reviseWithAi = async (request: string): Promise<boolean> => {
    const doc = convRef.current.document;
    if (!doc) return false;
    setDocWorking(true);
    try {
      const out = await draftDocumentText({
        goal: doc.goal, history: convRef.current.messages, translation, passage: lastPassage(),
        current: `# ${doc.title}\n\n${doc.text}`, request,
      });
      const { body } = splitTitle(out.content);
      await commitDocument({
        ...doc,
        text: body,
        previousText: doc.text,
        validRefs: [...new Set([...doc.validRefs, ...out.validRefs])],
        updatedAt: Date.now(),
      });
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : 'A IA não conseguiu ajustar o documento.');
      return false;
    } finally {
      setDocWorking(false);
    }
  };

  const openDocument = async () => {
    setPreview(null);
    setView('documento');
    if (conv.document) return;
    // o texto da conversa, como está: o pregador achou o que já veio bom e não
    // quer a IA reescrevendo (e gastando) só para montar o arquivo. Redigir de
    // novo fica como escolha dele, no documento, com Desfazer.
    await commitDocument(documentFromAnswers(conv.title, goal, conv.messages));
  };

  const hasAnswer = conv.messages.some((m) => m.role === 'assistant');

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setMaterialBusy('Lendo o arquivo…');
    try {
      const m = await importMaterial(file, (msg) => setMaterialBusy(msg));
      refreshMaterials();
      setMaterialId(m.id);
      notify(`${m.title}: ${m.parts.length} ${m.parts.length === 1 ? 'parte' : 'partes'} lidas. Fica só neste aparelho.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.');
    } finally {
      setMaterialBusy('');
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const confirmRemoveMaterial = async () => {
    if (!materialToRemove) return;
    await removeMaterial(materialToRemove.id);
    if (materialToRemove.id === materialId) setMaterialId('');
    setMaterialToRemove(null);
    refreshMaterials();
  };

  const openRef = useCallback((target: PreviewTarget) => setPreview(target), []);

  const lastAssistantIndex = useMemo(() => {
    for (let i = conv.messages.length - 1; i >= 0; i--) if (conv.messages[i].role === 'assistant') return i;
    return -1;
  }, [conv.messages]);

  const composer = (
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
  
          <div className="field">
            <label htmlFor="assistant-material">Material (opcional) — livro, apostila, estudo ou mensagem</label>
            <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
              <select
                id="assistant-material"
                className="select assistant-material-select"
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
              >
                <option value="">Nenhum</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" disabled={!!materialBusy} onClick={() => fileInput.current?.click()}>
                <Icon name="upload" size={16} />
                <span>{materialBusy ? 'Lendo…' : 'Importar PDF ou Word'}</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                hidden
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
            </div>
            {materialBusy && <span className="small dim">{materialBusy}</span>}
            {selectedMaterial && !materialBusy && (
              <span className="small dim">
                {selectedMaterial.parts} {selectedMaterial.parts === 1 ? 'parte' : 'partes'} · {selectedMaterial.words.toLocaleString('pt-BR')} palavras.
                {' '}Pode tocar em Estudar sem escrever nada, ou pedir uma parte ("estude a parte 3").
              </span>
            )}
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
  
          <div className="field">
            <label id="assistant-engine">Como produzir</label>
            <div className="row row-wrap" role="radiogroup" aria-labelledby="assistant-engine" style={{ gap: 'var(--sp-2)' }}>
              <button
                type="button"
                role="radio"
                aria-checked={engine === 'ia'}
                disabled={!enabled}
                className={`chip${engine === 'ia' ? ' active' : ''}`}
                onClick={() => setEnginePick('ia')}
              >
                Com IA
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={engine === 'aparelho'}
                className={`chip${engine === 'aparelho' ? ' active' : ''}`}
                onClick={() => setEnginePick('aparelho')}
              >
                Sem IA — dados do aparelho
              </button>
            </div>
            {!enabled && (
              <span className="small dim">
                Sem chave de IA, o estudo é montado com a sua Bíblia, o léxico, o dicionário, a tipologia e os guias.{' '}
                <Link to="/config">Configurar a IA</Link>
              </span>
            )}
          </div>
  
          <div className="row row-wrap" style={{ gap: 'var(--sp-2)', justifyContent: 'space-between' }}>
            <span className="small dim">
              {engine === 'ia'
                ? 'A IA recebe o texto da Bíblia, o léxico e o dicionário do aparelho. Confira sempre com a Escritura.'
                : 'Nada é inventado: só o que está nas fontes do aparelho. A interpretação e a aplicação ficam para você.'}
            </span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!text.trim() && !selectedMaterial) || passageInvalid}
            >
              <Icon name={engine === 'ia' ? 'sparkle' : 'book'} size={18} />
              <span>{loading ? 'Estudando…' : conv.messages.length ? 'Continuar' : 'Estudar'}</span>
            </button>
          </div>
        </form>
  );

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
        {materials.length > 0 && (
          <button className="btn btn-sm" onClick={() => setMaterialsOpen(true)}>
            <Icon name="folder" size={16} />
            <span>Materiais ({materials.length})</span>
          </button>
        )}
        {conv.messages.length > 0 && (
          <button className="btn btn-sm" onClick={startNew}>
            <Icon name="plus" size={16} />
            <span>Nova conversa</span>
          </button>
        )}
        {hasAnswer && view === 'conversa' && (
          <button className="btn btn-sm btn-primary" onClick={openDocument}>
            <Icon name="note" size={16} />
            <span>{conv.document ? 'Abrir documento' : 'Montar documento'}</span>
          </button>
        )}
      </div>

      {conv.document && (
        <div className="tabs assistant-view-tabs" role="tablist" aria-label="Conversa ou documento">
          <button type="button" role="tab" aria-selected={view === 'conversa'} className={`tab${view === 'conversa' ? ' active' : ''}`} onClick={() => setView('conversa')}>
            Conversa
          </button>
          <button type="button" role="tab" aria-selected={view === 'documento'} className={`tab${view === 'documento' ? ' active' : ''}`} onClick={openDocument}>
            Documento · {GOAL_LABEL[conv.document.goal]}
          </button>
        </div>
      )}

      {view === 'documento' && conv.document ? (
        <DocumentEditor
          doc={conv.document}
          messages={conv.messages}
          translation={translation}
          author={settings.userName}
          aiEnabled={enabled}
          working={docWorking}
          onChange={updateDocument}
          onRevise={reviseWithAi}
          onRedraft={() => conv.document && draftWithAi(conv.document)}
          onRef={openRef}
        />
      ) : (<>

      {conv.messages.length === 0 && (
        <section className="assistant-goal-pick">
          <div className="row row-wrap" role="radiogroup" aria-label="O que você vai construir" style={{ gap: 'var(--sp-2)' }}>
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={goal === g.id}
                className={`chip${goal === g.id ? ' active' : ''}`}
                onClick={() => setConv({ ...conv, goal: g.id })}
              >
                {GOAL_LABEL[g.id]}
              </button>
            ))}
          </div>
          <p className="small dim" style={{ margin: 'var(--sp-2) 0 0' }}>{GOALS.find((g) => g.id === goal)?.hint}</p>
        </section>
      )}

      {conv.messages.length === 0 && composer}

      {conv.messages.length > 0 && goal !== 'livre' && (
        <p className="small dim" style={{ marginTop: 0 }}>
          Construindo: <strong>{GOAL_LABEL[goal]}</strong>. Converse e refine; quando estiver bom, toque em
          "{conv.document ? 'Abrir documento' : 'Montar documento'}".
        </p>
      )}

      {conv.messages.length > 0 && (
        <section className="assistant-thread" aria-live="polite">
          {conv.messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="assistant-msg user">
                <div className="assistant-msg-meta small dim">
                  {m.mode === 'auditoria' ? 'Conferir interpretação' : 'Pedido'}
                  {m.passage ? ` · ${m.passage}` : ''}
                  {m.material ? ` · Material: ${m.material}` : ''}
                  {m.depth && m.depth !== 'auto' ? ` · ${DEPTHS.find((d) => d.id === m.depth)?.label}` : ''}
                </div>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
              </div>
            ) : (
              <div key={i} className="assistant-msg ai" ref={i === lastAssistantIndex ? lastAnswer : undefined}>
                <div className="row assistant-msg-head">
                  <span className="badge">{m.engine === 'aparelho' ? 'Montado do aparelho, sem IA' : 'Comentário da IA'}</span>
                  {m.sources && m.sources.length > 0 && (
                    <span className="small dim truncate">{m.engine === 'aparelho' ? 'Fontes' : 'Com dados do aparelho'}: {m.sources.join(', ')}</span>
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
              <span className="small dim">{engine === 'ia' ? 'Estudando o texto…' : 'Montando com os dados do aparelho…'}</span>
            </div>
          )}
          {conv.messages.some((m) => m.role === 'assistant' && m.engine !== 'aparelho') && (
            <p className="small dim assistant-disclaimer">{AI_DISCLAIMER}</p>
          )}
        </section>
      )}

      {error && (
        <div className="card assistant-error" role="alert">
          <p className="small" style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {conv.messages.length > 0 && composer}
      </>)}

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

      <Sheet open={materialsOpen} title="Materiais importados" onClose={() => setMaterialsOpen(false)}>
        <p className="small dim" style={{ margin: '0 0 var(--sp-3)' }}>
          Ficam só neste aparelho. O nome do material não aparece no que o assistente escreve.
        </p>
        <ul className="assistant-history">
          {materials.map((m) => (
            <li key={m.id} className="row">
              <div className="assistant-history-item" style={{ cursor: 'default' }}>
                <input
                  className="input"
                  defaultValue={m.title}
                  aria-label={`Nome do material ${m.title}`}
                  onBlur={async (e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== m.title) {
                      await renameMaterial(m.id, e.target.value);
                      refreshMaterials();
                    }
                  }}
                />
                <span className="small dim">
                  {m.format === 'pdf' ? 'PDF' : 'Word'} · {m.parts} {m.parts === 1 ? 'parte' : 'partes'} · {m.words.toLocaleString('pt-BR')} palavras
                </span>
              </div>
              <button className="icon-btn" aria-label={`Apagar o material ${m.title}`} onClick={() => setMaterialToRemove(m)}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <ConfirmDialog
        open={!!materialToRemove}
        title="Apagar material?"
        message="O material sai deste aparelho. O seu arquivo original continua onde estava, e as conversas já feitas não mudam."
        confirmLabel="Apagar"
        onConfirm={confirmRemoveMaterial}
        onCancel={() => setMaterialToRemove(null)}
      />

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
