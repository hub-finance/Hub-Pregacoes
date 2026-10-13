import { useEffect, useMemo, useState } from 'react';
import type { ExportSourceKind } from '../../core/db/types';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { SelectInput, TextInput } from '../../components/ui';
import { createExportDoc } from '../../core/data/exportDocs';
import type { ExportCategory } from '../../core/db/types';
import { listSources, SOURCE_LABEL, type SourceOption } from '../../core/export/sources';
import { categoryById, EXPORT_CATEGORIES, modelById } from '../../core/export/templates';

/** Escolha que chega pronta de outra tela ("Finalizar e exportar" no Gerador…). */
export interface ExportPreset {
  category?: string;
  model?: string;
  sourceKind?: ExportSourceKind;
  sourceId?: string;
}

/**
 * Novo documento: categoria → modelo → conteúdo de origem.
 *
 * O conteúdo vem do que já foi escrito no app — nada de copiar e colar. A
 * escolha só define de onde o texto sai; ele é revisado na tela seguinte,
 * antes de virar arquivo.
 */
export function NewExportSheet({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: ExportPreset | null }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [category, setCategory] = useState<ExportCategory>('pregacao');
  const [model, setModel] = useState(EXPORT_CATEGORIES[0].models[0].id);
  const [title, setTitle] = useState('');
  const [sources, setSources] = useState<SourceOption[] | null>(null);
  const [selected, setSelected] = useState<string>('blank');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  /** Vários conteúdos num documento só; a ordem é a ordem em que foram marcados. */
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSources(null);
    listSources()
      .then(setSources)
      .catch(() => setSources([]));
    if (preset) {
      const c = categoryById(preset.category ?? 'pregacao');
      setCategory(c.id);
      setModel(modelById(c.id, preset.model ?? c.models[0].id).id);
      setSelected(preset.sourceKind && preset.sourceId ? `${preset.sourceKind}:${preset.sourceId}` : 'blank');
      setMulti(false);
      setPicked([]);
    }
  }, [open, preset]);

  const cat = categoryById(category);
  const modelDef = cat.models.find((m) => m.id === model) ?? cat.models[0];
  // modelo de série ou de vários dias já abre na escolha de vários conteúdos
  useEffect(() => {
    if (modelDef.compile?.multi) setMulti(true);
  }, [modelDef]);
  const togglePick = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const ordered = useMemo(() => {
    const list = sources ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((s) => `${s.title} ${s.subtitle}`.toLowerCase().includes(q)) : list;
    // as origens típicas da categoria primeiro, depois as demais
    const rank = (s: SourceOption) => {
      const i = cat.preferredSources.indexOf(s.kind);
      return i < 0 ? cat.preferredSources.length : i;
    };
    return [...filtered].sort((a, b) => rank(a) - rank(b) || b.updatedAt - a.updatedAt);
  }, [sources, query, cat]);

  const chosen = sources?.find((s) => `${s.kind}:${s.id}` === selected);

  const create = async () => {
    setBusy(true);
    try {
      if (multi && picked.length < 2) throw new Error('Marque pelo menos dois conteúdos para juntar.');
      const doc = await createExportDoc(
        multi
          ? {
              category,
              model,
              sourceKind: 'compiled',
              sources: picked.map((key) => {
                const [kind, ...rest] = key.split(':');
                return { kind: kind as ExportSourceKind, id: rest.join(':') };
              }),
              title: title.trim() || undefined,
            }
          : {
              category,
              model,
              sourceKind: chosen ? chosen.kind : 'blank',
              sourceId: chosen?.id,
              title: title.trim() || undefined,
            },
      );
      onClose();
      navigate(`/exportar/${doc.id}`);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      title="Novo documento"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={create} disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Preparando…' : multi ? `Juntar ${picked.length} e revisar` : 'Revisar documento'}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <span className="small" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
            Categoria
          </span>
          <div className="chip-row" role="radiogroup" aria-label="Categoria do documento">
            {EXPORT_CATEGORIES.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={category === c.id}
                className={`chip${category === c.id ? ' active' : ''}`}
                onClick={() => {
                  setCategory(c.id);
                  setModel(c.models[0].id);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <span className="small dim">{cat.description}</span>
        </div>

        <SelectInput
          label="Modelo"
          value={model}
          onChange={setModel}
          options={cat.models.map((m) => ({ value: m.id, label: m.label }))}
          hint={cat.models.find((m) => m.id === model)?.hint}
        />

        <TextInput
          label="Título do documento"
          value={title}
          onChange={setTitle}
          placeholder={chosen?.title || 'Se ficar em branco, vale o título do conteúdo'}
        />

        <div className="field">
          <span className="small" style={{ fontWeight: 600, color: 'var(--text-2)' }}>
            Conteúdo de origem
          </span>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={multi}
            onClick={() => setMulti((v) => !v)}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <span>
              <span style={{ display: 'block', fontWeight: 550, fontSize: '0.92rem' }}>Juntar vários num só documento</span>
              <span className="small dim">
                Série de mensagens, plano devocional, apostila com vários módulos. Cada um entra na ordem em que for marcado.
              </span>
            </span>
            <span className={`switch-track${multi ? ' on' : ''}`} aria-hidden="true">
              <span className="switch-knob" />
            </span>
          </button>
          {multi && (
            <span className="small" role="status" style={{ color: modelDef.compile?.parts && picked.length !== modelDef.compile.parts ? 'var(--danger)' : 'var(--text-2)' }}>
              {picked.length} escolhido(s)
              {modelDef.compile?.parts ? ` de ${modelDef.compile.parts} para este plano` : ''}
            </span>
          )}
          <div className="search-field">
            <Icon name="search" size={18} className="dim" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo título" aria-label="Buscar conteúdo" />
          </div>
          <div className="xp-source-list" role="radiogroup" aria-label="Conteúdo de origem">
            {!multi && <button
              role="radio"
              aria-checked={selected === 'blank'}
              className={`xp-source${selected === 'blank' ? ' active' : ''}`}
              onClick={() => setSelected('blank')}
            >
              <Icon name="plus" size={18} className="dim" />
              <span style={{ flex: 1 }}>
                <strong>Documento em branco</strong>
                <span className="small dim" style={{ display: 'block' }}>
                  Para escrever ou colar um conteúdo novo na revisão.
                </span>
              </span>
            </button>}
            {sources === null && <span className="small dim">Carregando o que você já escreveu…</span>}
            {ordered.map((s) => {
              const key = `${s.kind}:${s.id}`;
              const order = picked.indexOf(key);
              const on = multi ? order >= 0 : selected === key;
              return (
                <button
                  key={key}
                  role={multi ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  disabled={s.fileOnly}
                  className={`xp-source${on ? ' active' : ''}`}
                  onClick={() => (multi ? togglePick(key) : setSelected(key))}
                >
                  {multi && (
                    <span className="xp-order" aria-hidden="true">
                      {order >= 0 ? order + 1 : ''}
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong className="clamp-2">{s.title}</strong>
                    <span className="small dim" style={{ display: 'block' }}>
                      {SOURCE_LABEL[s.kind]}
                      {s.subtitle ? ` · ${s.subtitle}` : ''}
                      {s.fileOnly ? ' · arquivo importado (o texto está no PDF/Word original)' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
            {sources !== null && !ordered.length && query && <span className="small dim">Nada encontrado com esse título.</span>}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
