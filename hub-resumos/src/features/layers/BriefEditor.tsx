import { useEffect, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { saveBrief } from '../../core/brief';
import type { BriefCardKind, Material, StudyBrief } from '../../core/types';

const KIND_LABEL: Record<BriefCardKind, string> = { biblico: 'Bíblico', principio: 'Princípio', conexao: 'Conexão', revisao: 'Revisão' };
const lines = (v: string) => v.split('\n').map((x) => x.trim()).filter(Boolean);

/** Editar a estrutura do estudo antes de usar ou exportar (regra 10 da auditoria). */
export function BriefEditor({ open, material, brief, onClose }: { open: boolean; material: Material; brief: StudyBrief; onClose: () => void }) {
  const { notify } = useToast();
  const [d, setD] = useState<StudyBrief>(brief);
  useEffect(() => {
    if (open) setD(structuredClone(brief));
  }, [open, brief]);
  const set = (patch: Partial<StudyBrief>) => setD((x) => ({ ...x, ...patch }));

  const save = async () => {
    const clean: StudyBrief = {
      ...d,
      steps: d.steps.filter((s) => s.title.trim()),
      cards: d.cards.filter((c) => c.front.trim() && c.back.trim()),
      dna: { ...d.dna, rows: d.dna.rows.filter((r) => r.principle.trim()) },
      branches: d.branches.filter((b) => b.label.trim()),
      editedAt: Date.now(),
    };
    await saveBrief(material.id, clean);
    notify('Estrutura salva. Todos os quadros já usam a versão revisada.');
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="Editar a estrutura do estudo"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save} style={{ flex: 1 }}>
            Salvar estrutura
          </button>
        </>
      }
    >
      <div className="stack xr-brief-edit">
        <p className="small muted" style={{ margin: 0 }}>
          Tudo o que aparece em Captar, Compreender, Aprofundar, Aplicar e DNA sai daqui. Ajuste as palavras, tire o que não
          ajuda e acrescente o que faltar. Frases curtas e completas.
        </p>

        <fieldset>
          <legend>Captar</legend>
          <Field label="Tese (a mensagem central)" value={d.thesis} onChange={(thesis) => set({ thesis })} rows={2} />
          <Field label="Síntese (30 a 60 segundos)" value={d.synthesis} onChange={(synthesis) => set({ synthesis })} rows={3} />
          <Field label="Objetivo" value={d.objective} onChange={(objective) => set({ objective })} rows={2} />
          <Field label="Texto-base (separe por vírgula)" value={d.baseText.join(', ')} onChange={(v) => set({ baseText: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
          <Field
            label="Principais verdades (uma por linha)"
            value={d.truths.map((t) => t.text).join('\n')}
            rows={4}
            onChange={(v) => set({ truths: lines(v).map((text, i) => ({ text, section: d.truths[i]?.section ?? '', origin: d.truths[i]?.text === text ? d.truths[i].origin : 'texto' })) })}
          />
        </fieldset>

        <fieldset>
          <legend>Compreender — progressão (fluxograma)</legend>
          {d.steps.map((s, i) => (
            <div key={i} className="xr-edit-row">
              <span className="xr-edit-n">{i + 1}</span>
              <div className="stack" style={{ gap: 6, flex: 1 }}>
                <input className="input" value={s.title} placeholder="Etapa (2 a 5 palavras)" aria-label={`Etapa ${i + 1}`} onChange={(e) => set({ steps: d.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <input className="input" value={s.question} placeholder="Pergunta que ela responde" aria-label={`Pergunta da etapa ${i + 1}`} onChange={(e) => set({ steps: d.steps.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
                <textarea className="textarea" rows={2} value={s.explanation} placeholder="Explicação em uma frase" aria-label={`Explicação da etapa ${i + 1}`} onChange={(e) => set({ steps: d.steps.map((x, j) => (j === i ? { ...x, explanation: e.target.value } : x)) })} />
                <input className="input" value={s.link} placeholder="Ligação com a próxima (ex.: gera, alimenta)" aria-label={`Ligação da etapa ${i + 1}`} onChange={(e) => set({ steps: d.steps.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)) })} />
              </div>
              <RowTools i={i} n={d.steps.length} onMove={(a, b) => set({ steps: move(d.steps, a, b) })} onRemove={() => set({ steps: d.steps.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => set({ steps: [...d.steps, { title: '', question: '', explanation: '', link: '', refs: [], section: '', origin: 'texto' }] })}>
            ＋ Etapa
          </button>
        </fieldset>

        <fieldset>
          <legend>Compreender — ramos do mapa mental</legend>
          {d.branches.map((b, i) => (
            <div key={i} className="xr-edit-row">
              <span className="xr-edit-n">{i + 1}</span>
              <div className="stack" style={{ gap: 6, flex: 1 }}>
                <input className="input" value={b.label} placeholder="Ramo (1 a 3 palavras)" aria-label={`Ramo ${i + 1}`} onChange={(e) => set({ branches: d.branches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input className="input" value={b.summary} placeholder="Resumo do ramo" aria-label={`Resumo do ramo ${i + 1}`} onChange={(e) => set({ branches: d.branches.map((x, j) => (j === i ? { ...x, summary: e.target.value } : x)) })} />
                <textarea
                  className="textarea"
                  rows={3}
                  aria-label={`Folhas do ramo ${i + 1}`}
                  placeholder={'Uma folha por linha: Rótulo: detalhe'}
                  value={b.leaves.map((l) => `${l.label}: ${l.detail}`).join('\n')}
                  onChange={(e) =>
                    set({
                      branches: d.branches.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              leaves: lines(e.target.value).map((ln, k) => {
                                const at = ln.indexOf(':');
                                const label = at > 0 ? ln.slice(0, at).trim() : ln;
                                return { label, detail: at > 0 ? ln.slice(at + 1).trim() : '', ref: x.leaves[k]?.label === label ? x.leaves[k].ref : undefined };
                              }),
                            }
                          : x,
                      ),
                    })
                  }
                />
              </div>
              <RowTools i={i} n={d.branches.length} onMove={(a, c) => set({ branches: move(d.branches, a, c) })} onRemove={() => set({ branches: d.branches.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => set({ branches: [...d.branches, { label: '', summary: '', leaves: [], section: '' }] })}>
            ＋ Ramo
          </button>
        </fieldset>

        <fieldset>
          <legend>Aprofundar e Aplicar — cartões</legend>
          {d.cards.map((c, i) => (
            <div key={i} className="xr-edit-row">
              <select className="input" style={{ width: 'auto' }} value={c.kind} aria-label={`Tipo do cartão ${i + 1}`} onChange={(e) => set({ cards: d.cards.map((x, j) => (j === i ? { ...x, kind: e.target.value as BriefCardKind } : x)) })}>
                {(Object.keys(KIND_LABEL) as BriefCardKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <div className="stack" style={{ gap: 6, flex: 1 }}>
                <input className="input" value={c.front} placeholder="Frente" aria-label={`Frente do cartão ${i + 1}`} onChange={(e) => set({ cards: d.cards.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)) })} />
                <textarea className="textarea" rows={2} value={c.back} placeholder="Verso" aria-label={`Verso do cartão ${i + 1}`} onChange={(e) => set({ cards: d.cards.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)) })} />
                <input className="input" value={c.extra ?? ''} placeholder="Complemento (relação ou implicação), opcional" aria-label={`Complemento do cartão ${i + 1}`} onChange={(e) => set({ cards: d.cards.map((x, j) => (j === i ? { ...x, extra: e.target.value || undefined } : x)) })} />
              </div>
              <RowTools i={i} n={d.cards.length} onMove={(a, b) => set({ cards: move(d.cards, a, b) })} onRemove={() => set({ cards: d.cards.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => set({ cards: [...d.cards, { kind: 'revisao', front: '', back: '', section: '', origin: 'texto' }] })}>
            ＋ Cartão
          </button>
          <Field label="Aplicações (uma por linha)" value={d.applications.join('\n')} rows={3} onChange={(v) => set({ applications: lines(v) })} />
          <Field label="Perguntas para reflexão (uma por linha)" value={d.questions.join('\n')} rows={3} onChange={(v) => set({ questions: lines(v) })} />
        </fieldset>

        <fieldset>
          <legend>DNA da mensagem</legend>
          <Field label="Convicções (uma por linha)" value={d.dna.convictions.join('\n')} rows={3} onChange={(v) => set({ dna: { ...d.dna, convictions: lines(v) } })} />
          {d.dna.rows.map((r, i) => (
            <div key={i} className="xr-edit-row">
              <span className="xr-edit-n">{i + 1}</span>
              <div className="stack" style={{ gap: 6, flex: 1 }}>
                <input className="input" value={r.principle} placeholder="Princípio (o quê)" aria-label={`Princípio ${i + 1}`} onChange={(e) => set({ dna: { ...d.dna, rows: d.dna.rows.map((x, j) => (j === i ? { ...x, principle: e.target.value } : x)) } })} />
                <input className="input" value={r.base} placeholder="Base bíblica (onde)" aria-label={`Base bíblica ${i + 1}`} onChange={(e) => set({ dna: { ...d.dna, rows: d.dna.rows.map((x, j) => (j === i ? { ...x, base: e.target.value } : x)) } })} />
                <input className="input" value={r.application} placeholder="Aplicação prática (como)" aria-label={`Aplicação ${i + 1}`} onChange={(e) => set({ dna: { ...d.dna, rows: d.dna.rows.map((x, j) => (j === i ? { ...x, application: e.target.value } : x)) } })} />
              </div>
              <RowTools i={i} n={d.dna.rows.length} onMove={(a, b) => set({ dna: { ...d.dna, rows: move(d.dna.rows, a, b) } })} onRemove={() => set({ dna: { ...d.dna, rows: d.dna.rows.filter((_, j) => j !== i) } })} />
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => set({ dna: { ...d.dna, rows: [...d.dna.rows, { principle: '', base: '', application: '', origin: 'texto' }] } })}>
            ＋ Linha da matriz
          </button>
          <Field label="Resultado esperado" value={d.dna.outcome} rows={2} onChange={(outcome) => set({ dna: { ...d.dna, outcome } })} />
        </fieldset>
      </div>
    </Sheet>
  );
}

function move<T>(list: T[], i: number, j: number): T[] {
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(i, 1);
  next.splice(j, 0, x);
  return next;
}

function RowTools({ i, n, onMove, onRemove }: { i: number; n: number; onMove: (i: number, j: number) => void; onRemove: () => void }) {
  return (
    <div className="xr-edit-tools">
      <button className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
        ↑
      </button>
      <button className="icon-btn" aria-label="Descer" disabled={i === n - 1} onClick={() => onMove(i, i + 1)}>
        ↓
      </button>
      <button className="icon-btn xr-danger" aria-label="Tirar" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      {rows ? <textarea className="textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /> : <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}
