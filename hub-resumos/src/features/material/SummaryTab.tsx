import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { EmptyState } from '../../components/ui';
import { listActions } from '../../core/actions';
import { getGeminiConfig } from '../../core/ai';
import { downloadBlob, downloadText, safeName } from '../../core/backup';
import { createMaterial } from '../../core/materials';
import {
  buildModeByRules,
  buildModeWithAi,
  DEPTH_LABEL,
  KIND_LABEL,
  MODE_HINT,
  MODE_LABEL,
  modeMarkdown,
  modeWordHtml,
  saveModeSummary,
  summaryKey,
} from '../../core/summaryModes';
import type { MaterialReading } from '../../core/text';
import type { ActionItem, Material, ModeBlock, StudyKind, SummaryDepth, SummaryMode } from '../../core/types';
import { SeeInText } from '../layers/common';
import { AiPanel } from './AiPanel';
import { WithRefs } from './RichText';

const PREF = 'hub-resumos:resumo-preferencias';
function loadPref(): { mode: SummaryMode; kind: StudyKind; depth: SummaryDepth } {
  try {
    return { mode: 'executivo', kind: 'biblico', depth: 'normal', ...JSON.parse(localStorage.getItem(PREF) ?? '{}') };
  } catch {
    return { mode: 'executivo', kind: 'biblico', depth: 'normal' };
  }
}

/**
 * Resumo completo, em cinco modalidades (Prompt Mestre, item 2), com a
 * profundidade e o tipo de estudo escolhidos. Sem IA, frases do próprio texto;
 * com IA, cada modalidade tem o seu pedido e o resultado fica guardado.
 */
