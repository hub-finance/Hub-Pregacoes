import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { getAiProvider, isAiEnabled, type AiResponse, type AiTaskKind } from '../../core/ai/provider';
import { parseReference } from '../../core/bible/reference';

const TASKS: { id: AiTaskKind; label: string; icon: string }[] = [
  { id: 'contexto-historico', label: 'Contexto histórico', icon: '📜' },
  { id: 'temas-relacionados', label: 'Temas relacionados', icon: '🔗' },
  { id: 'referencias-cruzadas', label: 'Referências cruzadas', icon: '📖' },
  { id: 'perguntas-de-estudo', label: 'Perguntas de estudo', icon: '❓' },
  { id: 'estrutura-de-estudo', label: 'Estrutura de estudo', icon: '📋' },
];

interface Props {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  passage: string;
  translation: string;
  onNavigate: () => void;
}

export function AiContent({
  reference, passage, translation, onNavigate,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResponse | null>(null);
  const [error, setError] = useState('');
  const [activeTask, setActiveTask] = useState<AiTaskKind | null>(null);
  const abortRef = useRef(false);

  const goToRef = useCallback((ref: string) => {
    const parsed = parseReference(ref);
    if (!parsed) return;
    onNavigate();
    navigate(`/biblia/${parsed.book}/${parsed.chapter}${parsed.verse ? `?v=${parsed.verse}` : ''}`);
  }, [navigate, onNavigate]);

  const runTask = useCallback(async (task: AiTaskKind) => {
    const provider = getAiProvider();
    if (!provider) return;

    abortRef.current = false;
    setActiveTask(task);
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await provider.run({
        task,
        translation,
        reference,
        passage,
      });
      if (!abortRef.current) setResult(response);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Erro ao analisar a passagem.');
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [translation, reference, passage]);

  const handleBack = () => {
    abortRef.current = true;
    setActiveTask(null);
    setResult(null);
    setError('');
    setLoading(false);
  };

  if (!isAiEnabled()) {
    return (
      <div className="stack" style={{ padding: 'var(--sp-4)' }}>
        <p className="dim" style={{ textAlign: 'center' }}>
          O estudo guiado não está configurado.
        </p>
        <p className="small dim" style={{ textAlign: 'center' }}>
          Ative nas <strong>Configurações → Estudo guiado</strong> com sua chave de API do Google Gemini ou OpenAI.
        </p>
      </div>
    );
  }

  if (activeTask) {
    return (
      <div className="stack" style={{ padding: 'var(--sp-3)', gap: 'var(--sp-3)' }}>
        <button className="btn btn-ghost btn-sm" onClick={handleBack} style={{ alignSelf: 'flex-start' }}>
          <Icon name="chevron-left" size={16} />
          <span>Voltar</span>
        </button>

        <p className="small dim" style={{ margin: 0 }}>
          {TASKS.find((t) => t.id === activeTask)?.label} — {reference}
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
            <button className="btn btn-sm" onClick={() => runTask(activeTask)} style={{ marginTop: 'var(--sp-2)' }}>
              Tentar novamente
            </button>
          </div>
        )}

        {result && (
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
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
                      className="chip chip-sm"
                      onClick={() => goToRef(ref)}
                      style={{ cursor: 'pointer' }}
                    >
                      {ref}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="small dim" style={{ fontStyle: 'italic', margin: 0 }}>
              {result.disclaimer}
            </p>
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
        {TASKS.map((task) => (
          <button
            key={task.id}
            className="ai-task-btn"
            onClick={() => runTask(task.id)}
          >
            <span className="ai-task-icon">{task.icon}</span>
            <span>{task.label}</span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
      </div>

      <p className="small dim" style={{ margin: 0, marginTop: 'var(--sp-2)' }}>
        A análise gera comentários sobre a passagem. O texto bíblico vem sempre do repositório local.
      </p>
    </div>
  );
}
