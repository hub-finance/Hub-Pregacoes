import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  TagInput,
  TextArea,
  TextInput,
} from '../../components/ui';
import { useToast } from '../../components/Toast';
import { createNote, filterNotes, listNotes, removeNote, updateNote } from '../../core/data/notes';
import { parseReference } from '../../core/bible/reference';
import type { Note } from '../../core/db/types';

/** Anotações vinculadas ao texto bíblico ou a documentos ministeriais. */
export default function NotesPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const notes = useLiveQuery(() => listNotes(), [], [] as Note[]);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [removing, setRemoving] = useState<Note | null>(null);
  const [draft, setDraft] = useState({ reference: '', title: '', content: '', tags: [] as string[] });

  const filtered = useMemo(() => filterNotes(notes ?? [], query), [notes, query]);

  const openNew = () => {
    setDraft({ reference: '', title: '', content: '', tags: [] });
    setEditing({ id: '', userId: 'local' } as Note);
  };

  const openEdit = (note: Note) => {
    setDraft({
      reference: note.reference,
      title: note.title ?? '',
      content: note.content,
      tags: note.tags,
    });
    setEditing(note);
  };

  const save = async () => {
    if (!draft.content.trim() && !draft.title.trim()) {
      notify('Escreva algo antes de salvar.', 'error');
      return;
    }
    const parsed = parseReference(draft.reference);
    if (editing?.id) {
      await updateNote(editing.id, {
        reference: draft.reference || 'Anotação livre',
        title: draft.title,
        content: draft.content,
        tags: draft.tags,
      });
    } else {
      await createNote({
        targetType: parsed ? 'verse' : 'free',
        reference: draft.reference || 'Anotação livre',
        title: draft.title,
        content: draft.content,
        tags: draft.tags,
        ref: parsed
          ? { translation: '', book: parsed.book, chapter: parsed.chapter, verse: parsed.verse ?? 1 }
          : undefined,
      });
    }
    setEditing(null);
    notify('Anotação salva.');
  };

  return (
    <div className="page">
      <PageHeader
        title="Anotações"
        lead={`${notes?.length ?? 0} anotação(ões).`}
        actions={
          <button className="btn btn-primary" onClick={openNew}>
            ＋ Nova anotação
          </button>
        }
      />

      <div className="search-field" style={{ marginBottom: 'var(--sp-4)' }}>
        <span aria-hidden="true">🔎</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por texto, referência ou etiqueta"
          aria-label="Buscar anotações"
        />
      </div>

      {!filtered.length ? (
        <EmptyState
          icon="📝"
          title="Nenhuma anotação ainda"
          description="Selecione um versículo na leitura e toque em Anotar, ou crie uma anotação livre."
          action={
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              Criar anotação
            </button>
          }
        />
      ) : (
        <div className="stack">
          {filtered.map((note) => (
            <article key={note.id} className="card stack" style={{ gap: 'var(--sp-2)' }}>
              <div className="row">
                <button
                  style={{ color: 'var(--accent-strong)', fontWeight: 650, fontSize: '0.86rem', textAlign: 'left' }}
                  onClick={() => {
                    if (note.ref) navigate(`/biblia/${note.ref.book}/${note.ref.chapter}?v=${note.ref.verse}`);
                  }}
                >
                  {note.reference}
                </button>
                <div className="spacer" />
                <span className="small dim">{new Date(note.updatedAt).toLocaleDateString('pt-BR')}</span>
              </div>
              {note.title && <h2 className="card-title">{note.title}</h2>}
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }} className="muted">
                {note.content}
              </p>
              {note.tags.length > 0 && (
                <div className="row row-wrap">
                  {note.tags.map((t) => (
                    <span key={t} className="badge">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="row row-wrap">
                <button className="btn btn-sm btn-ghost" onClick={() => openEdit(note)}>
                  ✏️ Editar
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(note)}>
                  🗑️ Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Sheet
        open={!!editing}
        title={editing?.id ? 'Editar anotação' : 'Nova anotação'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>
              Salvar
            </button>
          </>
        }
      >
        <TextInput
          label="Referência"
          hint="Opcional. Ex.: João 15:5"
          value={draft.reference}
          onChange={(reference) => setDraft((d) => ({ ...d, reference }))}
          placeholder="João 15:5"
        />
        <TextInput
          label="Título"
          value={draft.title}
          onChange={(title) => setDraft((d) => ({ ...d, title }))}
          placeholder="Dependência gera fruto"
        />
        <TextArea
          label="Anotação"
          value={draft.content}
          onChange={(content) => setDraft((d) => ({ ...d, content }))}
          rows={8}
        />
        <TagInput label="Etiquetas" tags={draft.tags} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
      </Sheet>

      <ConfirmDialog
        open={!!removing}
        title="Excluir anotação"
        message="Esta anotação será removida do dispositivo."
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeNote(removing.id);
          setRemoving(null);
          notify('Anotação excluída.');
        }}
      />
    </div>
  );
}
