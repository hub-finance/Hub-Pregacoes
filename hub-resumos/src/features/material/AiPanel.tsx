import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ui';
import { addActions } from '../../core/actions';
import { aiSummaryMarkdown, getGeminiConfig, removeAiSummary, summarizeWithAi, WHOLE } from '../../core/ai';
import { downloadText, safeName } from '../../core/backup';
import type { AiSummary, Material } from '../../core/types';

/** O que a IA escreveu sobre um escopo, sempre com o selo “feito pela IA”. */
export function AiSummaryView({ summary, compact }: { summary: AiSummary; compact?: boolean }) {
  return (
    <div className="stack xr-ai" style={{ gap: 'var(--sp-3)' }}>
      <span className="xr-ai-badge">
        <Icon name="sparkle" size={14} /> Feito pela IA ({summary.model}) · revise antes de usar
      </span>
      <div className="stack" style={{ gap: 'var(--sp-2)' }}>
        {summary.resumo
          .split(/\n{1,}/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i} className="xr-p" style={{ margin: 0 }}>
              {p}
            </p>
          ))}
      </div>
      {!compact && <AiList title="Ideias principais" items={summary.ideias} />}
      <AiList title="Aplicações" items={summary.aplicacoes} />
      {!compact && <AiList title="Perguntas para reflexão" items={summary.perguntas} />}
      {!compact && summary.conceitos.length > 0 && (
        <div className="stack" style={{ gap: 'var(--sp-1)' }}>
          <strong className="small">Conceitos</strong>
          <dl className="xr-glossary">
            {summary.conceitos.map((c) => (
              <div key={c.termo}>
                <dt>{c.termo}</dt>
                <dd>{c.definicao}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function AiList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="stack" style={{ gap: 'var(--sp-1)' }}>
      <strong className="small">{title}</strong>
      <ul className="xr-ai-list">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Resumo com IA (opcional): o material inteiro ou capítulo por capítulo.
 * Sem a chave do Gemini, mostra só como ligar.
 */
export function AiPanel({ material }: { material: Material }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const config = useLiveQuery(() => getGeminiConfig(), []);
  const [scope, setScope] = useState<string>(WHOLE);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (!config) return null;
  if (!config.key)
    return (
      <section className="card stack xr-ai-card">
        <strong>
          <Icon name="sparkle" size={16} /> Resumo com IA (opcional)
        </strong>
        <span className="small muted">
          Com a IA do Google (Gemini), o app resume o livro e cada capítulo com as próprias palavras: resumo, ideias
          principais, aplicações, perguntas e conceitos. É só cadastrar uma chave, uma vez.
        </span>
        <div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/config#ia')}>
            Ligar a IA em Dados e ajustes
          </button>
        </div>
      </section>
    );

  const done = material.ai ?? {};
  const current = done[scope];
  const scopes = [{ id: WHOLE, title: `${material.kind === 'livro' ? 'Livro' : 'Material'} inteiro` }, ...material.sections.map((s, i) => ({ id: s.id, title: s.title || `Parte ${i + 1}` }))];
  const missing = material.sections.filter((s) => s.text.trim() && !done[s.id]);

  const run = async (ids: string[]) => {
    abort.current = new AbortController();
    try {
      for (let i = 0; i < ids.length; i++) {
        const label = scopes.find((s) => s.id === ids[i])?.title ?? '';
        setBusy(ids.length > 1 ? `Resumindo ${i + 1} de ${ids.length}: ${label}…` : 'A IA está lendo e resumindo…');
        try {
          await summarizeWithAi(material.id, ids[i], { signal: abort.current.signal });
        } catch (err) {
          // limite por minuto da conta gratuita: espera e tenta mais uma vez
          if (/limite de uso/i.test((err as Error).message) && ids.length > 1) {
            setBusy(`Limite do Gemini atingido; continuando em 30 segundos (${i + 1} de ${ids.length})…`);
            await new Promise((r) => setTimeout(r, 30_000));
            await summarizeWithAi(material.id, ids[i], { signal: abort.current.signal });
          } else throw err;
        }
      }
      notify(ids.length > 1 ? `${ids.length} capítulos resumidos pela IA.` : 'Resumo da IA pronto. Revise antes de usar.');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') notify((err as Error).message, 'error');
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  return (
    <section className="card stack xr-ai-card">
      <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
        <strong>
          <Icon name="sparkle" size={16} /> Resumo com IA
        </strong>
        <span className="small dim">
          {Object.keys(done).length} de {scopes.length} resumidos
        </span>
      </div>
      <div className="row row-wrap">
        <label className="field" style={{ flex: '1 1 260px', margin: 0 }}>
          <span>O que resumir</span>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)} disabled={!!busy}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {done[s.id] ? '✓ ' : ''}
                {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {busy ? (
        <div className="row row-wrap" role="status" aria-live="polite">
          <span className="small">{busy}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
            Parar
          </button>
        </div>
      ) : (
        <div className="row row-wrap">
          <button className="btn btn-primary" onClick={() => run([scope])}>
            {current ? 'Gerar de novo' : 'Resumir com IA'}
          </button>
          {missing.length > 1 && (
            <button className="btn" onClick={() => run(missing.map((s) => s.id))}>
              Resumir os {missing.length} capítulos que faltam
            </button>
          )}
        </div>
      )}

      {current && (
        <>
          <AiSummaryView summary={current} />
          <div className="row row-wrap">
            <button
              className="btn btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(aiSummaryMarkdown(current, material.title));
                  notify('Resumo copiado.');
                } catch {
                  notify('Não foi possível copiar neste aparelho.', 'error');
                }
              }}
            >
              Copiar
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                downloadText(aiSummaryMarkdown(current, material.title), `${safeName(material.title)} - ${safeName(current.scopeTitle)} - resumo IA.md`);
                notify('Resumo baixado (.md).');
              }}
            >
              Baixar (.md)
            </button>
            {current.aplicacoes.length > 0 && (
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const sectionId = scope === WHOLE ? material.sections[0]?.id ?? '' : scope;
                  await addActions(material.id, current.aplicacoes.map((text) => ({ sectionId, text })));
                  notify('Aplicações levadas ao plano de ação.');
                }}
              >
                Levar aplicações ao plano de ação
              </button>
            )}
            <button className="btn btn-sm btn-ghost xr-danger" onClick={() => setRemoving(true)}>
              Apagar este resumo
            </button>
          </div>
        </>
      )}
      <span className="small dim">
        O texto vai deste aparelho direto para o Google. O resumo da IA fica separado do texto original e pode ser apagado a
        qualquer momento.
      </span>
      <ConfirmDialog
        open={removing}
        title="Apagar o resumo da IA?"
        message="Só o resumo feito pela IA para esta parte é apagado. O texto do material não muda."
        confirmLabel="Apagar"
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          await removeAiSummary(material.id, scope);
          setRemoving(false);
          notify('Resumo da IA apagado.');
        }}
      />
    </section>
  );
}
