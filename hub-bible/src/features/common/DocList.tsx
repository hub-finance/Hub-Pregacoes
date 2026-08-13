import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmDialog, EmptyState, PageHeader } from '../../components/ui';
import { Icon, type IconName } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { normalize } from '../../core/bible/canon';
import { CONTENT_CATEGORIES } from '../../core/categories';
import { DOC_LABEL, duplicateDoc, listDocs, removeDoc, saveDoc, type DocKind } from '../../core/data/documents';

interface BaseDoc {
  id: string;
  title: string;
  category: string;
  tags: string[];
  updatedAt: number;
}

interface Props<T extends BaseDoc> {
  kind: DocKind;
  title: string;
  lead: string;
  icon: IconName;
  route: string;
  create: () => T;
  subtitleOf: (doc: T) => string;
  emptyDescription: string;
  /** Quando presente, a tela oferece importar um arquivo pronto (PDF/Word). */
  onImportFile?: (file: File) => Promise<void>;
  importAccept?: string;
}

/**
 * Listagem padrão dos documentos ministeriais (sermões, Rhema, cursos,
 * materiais). Mesmo comportamento em todos os módulos: buscar, filtrar por
 * categoria, criar, duplicar e excluir.
 */
export function DocList<T extends BaseDoc>({
  kind,
  title,
  lead,
  icon,
  route,
  create,
  subtitleOf,
  emptyDescription,
  onImportFile,
  importAccept,
}: Props<T>) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const docs = useLiveQuery(() => listDocs<T>(kind), [kind], [] as T[]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [removing, setRemoving] = useState<T | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const used = new Set((docs ?? []).map((d) => d.category).filter(Boolean));
    return ['Todas', ...new Set([...used, ...CONTENT_CATEGORIES])];
  }, [docs]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return (docs ?? []).filter((doc) => {
      if (category !== 'Todas' && doc.category !== category) return false;
      if (!q) return true;
      return (
        normalize(doc.title).includes(q) ||
        normalize(subtitleOf(doc)).includes(q) ||
        doc.tags.some((t) => normalize(t).includes(q))
      );
    });
  }, [docs, query, category, subtitleOf]);

  const startNew = async () => {
    const doc = create();
    await saveDoc(kind, doc);
    navigate(`${route}/${doc.id}`);
  };

  return (
    <div className="page">
      <PageHeader
        title={title}
        lead={lead}
        actions={
          <>
            {onImportFile && (
              <button
                className="btn"
                disabled={importing}
                onClick={() => fileInput.current?.click()}
              >
                <Icon name="upload" size={17} /> {importing ? 'Importando…' : 'Importar'}
              </button>
            )}
            <button className="btn btn-primary" onClick={startNew}>
              <Icon name="plus" size={17} /> Novo
            </button>
          </>
        }
      />

      {onImportFile && (
        <input
          ref={fileInput}
          type="file"
          accept={importAccept}
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setImporting(true);
            try {
              await onImportFile(file);
            } catch (err) {
              notify((err as Error).message, 'error');
            } finally {
              setImporting(false);
            }
          }}
        />
      )}

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar em ${title.toLowerCase()}`}
          aria-label={`Buscar em ${title}`}
        />
      </div>

      <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }}>
        {categories.map((c) => (
          <button key={c} className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={icon}
          title={`Nenhum ${DOC_LABEL[kind].toLowerCase()} encontrado`}
          description={emptyDescription}
          action={
            <button className="btn btn-primary btn-sm" onClick={startNew}>
              Criar {DOC_LABEL[kind].toLowerCase()}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cards">
          {filtered.map((doc) => (
            <article key={doc.id} className="card stack" style={{ gap: 'var(--sp-3)' }}>
              <button
                style={{ textAlign: 'left' }}
                onClick={() => navigate(`${route}/${doc.id}`)}
                className="stack"
              >
                <span className="row" style={{ gap: 'var(--sp-2)' }}>
                  <span className="badge">{doc.category}</span>
                  <span className="small dim">{new Date(doc.updatedAt).toLocaleDateString('pt-BR')}</span>
                </span>
                <span className="card-title clamp-2">{doc.title || 'Sem título'}</span>
                <span className="small dim clamp-2">{subtitleOf(doc)}</span>
              </button>
              <div className="row row-wrap" style={{ gap: 'var(--sp-1)' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => navigate(`${route}/${doc.id}`)}>
                  Abrir
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={async () => {
                    await duplicateDoc(kind, doc);
                    notify('Cópia criada.');
                  }}
                >
                  Duplicar
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(doc)}>
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        title={`Excluir ${DOC_LABEL[kind].toLowerCase()}`}
        message={`"${removing?.title || 'Sem título'}" e suas anotações vinculadas serão removidos.`}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await removeDoc(kind, removing.id);
          setRemoving(null);
          notify('Excluído.');
        }}
      />
    </div>
  );
}