export function SummaryTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [pref, setPref] = useState(loadPref);
  const { mode, kind, depth } = pref;
  const set = (patch: Partial<typeof pref>) =>
    setPref((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREF, JSON.stringify(next));
      } catch {
        /* sem armazenamento: só não lembra a escolha */
      }
      return next;
    });
  const aiOn = useLiveQuery(async () => !!(await getGeminiConfig()).key, [], false);
  const actions = useLiveQuery(() => listActions(material.id), [material.id], [] as ActionItem[]);
  const key = summaryKey(mode, kind, depth);
  const saved = material.summaries?.[key];
  const rules = useMemo(() => buildModeByRules(material, mode, depth, reading, actions), [material, mode, depth, reading, actions]);
  const summary = saved ?? rules;
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  if (!reading.sections.some((s) => s.section.text.trim()))
    return (
      <EmptyState
        icon="text"
        title="Ainda não há texto para resumir"
        description="Escreva ou cole o conteúdo na aba Editar e volte aqui."
        action={
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/m/${material.id}?aba=editar`)}>
            Escrever o conteúdo
          </button>
        }
      />
    );

  const runAi = async () => {
    abort.current = new AbortController();
    setBusy(true);
    try {
      const s = await buildModeWithAi(material, mode, kind, depth, { signal: abort.current.signal });
      await saveModeSummary(material.id, s, key);
      notify(`A IA escreveu o resumo ${MODE_LABEL[mode].toLowerCase()}. Revise antes de usar.`);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const fileName = `${safeName(material.title)} - resumo ${MODE_LABEL[mode].toLowerCase()}`;

  return (
    <div className="stack">
      <section className="xr-panel no-print">
        <span className="xr-eyebrow">Modalidade</span>
        <div className="chip-row xr-wrap" role="group" aria-label="Modalidade do resumo">
          {(Object.keys(MODE_LABEL) as SummaryMode[]).map((m) => (
            <button key={m} className={`chip${mode === m ? ' active' : ''}`} aria-pressed={mode === m} onClick={() => set({ mode: m })}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="small dim" style={{ margin: 0 }}>
          {MODE_HINT[mode]}
        </p>
        <div className="row row-wrap" style={{ gap: 'var(--sp-3)' }}>
          <div className="chip-row" role="group" aria-label="Profundidade">
            {(Object.keys(DEPTH_LABEL) as SummaryDepth[]).map((d) => (
              <button key={d} className={`chip${depth === d ? ' active' : ''}`} aria-pressed={depth === d} onClick={() => set({ depth: d })}>
                {DEPTH_LABEL[d]}
              </button>
            ))}
          </div>
          <label className="row" style={{ gap: 8 }}>
            <span className="small">Tipo de estudo</span>
            <select className="input" style={{ width: 'auto', minHeight: 44 }} value={kind} onChange={(e) => set({ kind: e.target.value as StudyKind })}>
              {(Object.keys(KIND_LABEL) as StudyKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="xr-briefbar no-print">
        <span className={`xr-brief-src${summary.source === 'ia' ? ' is-ia' : ''}`}>
          {summary.source === 'ia' ? (
            <>
              <Icon name="sparkle" size={14} /> Feito pela IA ({summary.model}) · {KIND_LABEL[summary.kind]} — revise antes de usar
            </>
          ) : (
            <>Frases do próprio texto (sem IA){kind !== 'biblico' || mode === 'analitico' ? ' · o tipo de estudo vale para a IA' : ''}</>
          )}
        </span>
        <span className="spacer" />
        {busy ? (
          <>
            <span className="small" role="status">
              A IA está lendo o material inteiro…
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => abort.current?.abort()}>
              Parar
            </button>
          </>
        ) : (
          <>
            {aiOn ? (
              <button className="btn btn-primary btn-sm" onClick={runAi}>
                <Icon name="sparkle" size={14} /> {saved ? 'Refazer com IA' : 'Gerar com IA'}
              </button>
            ) : (
              <button className="btn btn-sm" onClick={() => navigate('/config#ia')}>
                Ligar a IA
              </button>
            )}
            <button className="btn btn-sm" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                downloadBlob(new Blob(['﻿', modeWordHtml(material.title, material.author, summary)], { type: 'application/msword' }), `${fileName}.doc`);
                notify('Documento do Word baixado.');
              }}
            >
              Word
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                downloadText(modeMarkdown(material.title, summary), `${fileName}.md`);
                notify('Resumo baixado (.md).');
              }}
            >
              .md
            </button>
            {saved && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await saveModeSummary(material.id, null, key);
                  notify('Voltou ao resumo com as frases do texto.');
                }}
              >
                Voltar ao do texto
              </button>
            )}
          </>
        )}
      </div>

      <article className="card stack xr-mode">
        <h2 className="xr-h2" style={{ margin: 0 }}>
          Resumo {MODE_LABEL[mode].toLowerCase()} · {DEPTH_LABEL[summary.depth].toLowerCase()}
        </h2>
        {summary.blocks.map((b, i) => (
          <BlockView key={i} block={b} material={material} level={3} />
        ))}
      </article>

      <div className="row row-wrap no-print">
        <button
          className="btn"
          onClick={async () => {
            const m = await createMaterial({
              title: `Resumo ${MODE_LABEL[mode].toLowerCase()} — ${material.title}`,
              kind: 'resumo',
              author: material.author,
              sections: summary.blocks.map((b) => ({ title: b.heading, text: blockText(b) })),
              source: { type: 'resumo-gerado', materialId: material.id, name: material.title },
            });
            notify('Resumo salvo como novo material. Revise e complete.');
            navigate(`/m/${m.id}?aba=editar`);
          }}
        >
          Salvar como novo material
        </button>
      </div>

      <details className="card xr-ai-card no-print">
        <summary className="xr-help-item-summary">Resumo da IA por capítulo para o Passo a passo</summary>
        <AiPanel material={material} />
      </details>
    </div>
  );
}

function blockText(b: ModeBlock): string {
  return [b.text ?? '', ...(b.items ?? []).map((x) => `- ${x}`), ...(b.parts ?? []).flatMap((p) => [`> ${p.heading}`, blockText(p)])].filter(Boolean).join('\n');
}

function BlockView({ block, material, level }: { block: ModeBlock; material: Material; level: 3 | 4 }) {
  const H = `h${level}` as const;
  return (
    <section className={`stack xr-mode-block${level === 4 ? ' is-part' : ''}`} style={{ gap: 6 }}>
      <H className="xr-mode-h">{block.heading}</H>
      {block.text && (
        <p className="xr-p" style={{ margin: 0 }}>
          <WithRefs text={block.text} />
        </p>
      )}
      {block.items && block.items.length > 0 && (
        <ul className="xr-ai-list">
          {block.items.map((x, i) => (
            <li key={i}>
              <WithRefs text={x} />
            </li>
          ))}
        </ul>
      )}
      {block.parts?.map((p, i) => (
        <BlockView key={i} block={p} material={material} level={4} />
      ))}
      {block.section && level === 3 && (
        <span className="xr-meta no-print">
          <SeeInText material={material} section={block.section} />
        </span>
      )}
    </section>
  );
}
