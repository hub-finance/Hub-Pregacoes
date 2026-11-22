import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { getAiProvider, type AiResponse, type AiTaskKind } from '../../core/ai/provider';
import { parseReference } from '../../core/bible/reference';
import { bookName } from '../../core/bible/canon';
import { getChapter } from '../../core/bible/repository';
import { findAnalysis, saveAnalysis } from '../../core/data/aiAnalyses';

const TASKS: { id: AiTaskKind; label: string; icon: string }[] = [
  { id: 'exegese', label: 'Exegese', icon: '🔬' },
  { id: 'contexto-historico', label: 'Contexto histórico', icon: '📜' },
  { id: 'temas-relacionados', label: 'Temas relacionados', icon: '🔗' },
  { id: 'referencias-cruzadas', label: 'Referências cruzadas', icon: '📖' },
  { id: 'perguntas-de-estudo', label: 'Perguntas de estudo', icon: '❓' },
  { id: 'estrutura-de-estudo', label: 'Estrutura de estudo', icon: '📋' },
];

const CHAPTER_TASKS: { id: AiTaskKind; label: string; icon: string }[] = [
  { id: 'exegese-capitulo', label: 'Exegese do capítulo', icon: '📖' },
  { id: 'contexto-historico', label: 'Contexto histórico', icon: '📜' },
  { id: 'temas-relacionados', label: 'Temas relacionados', icon: '🔗' },
  { id: 'estrutura-de-estudo', label: 'Estrutura de estudo', icon: '📋' },
];

interface Props {
  book: string;
  chapter: number;
  verse?: number;
  reference: string;
  passage: string;
  translation: string;
  onNavigate: () => void;
  /** Modo capítulo: mostra tarefas de capítulo em vez de versículo. */
  chapterMode?: boolean;
}

interface VersePreview {
  ref: string;
  label: string;
  text: string;
}

/**
 * Leva a passagem para o Assistente bíblico, já preenchida, para um estudo em
 * seções. As análises daqui são rápidas e ficam salvas; o assistente é onde se
 * aprofunda (com IA ou sem ela, lendo materiais, montando o documento).
 */
function DeepenInAssistant({ reference, onNavigate }: { reference: string; onNavigate: () => void }) {
  const navigate = useNavigate();
  const go = () => {
    onNavigate();
    const q = new URLSearchParams({ ref: reference, pedido: `Estude ${reference}.` });
    navigate(`/assistente?${q.toString()}`);
  };
  return (
    <button type="button" className="btn btn-sm btn-ghost ai-deepen" onClick={go}>
      <Icon name="bible-study" size={16} />
      <span>Aprofundar no assistente</span>
    </button>
  );
}

