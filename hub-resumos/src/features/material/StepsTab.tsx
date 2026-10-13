import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { SaveStatus } from '../../components/SaveStatus';
import { EmptyState } from '../../components/ui';
import { getProgress, PART_LABEL, progressRatio, setCurrentStep, setStepDone, setStepNote } from '../../core/materials';
import type { Material } from '../../core/types';
import { AiSummaryView } from './AiPanel';
import { RichText } from './RichText';

/**
 * Passo a passo: o material conduzido parte por parte. A visão geral mostra o
 * caminho inteiro; cada passo traz o texto, um espaço de anotação pessoal e o
 * "concluir e seguir". O andamento fica gravado e o app volta de onde parou.
 */
export function StepsTab({ material }: { material: Material }) {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const progress = useLiveQuery(() => getProgress(material.id), [material.id]);
  const stepId = params.get('passo');
  const index = material.sections.findIndex((s) => s.id === stepId);
  const section = index >= 0 ? material.sections[index] : null;
  const [note, setNote] = useState('');
  // guarda de qual passo é a hora, para não mostrar "Salvo" de outro passo
  const [noteSaved, setNoteSaved] = useState<{ id: string; at: number } | null>(null);

  useEffect(() => {
    if (section && progress) setNote(progress.notes[section.id] ?? '');
    if (section) void setCurrentStep(material.id, section.id);
    // só ao trocar de passo (ou quando o andamento termina de carregar)
  }, [section?.id, progress === undefined]);

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('passo', id);
    else next.delete('passo');
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  if (!material.sections.length) {
    return (
      <EmptyState
        icon="list"
        title="Ainda não há partes para estudar"
        description="O passo a passo mostra uma parte do texto por vez. Escreva ou cole o conteúdo na aba Editar, com um título para cada parte."
        action={
          <button className="btn btn-primary btn-sm" onClick={() => setParams({ aba: 'editar' })}>
            Escrever o conteúdo
          </button>
        }
      />
    );
  }

  const done = new Set(progress?.done ?? []);
  const ratio = progressRatio(material, progress);
  const part = PART_LABEL[material.kind];

  if (!section) {
    const resume = material.sections.find((s) => s.id === progress?.current) ?? material.sections.find((s) => !done.has(s.id));
    return (
      <div className="stack">
        <div className="row row-wrap">
          <span className="xr-bar xr-bar-lg" style={{ flex: '1 1 200px' }} role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento">
            <i style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
          <span className="small dim">{Math.round(ratio * 100)}%</span>
          {resume && (
            <button className="btn btn-primary" onClick={() => open(resume.id)}>
              {done.size ? 'Continuar' : 'Começar'} →
            </button>
          )}
        </div>
        <ol className="xr-steps">
          {material.sections.map((s, i) => (
            <li key={s.id} className={done.has(s.id) ? 'done' : ''}>
              <button className="xr-step" onClick={() => open(s.id)}>
                <span className="xr-step-num" aria-hidden="true">
                  {done.has(s.id) ? <Icon name="check" size={16} /> : i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong className="clamp-2" style={{ display: 'block' }}>
                    {s.title || `${part} ${i + 1}`}
                  </strong>
                  <span className="small dim">
                    {done.has(s.id) ? 'Concluído' : 'A estudar'}
                    {progress?.notes[s.id] ? ' · com anotação' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const isDone = done.has(section.id);
  const prev = material.sections[index - 1];
  const next = material.sections[index + 1];

  const saveNote = async () => {
    if ((progress?.notes[section.id] ?? '') === note) return;
    await setStepNote(material.id, section.id, note);
    setNoteSaved({ id: section.id, at: Date.now() });
  };

  return (
    <div className="stack">
      <div className="row row-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => open(null)}>
          ← Todas as partes
        </button>
        <span className="spacer" />
        <span className="small dim">
          Passo {index + 1} de {material.sections.length}
        </span>
      </div>
      <span className="xr-bar" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento">
        <i style={{ width: `${Math.round(ratio * 100)}%` }} />
      </span>

      <article className="card stack">
        <h2 className="xr-step-title">{section.title || `${part} ${index + 1}`}</h2>
        <RichText text={section.text} />
      </article>

      {material.ai?.[section.id] && (
        <details className="card xr-ai-card">
          <summary className="xr-help-item-summary">Resumo da IA deste {part.toLowerCase()}</summary>
          <AiSummaryView summary={material.ai[section.id]} compact />
        </details>
      )}

      <label className="field">
        <span>Minha anotação neste passo</span>
        <textarea className="textarea" rows={4} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="O que Deus falou comigo, dúvidas, como aplicar…" />
      </label>
      <SaveStatus pending={(progress?.notes[section.id] ?? '') !== note} savedAt={noteSaved?.id === section.id ? noteSaved.at : null} />

      <div className="row row-wrap">
        <button className="btn" onClick={async () => {
          await saveNote();
          if (prev) open(prev.id);
        }} disabled={!prev}>
          ← Anterior
        </button>
        <span className="spacer" />
        {isDone ? (
          <button className="btn btn-ghost" onClick={() => setStepDone(material.id, section.id, false)}>
            Desmarcar
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          onClick={async () => {
            await saveNote();
            await setStepDone(material.id, section.id, true);
            if (next) open(next.id);
            else {
              notify('Material concluído! Revise os cartões para fixar.');
              open(null);
            }
          }}
        >
          {isDone ? (next ? 'Próximo →' : 'Concluir') : next ? 'Concluir e seguir →' : 'Concluir o estudo'}
        </button>
      </div>
    </div>
  );
}
