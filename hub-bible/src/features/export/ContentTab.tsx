import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, TextInput } from '../../components/ui';
import { htmlToPlain } from '../../core/data/sermonContent';
import type { ExportDoc, ExportStructure, SermonBlock } from '../../core/db/types';
import { SOURCE_LABEL, sourceRoute } from '../../core/export/sources';
import { SermonBlocksEditor } from '../sermons/SermonBlocksEditor';

interface Props {
  doc: ExportDoc;
  set: (patch: Partial<Pick<ExportDoc, 'title' | 'content' | 'structure'>>) => void;
  onRestoreOriginal: () => void;
}

/** Seções do documento: cada subtítulo e os blocos que vêm depois dele. */
function sectionsOf(content: SermonBlock[]) {
  const out: Array<{ block: SermonBlock; start: number; end: number }> = [];
  content.forEach((b, i) => {
    if (b.type !== 'section') return;
    if (out.length) out[out.length - 1].end = i;
    out.push({ block: b, start: i, end: content.length });
  });
  return out;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/**
 * Revisão do conteúdo: título, estrutura (títulos, subtítulos, quebras de
 * página, ordem das seções) e o texto em blocos, no mesmo editor do Gerador.
 */
export function ContentTab({ doc, set, onRestoreOriginal }: Props) {
  const navigate = useNavigate();
  const [confirmRestore, setConfirmRestore] = useState(false);
  const sections = sectionsOf(doc.content);
  const { structure } = doc;
  const route = sourceRoute(doc.source);

  const setStructure = (patch: Partial<ExportStructure>) => set({ structure: { ...structure, ...patch } });

  /** Move a seção inteira (o subtítulo e o que vem abaixo dele) uma posição. */
  const moveSection = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const a = sections[Math.min(index, target)];
    const b = sections[Math.max(index, target)];
    const content = doc.content;
    set({
      content: [
        ...content.slice(0, a.start),
        ...content.slice(b.start, b.end),
        ...content.slice(a.start, a.end),
        ...content.slice(b.end),
      ],
    });
  };

  return (
    <div className="stack">
      <TextInput label="Título do documento" value={doc.title} onChange={(title) => set({ title })} />

      <div className="notice">
        <Icon name="info" size={18} />
        <span>
          Origem: <strong>{SOURCE_LABEL[doc.source.kind]}</strong>
          {doc.source.kind !== 'blank' && doc.source.title ? ` — ${doc.source.title}` : ''}. As alterações feitas
          aqui valem só para este documento; o conteúdo de origem não muda.{' '}
          {route && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(route)}>
              Abrir origem
            </button>
          )}
        </span>
      </div>

      <section className="card stack" aria-labelledby="xp-structure">
        <div className="row">
          <h2 id="xp-structure" className="card-title" style={{ margin: 0 }}>
            Estrutura
          </h2>
          <span className="spacer" />
          <span className="small dim">{sections.length} seç{sections.length === 1 ? 'ão' : 'ões'}</span>
        </div>
        {!sections.length ? (
          <p className="small dim" style={{ margin: 0 }}>
            Sem seções ainda. Use o “+” do editor abaixo para incluir títulos (Introdução, Desenvolvimento…); eles
            formam o sumário e a estrutura do arquivo.
          </p>
        ) : (
          <div className="xp-outline">
            {sections.map((s, i) => {
              const sub = structure.subheadings.includes(s.block.id);
              const brk = structure.pageBreaks.includes(s.block.id);
              const title = htmlToPlain(s.block.html) || 'Seção sem título';
              return (
                <div key={s.block.id} className={`xp-outline-row${sub ? ' sub' : ''}`}>
                  <span className="xp-outline-title" title={title}>
                    {title}
                  </span>
                  <button
                    className={`chip${sub ? ' active' : ''}`}
                    aria-pressed={sub}
                    onClick={() => setStructure({ subheadings: toggle(structure.subheadings, s.block.id) })}
                    title="Alternar entre título e subtítulo"
                  >
                    {sub ? 'Subtítulo' : 'Título'}
                  </button>
                  <button
                    className={`chip${brk ? ' active' : ''}`}
                    aria-pressed={brk}
                    onClick={() => setStructure({ pageBreaks: toggle(structure.pageBreaks, s.block.id) })}
                    title="Começar esta seção em página nova"
                  >
                    Nova página
                  </button>
                  <button className="icon-btn" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label={`Subir a seção ${title}`}>
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => moveSection(i, 1)}
                    disabled={i === sections.length - 1}
                    aria-label={`Descer a seção ${title}`}
                  >
                    ↓
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="stack" aria-label="Conteúdo">
        <div className="row row-wrap">
          <h2 className="card-title" style={{ margin: 0 }}>
            Conteúdo
          </h2>
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirmRestore(true)} disabled={!doc.original.length}>
            Restaurar texto original
          </button>
        </div>
        <p className="small dim" style={{ margin: 0 }}>
          Tabela: num parágrafo, escreva uma linha por linha da tabela, com as colunas separadas por “|” — por exemplo{' '}
          <code>| Data | Atividade |</code>.
        </p>
        <SermonBlocksEditor blocks={doc.content} onChange={(content) => set({ content })} />
      </section>

      <ConfirmDialog
        open={confirmRestore}
        title="Restaurar texto original"
        message="O conteúdo volta a ser exatamente o que veio da origem, e os ajustes de estrutura são desfeitos. As versões aprovadas e os arquivos gerados continuam guardados."
        confirmLabel="Restaurar"
        onCancel={() => setConfirmRestore(false)}
        onConfirm={() => {
          setConfirmRestore(false);
          onRestoreOriginal();
        }}
      />
    </div>
  );
}
