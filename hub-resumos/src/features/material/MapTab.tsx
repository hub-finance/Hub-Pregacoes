import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { listActions } from '../../core/actions';
import { downloadBlob, safeName } from '../../core/backup';
import { buildMindMap, MIND_TYPE_LABEL } from '../../core/mindmap';
import type { MaterialReading } from '../../core/text';
import type { ActionItem, Material } from '../../core/types';
import type { MindMapHandle } from '../mindmap/engine.js';
import { MindMapView } from '../mindmap/MindMapView';
import { mindMapHtml } from '../mindmap/standalone';

/**
 * Mapa mental interativo: cada assunto do material com todos os seus
 * desdobramentos, tirados do próprio texto, sem resumo.
 */
export function MapTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { notify } = useToast();
  const actions = useLiveQuery(() => listActions(material.id), [material.id], [] as ActionItem[]);
  // só refaz o mapa quando as ações abertas mudam de verdade
  const openKey = actions.filter((a) => a.status !== 'feito').map((a) => `${a.id}|${a.text}|${a.owner}|${a.due}`).join('~');
  const data = useMemo(
    () => buildMindMap(material, reading, actions),
    [material, reading, openKey],
  );
  const handle = useRef<MindMapHandle | null>(null);
  const onReady = useCallback((m: MindMapHandle | null) => {
    handle.current = m;
  }, []);
  const total = data.modules.reduce((n, m) => n + m.children.length, 0);
  const name = safeName(material.title);

  if (!data.modules.length)
    return (
      <div className="empty">
        <strong>O mapa precisa de partes no texto</strong>
        <span className="small muted">Divida o material em partes (aba Editar, um título por parte) e cada uma vira um assunto do mapa.</span>
      </div>
    );

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        No centro, o material; em volta, os {data.modules.length} assuntos; toque num assunto para abrir os desdobramentos ({total} no
        total) e toque em qualquer círculo para ler o trecho inteiro. Nada é resumido: cada desdobramento é o texto do próprio material.
      </p>

      <MindMapView data={data} onReady={onReady} />

      <div className="row row-wrap">
        <button
          className="btn"
          onClick={() => {
            downloadBlob(new Blob([mindMapHtml(data)], { type: 'text/html;charset=utf-8' }), `${name} - mapa mental.html`);
            notify('Mapa baixado. Abre em qualquer navegador, mesmo sem internet.');
          }}
        >
          Baixar mapa interativo (.html)
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const url = handle.current?.toPNG(3200);
            if (!url) return;
            downloadBlob(await (await fetch(url)).blob(), `${name} - mapa mental.png`);
          }}
        >
          Baixar imagem (PNG)
        </button>
      </div>

      <section className="card stack" style={{ gap: 'var(--sp-2)' }}>
        <strong>Todos os desdobramentos, em texto</strong>
        <span className="small muted">O mesmo conteúdo do mapa, para ler em sequência.</span>
        {data.modules.map((m) => (
          <details key={m.id} className="xr-mm-list">
            <summary>
              <span className="xr-mm-dot" style={{ background: m.color }} />
              {m.tip.title} <span className="small muted">· {m.children.length}</span>
            </summary>
            <ul>
              {m.children.map((c, i) => (
                <li key={i}>
                  <span className="xr-mm-dot" style={{ background: c.color }} title={MIND_TYPE_LABEL[c.type]} />
                  <div>
                    <strong className="small">{c.tip.title}</strong>
                    <p>{c.tip.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  );
}
