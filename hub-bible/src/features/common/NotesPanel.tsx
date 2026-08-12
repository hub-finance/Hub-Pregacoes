import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../../components/Toast';
import { createNote, listNotesFor, removeNote } from '../../core/data/notes';
import type { Note, NoteTarget } from '../../core/db/types';

/** Anotações vinculadas a um sermão, estudo ou devocional. */
export function NotesPanel({
  parentId,
  targetType,
  contextLabel,
}: {
  parentId: string;
  targetType: NoteTarget;
  contextLabel: string;
}) {
  const { notify } = useToast();
  const notes = useLiveQuery(() => listNotesFor(parentId), [parentId], [] as Note[]);
  const [draft, setDraft] = useState('');

  const add = async () => {
    if (!draft.trim()) return;
    await createNote({
      targetType,
      parentId,
      reference: contextLabel,
      content: draft.trim(),
    });
    setDraft('');
    notify('Anotação adicionada.');
  };

  return (
    <section className="stack">
      <div className="section-head">
        <h2 className="section-title">Anotações vinculadas</h2>
      </div>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <textarea
          className="textarea"
          style={{ minHeight: 64 }}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ideia, ilustração, referência…"
          aria-label="Nova anotação"
        />
        <button className="btn btn-primary" onClick={add}>
          Adicionar
        </button>
      </div>

      {(notes ?? []).map((note) => (
        <div key={note.id} className="list-item" style={{ alignItems: 'flex-start' }}>
          <span className="list-body">
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{note.content}</span>
            <span className="list-meta">{new Date(note.createdAt).toLocaleString('pt-BR')}</span>
          </span>
          <button className="icon-btn" aria-label="Excluir anotação" onClick={() => removeNote(note.id)}>
            <Icon name="trash" size={18} />
          </button>
        </div>
      ))}
    </section>
  );
}