export function AiContent({
  reference, passage, translation, onNavigate, chapterMode,
}: Props) {
  const taskList = chapterMode ? CHAPTER_TASKS : TASKS;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState('');
  const [activeTask, setActiveTask] = useState<AiTaskKind | null>(null);
  const [preview, setPreview] = useState<VersePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const abortRef = useRef(false);

  const openRef = useCallback(async (ref: string) => {
    const parsed = parseReference(ref);
    if (!parsed) return;
    setPreviewLoading(true);
    try {
      const verses = await getChapter(translation, parsed.book, parsed.chapter);
      const name = bookName(parsed.book);
      const label = parsed.verse ? `${name} ${parsed.chapter}:${parsed.verse}` : `${name} ${parsed.chapter}`;
      const text = parsed.verse ? (verses[parsed.verse - 1] ?? '') : verses.join(' ');
      setPreview({ ref, label, text });
    } catch {
      setPreview({ ref, label: ref, text: 'Versículo não encontrado nesta tradução.' });
    } finally {
      setPreviewLoading(false);
    }
  }, [translation]);

  const loadCached = useCallback(async (task: AiTaskKind) => {
    try {
      const cached = await findAnalysis(task, reference, translation);
      if (cached && !abortRef.current) {
        setResult({
          segments: cached.segments.map((s) => ({
            kind: s.kind as 'scripture' | 'ai-comment',
            title: s.title,
            text: s.text,
            reference: s.reference,
          })),
          suggestedReferences: cached.suggestedReferences,
          provider: cached.provider,
          disclaimer: cached.disclaimer,
        });
        setFromCache(true);
        setLoading(false);
        return true;
      }
    } catch { /* sem cache — segue para a API */ }
    return false;
  }, [reference, translation]);

  // sem chave de IA a lista continua à vista (o usuário prefere assim); o toque
  // explica o que falta em vez de esconder as análises
  const [needsKey, setNeedsKey] = useState(false);

  const runTask = useCallback(async (task: AiTaskKind, forceRefresh = false) => {
    const provider = getAiProvider();
    if (!provider) {
      // a análise salva está no aparelho: abre mesmo sem chave
      abortRef.current = false;
      if (!forceRefresh && (await findAnalysis(task, reference, translation).catch(() => null))) {
        setActiveTask(task);
        setResult(null);
        setError('');
        setPreview(null);
        await loadCached(task);
        return;
      }
      setNeedsKey(true);
      return;
    }

    abortRef.current = false;
    setActiveTask(task);
    setLoading(true);
    setError('');
    setResult(null);
    setFromCache(false);
    setPreview(null);

    if (!forceRefresh) {
      const hadCache = await loadCached(task);
      if (hadCache) return;
    }

    try {
      const response = await provider.run({
        task,
        translation,
        reference,
        passage,
      });
      if (!abortRef.current) {
        setResult(response);
        setFromCache(false);
        saveAnalysis({ task, reference, translation, response }).catch(() => {});
      }
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Erro ao analisar a passagem.');
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [translation, reference, passage, loadCached]);

  const handleBack = () => {
    abortRef.current = true;
    setActiveTask(null);
    setResult(null);
    setError('');
    setLoading(false);
    setFromCache(false);
    setPreview(null);
  };

  // Marca nas tarefas quais já têm análise salva
  const [savedTasks, setSavedTasks] = useState<Set<AiTaskKind>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const found = new Set<AiTaskKind>();
      for (const t of taskList) {
        try {
          const cached = await findAnalysis(t.id, reference, translation);
          if (cached) found.add(t.id);
        } catch { /* ignora */ }
      }
      if (!cancelled) setSavedTasks(found);
    }
    check();
    return () => { cancelled = true; };
  }, [reference, translation, taskList]);

  if (activeTask) {
    return (
      <div className="stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-3)' }}>
        <button className="btn btn-ghost btn-sm" onClick={handleBack} style={{ alignSelf: 'flex-start' }}>
          <Icon name="chevron-left" size={16} />
          <span>Voltar</span>
        </button>

        <p className="small dim" style={{ margin: 0 }}>
          {taskList.find((t) => t.id === activeTask)?.label} — {reference}
        </p>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-4) 0' }}>
            <span className="spinner" />
            <span className="small dim">Analisando…</span>
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'var(--danger)' }}>
            <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
            <button className="btn btn-sm" onClick={() => runTask(activeTask, true)} style={{ marginTop: 'var(--sp-2)' }}>
              Tentar novamente
            </button>
          </div>
        )}

        {result && (
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            {fromCache && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span className="small dim" style={{ fontStyle: 'italic' }}>Análise salva anteriormente</span>
                {getAiProvider() && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => runTask(activeTask, true)}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Icon name="reset" size={14} />
                    <span>Gerar novamente</span>
                  </button>
                )}
              </div>
            )}

            {result.segments.map((seg, i) => (
              <div key={i} className="ai-segment">
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{seg.text}</p>
              </div>
            ))}

            {result.suggestedReferences.length > 0 && (
              <div>
                <p className="small" style={{ fontWeight: 600, marginBottom: 'var(--sp-1)' }}>
                  Referências sugeridas
                </p>
                <div className="row row-wrap" style={{ gap: 'var(--sp-1)' }}>
                  {result.suggestedReferences.map((ref) => (
                    <button
                      key={ref}
                      className={`chip chip-sm${preview?.ref === ref ? ' active' : ''}`}
                      onClick={() => preview?.ref === ref ? setPreview(null) : openRef(ref)}
                      disabled={previewLoading}
                    >
                      {ref}
                    </button>
                  ))}
                </div>

                {previewLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                    <span className="spinner" />
                    <span className="small dim">Carregando versículo…</span>
                  </div>
                )}

                {preview && (
                  <div
                    className="card"
                    style={{
                      marginTop: 'var(--sp-2)',
                      background: 'var(--surface-2)',
                      borderLeft: '3px solid var(--accent)',
                      padding: 'var(--sp-3)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
                      <strong className="small">{preview.label}</strong>
                      <button className="icon-btn" onClick={() => setPreview(null)} aria-label="Fechar">
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                    <p style={{ margin: 0, lineHeight: 1.7, fontSize: '0.92rem' }}>{preview.text}</p>
                  </div>
                )}
              </div>
            )}

            <p className="small dim" style={{ fontStyle: 'italic', margin: 0 }}>
              {result.disclaimer}
            </p>
            <DeepenInAssistant reference={reference} onNavigate={onNavigate} />
            <p className="small dim" style={{ margin: 0 }}>
              Fonte: {result.provider}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
      <p className="small dim" style={{ margin: 0 }}>
        Escolha uma análise para <strong>{reference}</strong>
      </p>

      <div className="stack" style={{ gap: 'var(--sp-1)' }}>
        {taskList.map((task) => (
          <button
            key={task.id}
            className="ai-task-btn"
            onClick={() => runTask(task.id)}
          >
            <span className="ai-task-icon">{task.icon}</span>
            <span>{task.label}</span>
            {savedTasks.has(task.id) && (
              <span className="small dim" style={{ marginLeft: 'auto', marginRight: 'var(--sp-2)', fontSize: '0.72rem' }}>
                salva
              </span>
            )}
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
      </div>

      {needsKey && (
        <div className="notice ai-needs-key" role="status">
          <p className="small" style={{ margin: 0 }}>
            As análises usam IA, e este aparelho ainda não tem uma chave ativa. Coloque a sua chave do ChatGPT, do
            Claude ou do Gemini em Configurações › IA — chaves de API.
          </p>
          <Link className="btn btn-sm btn-primary" to="/config" onClick={onNavigate}>
            Configurar a IA
          </Link>
        </div>
      )}

      <p className="small dim" style={{ margin: 0, marginTop: 'var(--sp-2)' }}>
        A análise gera comentários sobre a passagem. O texto bíblico vem sempre do repositório local.
      </p>

      <div className="ai-deepen-box">
        <DeepenInAssistant reference={reference} onNavigate={onNavigate} />
        <span className="small dim">Estudo em seções, com os seus materiais — também sem IA.</span>
      </div>
    </div>
  );
}
