import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ConfirmDialog, EmptyState, PageHeader, SelectInput } from '../../components/ui';
import {
  deleteExportDoc,
  duplicateExportDoc,
  filterExportLibrary,
  loadExportLibrary,
  type LibraryFilter,
  type LibraryRow,
} from '../../core/data/exportDocs';
import { formatBytes } from '../../core/data/attachments';
import { FORMAT_SHORT } from '../../core/export/files';
import { SOURCE_LABEL } from '../../core/export/sources';
import { categoryById, EXPORT_CATEGORIES, modelById } from '../../core/export/templates';
import { themeById } from '../../core/export/themes';
import { NewExportSheet, type ExportPreset } from './NewExportSheet';
import type { ExportSourceKind } from '../../core/db/types';
import { STATUS_LABEL } from './status';
import '../../styles/export.css';

const dateOf = (t?: number) => (t ? new Date(t).toLocaleDateString('pt-BR') : '—');

/** Gerar e Exportar Arquivos — começo de um documento e a biblioteca do que foi gerado. */
export default function ExportPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const rows = useLiveQuery(() => loadExportLibrary(), [], [] as LibraryRow[]);
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const [preset, setPreset] = useState<ExportPreset | null>(null);

  // vindo de outra tela ("Finalizar e exportar" no Gerador, "Gerar arquivo do
  // plano"…): o novo documento abre com a origem, a categoria e o modelo já escolhidos
  useEffect(() => {
    const origem = params.get('origem');
    if (!origem) return;
    setPreset({
      sourceKind: origem as ExportSourceKind,
      sourceId: params.get('id') ?? undefined,
      category: params.get('categoria') ?? undefined,
      model: params.get('modelo') ?? undefined,
    });
    setCreating(true);
    setParams({}, { replace: true });
  }, [params, setParams]);
  const [removing, setRemoving] = useState<LibraryRow | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>({ query: '', category: 'todas', status: 'todos', days: 0 });

  const filtered = useMemo(() => filterExportLibrary(rows ?? [], filter), [rows, filter]);

  const duplicate = async (row: LibraryRow) => {
    try {
      const copy = await duplicateExportDoc(row.doc.id);
      notify('Cópia criada como novo documento.');
      navigate(`/exportar/${copy.id}`);
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  };

  return (
    <div className="page page-wide">
      <PageHeader
        title="Gerar e Exportar Arquivos"
        lead="Transforme mensagens, estudos, devocionais e materiais em Word, PDF ou Markdown — revisados e aprovados por você."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              setPreset(null);
              setCreating(true);
            }}
          >
            ＋ Novo documento
          </button>
        }
      />

      <div className="notice" style={{ marginBottom: 'var(--sp-4)' }}>
        <Icon name="info" size={18} />
        <span>
          O caminho é: escolher o conteúdo → revisar → aprovar → gerar o arquivo. O arquivo traz somente o seu texto;
          nada é acrescentado, resumido ou reescrito.
        </span>
      </div>

      <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
        <Icon name="search" size={18} className="dim" />
        <input
          value={filter.query}
          onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          placeholder="Pesquisar pelo título"
          aria-label="Pesquisar documentos"
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 'var(--sp-4)', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))' }}>
        <SelectInput
          label="Categoria"
          value={filter.category}
          onChange={(category) => setFilter({ ...filter, category: category as LibraryFilter['category'] })}
          options={[{ value: 'todas', label: 'Todas' }, ...EXPORT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
        />
        <SelectInput
          label="Situação"
          value={filter.status}
          onChange={(status) => setFilter({ ...filter, status: status as LibraryFilter['status'] })}
          options={[
            { value: 'todos', label: 'Todas' },
            { value: 'rascunho', label: STATUS_LABEL.rascunho },
            { value: 'aprovado', label: STATUS_LABEL.aprovado },
            { value: 'finalizado', label: STATUS_LABEL.finalizado },
          ]}
        />
        <SelectInput
          label="Período"
          value={String(filter.days)}
          onChange={(days) => setFilter({ ...filter, days: Number(days) })}
          options={[
            { value: '0', label: 'Qualquer data' },
            { value: '7', label: 'Últimos 7 dias' },
            { value: '30', label: 'Últimos 30 dias' },
            { value: '90', label: 'Últimos 3 meses' },
            { value: '365', label: 'Último ano' },
          ]}
        />
      </div>

      {!(rows ?? []).length ? (
        <EmptyState
          icon="download"
          title="Nenhum documento ainda"
          description="Escolha uma mensagem, um estudo ou um devocional que você já escreveu e gere o arquivo em Word ou PDF."
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              Começar
            </button>
          }
        />
      ) : !filtered.length ? (
        <p className="muted">Nenhum documento com esses filtros.</p>
      ) : (
        <div className="grid grid-cards">
          {filtered.map((row) => {
            const { doc } = row;
            return (
              <article key={doc.id} className="card stack" style={{ gap: 'var(--sp-2)' }}>
                <span className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
                  <span className={`xp-status ${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
                  {doc.approvedVersion ? <span className="badge">v{doc.approvedVersion}</span> : null}
                  <span className="spacer" />
                  <span className="small dim">{dateOf(doc.updatedAt)}</span>
                </span>
                <button className="card-title clamp-2" style={{ textAlign: 'left' }} onClick={() => navigate(`/exportar/${doc.id}`)}>
                  {doc.title}
                </button>
                <span className="small dim">
                  {categoryById(doc.category).label} · {modelById(doc.category, doc.model).label}
                </span>
                <span className="small dim">
                  Origem: {SOURCE_LABEL[doc.source.kind]}
                  {doc.source.kind !== 'blank' && doc.source.title ? ` — ${doc.source.title}` : ''}
                </span>
                <span className="small dim">
                  Modelo visual: {themeById(doc.layout.theme).label}
                  {doc.lastExportAt ? ` · Exportado em ${dateOf(doc.lastExportAt)}` : ''}
                </span>
                <span className="row row-wrap" style={{ gap: 4 }}>
                  {doc.formats.map((f) => (
                    <span key={f} className="badge">
                      {FORMAT_SHORT[f]}
                    </span>
                  ))}
                  {row.files > 0 && (
                    <span className="small dim">
                      {row.files} arquivo{row.files > 1 ? 's' : ''} · {formatBytes(row.bytes)}
                    </span>
                  )}
                </span>
                <span className="row row-wrap" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/exportar/${doc.id}`)}>
                    Abrir
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/exportar/${doc.id}?aba=arquivos`)}>
                    Arquivos
                  </button>
                  <button className="btn btn-sm" onClick={() => duplicate(row)}>
                    Duplicar
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(row)} aria-label={`Excluir ${doc.title}`}>
                    <Icon name="trash" size={16} />
                  </button>
                </span>
              </article>
            );
          })}
        </div>
      )}

      <NewExportSheet
        open={creating}
        preset={preset}
        onClose={() => {
          setCreating(false);
          setPreset(null);
        }}
      />

      <ConfirmDialog
        open={!!removing}
        title="Excluir documento"
        message={`"${removing?.doc.title}" será removido deste aparelho, com todas as versões e arquivos gerados. O conteúdo de origem (a mensagem, o estudo) não é tocado.`}
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await deleteExportDoc(removing.doc.id);
          setRemoving(null);
          notify('Documento excluído.');
        }}
      />
    </div>
  );
}
