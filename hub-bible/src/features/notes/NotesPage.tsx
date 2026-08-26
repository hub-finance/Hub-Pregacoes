import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
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
            Nova anotação
          </button>
        }
      />

      <div className="search-field" style={{ marginBottom: 'var(--sp-4)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por texto, referência ou etiqueta"
          aria-label="Buscar anotações"
        />
      </div>

      {!filtered.length ? (
        <EmptyState
          icon="note"
          title="Nenhuma anotação ainda"
          description="Selecione um versículo na leitura e toque em Anotar, ou crie uma anotação livre."
          action={
            <button className="btn btn-primary btn-sm" onClick={openNew}>
              Criar anotação
            </button>
          }
        />
      ) : (
        /* Bloco de anotações, e não fichário: uma anotação atrás da outra,
           separadas por um filete. Cada quadro em volta acrescentava borda,
           sombra e recuo — três interrupções entre um pensamento e o seguinte,
           numa tela onde o que importa é reler o que se escreveu. */
        <div className="notepad">
          {filtered.map((note) => (
            <article key={note.id} className="notepad-entry">
              <div className="row">
                <button
                  className="notepad-ref"
                  onClick={() => {
                    if (note.ref) navigate(`/biblia/${note.ref.book}/${note.ref.chapter}?v=${note.ref.verse}`);
                  }}
                >
                  {note.reference}
                </button>
                <div className="spacer" />
                <span className="small dim">{new Date(note.updatedAt).toLocaleDateString('pt-BR')}</span>
              </div>

              {note.title && <h2 className="notepad-title">{note.title}</h2>}
              <p className="notepad-text">{note.content}</p>

              {note.tags.length > 0 && (
                <div className="row row-wrap">
                  {note.tags.map((t) => (
                    <span key={t} className="badge">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* discretos até a anotação receber atenção: numa lista longa,
                  dois botões por anotação competem com o texto */}
              <div className="row row-wrap notepad-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => openEdit(note)}>
                  Editar
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(note)}>
                  Excluir
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
