import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { SelectInput, TextArea, TextInput } from '../components/ui';
import { importMaterialFile, readJsonFile } from '../core/backup';
import { importFile, readHubBackup, type HubCandidate } from '../core/importers';
import { createMaterial, KIND_LABEL } from '../core/materials';
import type { MaterialKind } from '../core/types';

type Mode = 'escrever' | 'arquivo' | 'hub';

/**
 * Novo material: escrever ou colar o texto, importar um arquivo (.txt, .md,
 * .docx, .pdf) ou trazer do Hub Bible pela cópia de segurança dele.
 */
export function NewMaterialSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>('escrever');
  const [kind, setKind] = useState<MaterialKind>('estudo');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [hubItems, setHubItems] = useState<HubCandidate[] | null>(null);
  const [hubChosen, setHubChosen] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const hubInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle('');
    setAuthor('');
    setText('');
    setFileName('');
    setHubItems(null);
    setHubChosen(new Set());
  };

  const create = async () => {
    setBusy('Organizando o material…');
    try {
      if (mode === 'hub') {
        const chosen = (hubItems ?? []).filter((c) => hubChosen.has(`${c.table}:${c.id}`));
        if (!chosen.length) throw new Error('Escolha pelo menos um conteúdo do Hub Bible.');
        let last = '';
        for (const c of chosen) {
          const m = await createMaterial({
            title: c.title,
            kind: c.kind,
            sections: c.sections,
            source: { type: 'hub-bible', name: c.label, hubTable: c.table, hubId: c.id },
          });
          last = m.id;
        }
        notify(chosen.length === 1 ? 'Material trazido do Hub Bible.' : `${chosen.length} materiais trazidos do Hub Bible.`);
        reset();
        onClose();
        navigate(chosen.length === 1 ? `/m/${last}` : '/');
        return;
      }
      if (!title.trim() && !text.trim()) throw new Error('Escreva um título ou cole o texto.');
      const m = await createMaterial({
        title: title || 'Sem título',
        kind,
        author,
        text,
        source: mode === 'arquivo' && fileName ? { type: 'arquivo', name: fileName } : { type: 'manual' },
      });
      reset();
      onClose();
      navigate(`/m/${m.id}${text.trim() ? '' : '?aba=editar'}`);
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet
      open={open}
      title="Novo material"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={create} disabled={!!busy} style={{ flex: 1 }}>
            {busy ? 'Aguarde…' : mode === 'hub' ? 'Trazer selecionados' : 'Criar material'}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="tabs" role="tablist">
          {(
            [
              ['escrever', 'Escrever ou colar'],
              ['arquivo', 'Importar arquivo'],
              ['hub', 'Do Hub Bible'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={mode === id} className={`tab${mode === id ? ' active' : ''}`} onClick={() => setMode(id)}>
              {label}
            </button>
          ))}
        </div>

        {mode !== 'hub' && (
          <>
            <div className="grid grid-2">
              <SelectInput
                label="Tipo"
                value={kind}
                onChange={(v) => setKind(v as MaterialKind)}
                options={(Object.keys(KIND_LABEL) as MaterialKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              />
              <TextInput label="Autor" value={author} onChange={setAuthor} placeholder="Opcional" />
            </div>
            <TextInput label="Título" value={title} onChange={setTitle} placeholder="O nome do livro, do estudo ou do resumo" />
          </>
        )}

        {mode === 'arquivo' && (
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            <div className="row row-wrap">
              <button className="btn" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                Escolher arquivo (.txt, .md, .docx, .pdf ou material .json)
              </button>
              {fileName && <span className="small dim">{fileName}</span>}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,.markdown,.docx,.pdf,.json,application/json,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setBusy('Lendo o arquivo…');
                try {
                  // material baixado do próprio Hub Resumos: volta inteiro, com andamento, cartões e ações
                  if (/\.json$/i.test(file.name)) {
                    const m = await importMaterialFile(await readJsonFile(file));
                    notify('Material aberto na biblioteca, com andamento, cartões e plano de ação.');
                    reset();
                    onClose();
                    navigate(`/m/${m.id}`);
                    return;
                  }
                  const imported = await importFile(file, setBusy);
                  setFileName(file.name);
                  setText(imported.text);
                  if (!title.trim()) setTitle(imported.title);
                } catch (err) {
                  notify((err as Error).message, 'error');
                } finally {
                  setBusy(null);
                }
              }}
            />
            <p className="small dim" style={{ margin: 0 }}>
              O arquivo é lido aqui no aparelho; nada é enviado para a internet. Revise o texto abaixo antes de criar. Um material baixado do Hub Resumos (.json) volta completo, sem precisar criar.
            </p>
          </div>
        )}

        {mode !== 'hub' && (
          <TextArea
            label="Texto"
            value={text}
            onChange={setText}
            rows={10}
            hint="Títulos (# Título, CAPÍTULO 1, Lição 2) dividem o material em partes. Use “> ” para destacar uma ideia-chave, “- ” para listas e “Termo: definição” para o glossário."
            placeholder={'# Introdução\nO texto da primeira parte…\n> A ideia que não pode ser esquecida.\n\n# Capítulo 1\n…'}
          />
        )}

        {mode === 'hub' && (
          <div className="stack" style={{ gap: 'var(--sp-2)' }}>
            <p className="small muted" style={{ margin: 0 }}>
              No Hub Bible, vá em Configurações › “Exportar meus dados” e escolha aqui o arquivo gerado. Nada no Hub Bible
              é alterado.
            </p>
            <div>
              <button className="btn" onClick={() => hubInput.current?.click()} disabled={!!busy}>
                Escolher a cópia do Hub Bible (.json)
              </button>
            </div>
            <input
              ref={hubInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const items = readHubBackup(await readJsonFile(file));
                  setHubItems(items);
                  setHubChosen(new Set());
                  if (!items.length) notify('A cópia não tem mensagens, estudos ou cursos com texto.', 'error');
                } catch (err) {
                  notify((err as Error).message, 'error');
                }
              }}
            />
            {hubItems && hubItems.length > 0 && (
              <div className="xr-pick-list">
                {hubItems.map((c) => {
                  const key = `${c.table}:${c.id}`;
                  return (
                    <label key={key} className="xr-pick">
                      <input
                        type="checkbox"
                        checked={hubChosen.has(key)}
                        onChange={() =>
                          setHubChosen((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                      />
                      <span style={{ minWidth: 0 }}>
                        <strong className="clamp-2">{c.title}</strong>
                        <span className="small dim" style={{ display: 'block' }}>
                          {c.label} · {c.sections.length} parte{c.sections.length > 1 ? 's' : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {busy && (
          <p className="small muted" aria-live="polite" style={{ margin: 0 }}>
            {busy}
          </p>
        )}
      </div>
    </Sheet>
  );
}
