import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { SaveStatus } from '../../components/SaveStatus';
import { Sheet } from '../../components/Sheet';
import { ConfirmDialog, SelectInput, TextArea, TextInput } from '../../components/ui';
import { downloadJson, hubStudyBackup, safeName } from '../../core/backup';
import { deleteMaterial, duplicateMaterial, joinedText, KIND_LABEL, newSection, PART_LABEL, resplitMaterial, saveMaterial } from '../../core/materials';
import { aiChapterTitles, getGeminiConfig } from '../../core/ai';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Material, MaterialKind } from '../../core/types';

/**
 * Edição do material: dados gerais e as partes. Grava sozinho pouco depois de
 * cada pausa e ao sair da aba.
 */
export function EditTab({ material }: { material: Material }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [draft, setDraft] = useState<Material>(material);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [resplitting, setResplitting] = useState(false);
  const [askTitles, setAskTitles] = useState(false);
  const [titlesText, setTitlesText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const aiOn = useLiveQuery(async () => !!(await getGeminiConfig()).key, [], false);
  const dirty = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;

  // outra aba (DNA, mapa) gravou: traz a mudança, sem perder o que se digita aqui
  useEffect(() => {
    if (!dirty.current) setDraft(material);
  }, [material]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setSaving(true);
      await saveMaterial(latest.current);
      dirty.current = false;
      setSaving(false);
      setSavedAt(Date.now());
    }, 700);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(
    () => () => {
      if (dirty.current) void saveMaterial(latest.current);
    },
    [],
  );

  const set = (patch: Partial<Material>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setSection = (id: string, patch: { title?: string; text?: string }) =>
    set({ sections: draft.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= draft.sections.length) return;
    const next = [...draft.sections];
    const [s] = next.splice(i, 1);
    next.splice(to, 0, s);
    set({ sections: next });
  };
  const part = PART_LABEL[draft.kind];

  return (
    <div className="stack">
      <div className="row row-wrap">
        <SaveStatus saving={saving} pending={dirty.current} savedAt={savedAt} />
      </div>

      <section className="card stack">
        <TextInput label="Título" value={draft.title} onChange={(title) => set({ title })} />
        <div className="grid grid-2">
          <SelectInput
            label="Tipo"
            value={draft.kind}
            onChange={(v) => set({ kind: v as MaterialKind })}
            options={(Object.keys(KIND_LABEL) as MaterialKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          />
          <TextInput label="Autor" value={draft.author} onChange={(author) => set({ author })} />
        </div>
        <label className="field">
          <span>Etiquetas</span>
          <input
            className="input"
            value={draft.tags.join(', ')}
            onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
            placeholder="fé, liderança, discipulado"
          />
        </label>
        <label className="field">
          <span>Ideia central</span>
          <textarea className="textarea" rows={2} value={draft.centralIdea} onChange={(e) => set({ centralIdea: e.target.value })} />
        </label>
      </section>

      <p className="small dim" style={{ margin: 0 }}>
        No texto: “&gt; ” no começo da linha marca um destaque; “- ” faz lista; “Termo: definição” entra no glossário;
        “- [ ] tarefa” vira sugestão de ação. Referências bíblicas (João 3:16, Rm 8.28) são achadas sozinhas.
      </p>

      {draft.sections.map((s, i) => (
        <section key={s.id} className="card stack" style={{ gap: 'var(--sp-2)' }}>
          <div className="row">
            <span className="badge">
              {part} {i + 1}
            </span>
            <span className="spacer" />
            <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir esta parte">
              ↑
            </button>
            <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === draft.sections.length - 1} aria-label="Descer esta parte">
              ↓
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                if (s.text.trim() && !window.confirm('Excluir esta parte e o texto dela?')) return;
                set({ sections: draft.sections.filter((x) => x.id !== s.id) });
              }}
              aria-label="Excluir esta parte"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
          <input className="input" value={s.title} onChange={(e) => setSection(s.id, { title: e.target.value })} placeholder={`Título do ${part.toLowerCase()} ${i + 1}`} aria-label={`Título da parte ${i + 1}`} />
          <textarea className="textarea" rows={8} value={s.text} onChange={(e) => setSection(s.id, { text: e.target.value })} aria-label={`Texto da parte ${i + 1}`} />
        </section>
      ))}

      <div>
        <button className="btn" onClick={() => set({ sections: [...draft.sections, newSection()] })}>
          ＋ Acrescentar {part.toLowerCase()}
        </button>
      </div>

      <section className="card stack">
        <strong>Com o Hub Bible</strong>
        <span className="small muted">
          Gera um arquivo que o Hub Bible recebe como estudo do Rhema. No Hub Bible: Configurações › Restaurar → escolha
          este arquivo. Ele junta o estudo ao que já existe, sem apagar nada.
        </span>
        <div>
          <button
            className="btn"
            onClick={async () => {
              await saveMaterial(latest.current);
              dirty.current = false;
              downloadJson(hubStudyBackup(latest.current), `${safeName(latest.current.title)} - para o Hub Bible.json`);
              notify('Arquivo para o Hub Bible gerado.');
            }}
          >
            Enviar para o Hub Bible (Rhema)
          </button>
        </div>
      </section>

      <div className="row row-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
        <button
          className="btn btn-sm"
          onClick={async () => {
            await saveMaterial(latest.current);
            dirty.current = false;
            const copy = await duplicateMaterial(material.id);
            navigate(`/m/${copy.id}`);
          }}
        >
          Duplicar
        </button>
        {aiOn && (
          <button
            className="btn btn-sm btn-primary"
            disabled={aiBusy}
            onClick={async () => {
              setAiBusy(true);
              try {
                await saveMaterial(latest.current);
                dirty.current = false;
                const titles = await aiChapterTitles(joinedText(latest.current));
                // mostra o que a IA achou, para conferir antes de dividir
                setTitlesText(titles.join('\n'));
                setAskTitles(true);
                notify(`A IA achou ${titles.length} capítulos. Confira e toque em “Dividir por estes capítulos”.`);
              } catch (err) {
                notify((err as Error).message, 'error');
              } finally {
                setAiBusy(false);
              }
            }}
          >
            {aiBusy ? 'A IA está lendo o sumário…' : 'Ler o sumário com IA'}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => setResplitting(true)}>
          Reorganizar as partes pelo sumário
        </button>
        <button className="btn btn-sm" onClick={() => setAskTitles(true)}>
          Informar os capítulos
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => setRemoving(true)}>
          Excluir material
        </button>
      </div>

      <Sheet
        open={askTitles}
        title="Informar os capítulos"
        onClose={() => setAskTitles(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAskTitles(false)} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!titlesText.trim()}
              onClick={async () => {
                try {
                  await saveMaterial(latest.current);
                  dirty.current = false;
                  const next = await resplitMaterial(latest.current, titlesText.split('\n').filter((t) => t.trim()));
                  setDraft(next);
                  setAskTitles(false);
                  notify(`Pronto: ${next.sections.length} capítulos.`);
                } catch (err) {
                  notify((err as Error).message, 'error');
                }
              }}
            >
              Dividir por estes capítulos
            </button>
          </>
        }
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            Cole ou digite os títulos dos capítulos, <strong>um por linha</strong>, como estão no sumário do livro (o número
            e a página podem vir junto). O app procura cada um no texto e divide exatamente ali. O andamento do passo a passo
            recomeça.
          </p>
          <TextArea
            label="Capítulos"
            value={titlesText}
            onChange={setTitlesText}
            rows={10}
            placeholder={'1. Origens: Satanás e Seu Reino\n2. Divisão Bíblica do Homem: Espírito, Alma e Corpo\n3. O Diabo ou a Carne?'}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={resplitting}
        title="Reorganizar as partes?"
        message={`O texto continua o mesmo; o app lê de novo o sumário do livro (ou os títulos de capítulo) e divide as partes por ele, deixando de fora capa e ficha catalográfica. Hoje são ${draft.sections.length} partes. O andamento do passo a passo recomeça.`}
        confirmLabel="Reorganizar"
        danger={false}
        onCancel={() => setResplitting(false)}
        onConfirm={async () => {
          await saveMaterial(latest.current);
          dirty.current = false;
          const next = await resplitMaterial(latest.current);
          setDraft(next);
          setResplitting(false);
          notify(`Pronto: ${next.sections.length} partes.`);
        }}
      />

      <ConfirmDialog
        open={removing}
        title="Excluir material"
        message={`"${material.title}" será removido deste aparelho, com o andamento, os cartões e o plano de ação.`}
        onCancel={() => setRemoving(false)}
        onConfirm={async () => {
          dirty.current = false;
          await deleteMaterial(material.id);
          setRemoving(false);
          notify('Material excluído.');
          navigate('/');
        }}
      />
    </div>
  );
}
