import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { ConfirmDialog, EmptyState, PageHeader } from '../components/ui';
import { downloadJson, materialFile, safeName } from '../core/backup';
import { fold } from '../core/bible';
import { db, getSetting, setSetting } from '../core/db';
import { createExampleMaterial } from '../core/example';
import { deleteMaterial, duplicateMaterial, KIND_LABEL, progressRatio } from '../core/materials';
import type { Material, MaterialKind } from '../core/types';
import { NewMaterialSheet } from './NewMaterialSheet';

/** Biblioteca: todos os livros, estudos e resumos, com andamento e revisões do dia. */
export default function LibraryPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<MaterialKind | 'todos'>('todos');
  const [removing, setRemoving] = useState<Material | null>(null);

  const data = useLiveQuery(async () => {
    const [materials, progress, cards, actions] = await Promise.all([
      db.materials.toArray(),
      db.progress.toArray(),
      db.cards.toArray(),
      db.actions.toArray(),
    ]);
    const now = Date.now();
    const rows = materials
      .map((m) => {
        const p = progress.find((x) => x.id === m.id);
        return {
          m,
          ratio: progressRatio(m, p),
          started: (p?.done.length ?? 0) > 0 || !!p?.current,
          due: cards.filter((c) => c.materialId === m.id && c.due <= now).length,
          cards: cards.filter((c) => c.materialId === m.id).length,
        };
      })
      .sort((a, b) => (b.m.openedAt ?? b.m.updatedAt) - (a.m.openedAt ?? a.m.updatedAt));
    const parts = materials.reduce((n, m) => n + m.sections.length, 0);
    const doneParts = rows.reduce((n, r) => n + Math.round(r.ratio * r.m.sections.length), 0);
    return {
      rows,
      stats: {
        materials: materials.length,
        studied: parts ? Math.round((doneParts / parts) * 100) : 0,
        cards: cards.length,
        due: cards.filter((c) => c.due <= now).length,
        openActions: actions.filter((a) => a.status !== 'feito').length,
      },
      guide: {
        hidden: await getSetting('guideHidden', false),
        created: materials.length > 0,
        studied: progress.some((p) => p.done.length > 0),
        cards: cards.length > 0,
      },
    };
  }, []);

  const rows = useMemo(() => {
    const q = fold(query);
    return (data?.rows ?? []).filter(({ m }) => (kind === 'todos' || m.kind === kind) && (!q || fold(`${m.title} ${m.author} ${m.tags.join(' ')}`).includes(q)));
  }, [data, query, kind]);

  // o último material aberto que ainda não foi estudado até o fim
  const resume = data?.rows.find((r) => r.m.openedAt && r.ratio < 1);
  const guide = data?.guide;
  const showGuide = guide && !guide.hidden && !(guide.created && guide.studied && guide.cards);

  const openExample = async () => {
    const m = await createExampleMaterial();
    notify('Exemplo criado. Percorra as abas para ver cada visão.');
    navigate(`/m/${m.id}`);
  };

  return (
    <div className="page page-wide">
      <PageHeader
        title="Biblioteca"
        lead="Livros, estudos e resumos organizados em painel, passo a passo, DNA, mapa mental, cartões, consulta rápida, plano de ação, resumo e infográfico."
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            ＋ Novo material
          </button>
        }
      />

      {data && data.stats.materials > 0 && (
        <div className="xr-stats" role="list" aria-label="Resumo da biblioteca">
          <Stat value={data.stats.materials} label={data.stats.materials === 1 ? 'material' : 'materiais'} />
          <Stat value={`${data.stats.studied}%`} label="das partes estudadas" />
          <Stat value={data.stats.cards} label="cartões" />
          <Stat value={data.stats.due} label="para revisar hoje" accent={data.stats.due > 0} onClick={data.stats.due ? () => navigate('/revisar') : undefined} />
          <Stat value={data.stats.openActions} label="ações abertas" />
        </div>
      )}

      {resume && (
        <section className="card xr-resume">
          <span className="small dim">Continue de onde parou</span>
          <strong className="clamp-2">{resume.m.title}</strong>
          <span className="xr-bar" role="progressbar" aria-valuenow={Math.round(resume.ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento">
            <i style={{ width: `${Math.round(resume.ratio * 100)}%` }} />
          </span>
          <div className="row row-wrap">
            <span className="small dim">{Math.round(resume.ratio * 100)}% estudado</span>
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/m/${resume.m.id}?aba=passos`)}>
              {resume.started ? 'Continuar' : 'Começar'} →
            </button>
          </div>
        </section>
      )}

      {showGuide && (
        <section className="card stack xr-guide" aria-label="Primeiros passos">
          <div className="row">
            <strong>Primeiros passos</strong>
            <span className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => setSetting('guideHidden', true)}>
              Ocultar guia
            </button>
          </div>
          <ol className="xr-guide-steps">
            <GuideStep done={guide.created} n={1} title="Traga um material" text="Cole o texto, importe PDF ou Word, ou traga do Hub Bible.">
              {!guide.created && (
                <span className="row row-wrap">
                  <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
                    Novo material
                  </button>
                  <button className="btn btn-sm" onClick={openExample}>
                    Ver um exemplo
                  </button>
                </span>
              )}
            </GuideStep>
            <GuideStep done={guide.studied} n={2} title="Estude no passo a passo" text="Uma parte por vez, com anotação sua e o andamento guardado." />
            <GuideStep done={guide.cards} n={3} title="Crie cartões e revise" text="Na aba Cartões, “Sugerir cartões do texto”; depois revise um pouco por dia." />
          </ol>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/ajuda')}>
            <Icon name="info" size={16} /> Como usar o Hub Resumos
          </button>
        </section>
      )}

      {data && data.stats.materials > 0 && (
        <>
          <div className="search-field" style={{ marginBottom: 'var(--sp-3)' }}>
            <Icon name="search" size={18} className="dim" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por título, autor ou etiqueta" aria-label="Pesquisar materiais" />
          </div>
          <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }}>
            {(['todos', 'livro', 'estudo', 'resumo'] as const).map((k) => (
              <button key={k} className={`chip${kind === k ? ' active' : ''}`} onClick={() => setKind(k)} aria-pressed={kind === k}>
                {k === 'todos' ? 'Todos' : `${KIND_LABEL[k]}s`}
              </button>
            ))}
          </div>
        </>
      )}

      {data && !data.rows.length ? (
        <EmptyState
          icon="library"
          title="Sua biblioteca está vazia"
          description="Cole o texto de um estudo, importe um PDF ou Word, ou traga mensagens e estudos do Hub Bible. Se quiser conhecer antes, abra o exemplo."
          action={
            <span className="row row-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
                Novo material
              </button>
              <button className="btn btn-sm" onClick={openExample}>
                Ver um exemplo
              </button>
            </span>
          }
        />
      ) : data && !rows.length ? (
        <EmptyState
          icon="search"
          title="Nada encontrado"
          description="Nenhum material com esses filtros. Tente outra palavra ou volte para Todos."
          action={
            <button
              className="btn btn-sm"
              onClick={() => {
                setQuery('');
                setKind('todos');
              }}
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="grid grid-cards">
          {rows.map(({ m, ratio, due, cards }) => (
            <article key={m.id} className="card stack xr-mat" style={{ gap: 'var(--sp-2)' }}>
              <button className="xr-mat-open" onClick={() => navigate(`/m/${m.id}`)} aria-label={`Abrir ${m.title}`}>
                <span className="row" style={{ gap: 'var(--sp-2)' }}>
                  <span className="badge">{KIND_LABEL[m.kind]}</span>
                  {m.source.type === 'hub-bible' && <span className="badge">Hub Bible</span>}
                  {m.tags.includes('exemplo') && <span className="badge">Exemplo</span>}
                  <span className="spacer" />
                  <span className="small dim">{new Date(m.updatedAt).toLocaleDateString('pt-BR')}</span>
                </span>
                <span className="card-title clamp-2">{m.title}</span>
                {m.author && <span className="small dim">{m.author}</span>}
                {m.centralIdea && <span className="small muted clamp-2">{m.centralIdea}</span>}
                <span className="xr-bar" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento">
                  <i style={{ width: `${Math.round(ratio * 100)}%` }} />
                </span>
                <span className="small dim">
                  {m.sections.length} parte{m.sections.length === 1 ? '' : 's'} · {Math.round(ratio * 100)}% estudado
                  {cards ? ` · ${cards} cartões` : ''}
                  {due ? ` · ${due} para revisar` : ''}
                </span>
              </button>
              <div className="xr-mat-actions">
                <button
                  className="icon-btn"
                  aria-label={`Baixar ${m.title}`}
                  title="Baixar este material (.json)"
                  onClick={async () => {
                    downloadJson(await materialFile(m.id), `${safeName(m.title)} - Hub Resumos.json`);
                    notify('Material baixado. Para usar de novo: Novo material › Importar arquivo.');
                  }}
                >
                  <Icon name="download" size={18} />
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Duplicar ${m.title}`}
                  title="Duplicar"
                  onClick={async () => {
                    await duplicateMaterial(m.id);
                    notify('Cópia criada na biblioteca.');
                  }}
                >
                  <Icon name="duplicate" size={18} />
                </button>
                <button className="icon-btn xr-danger" aria-label={`Excluir ${m.title}`} title="Excluir este material" onClick={() => setRemoving(m)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Excluir este material?"
        message={`"${removing?.title ?? ''}" será removido deste aparelho, com o andamento, os cartões e o plano de ação dele. Os outros materiais da biblioteca não são afetados. Se quiser guardar antes, use o botão de baixar.`}
        confirmLabel="Excluir material"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await deleteMaterial(removing.id);
          notify(`“${removing.title}” foi excluído.`);
          setRemoving(null);
        }}
      />

      <NewMaterialSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Stat({ value, label, accent, onClick }: { value: number | string; label: string; accent?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <strong>{value}</strong>
      <span className="small dim">{label}</span>
    </>
  );
  return onClick ? (
    <button role="listitem" className={`xr-stat${accent ? ' accent' : ''}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div role="listitem" className={`xr-stat${accent ? ' accent' : ''}`}>
      {body}
    </div>
  );
}

function GuideStep({ done, n, title, text, children }: { done: boolean; n: number; title: string; text: string; children?: ReactNode }) {
  return (
    <li className={done ? 'done' : ''}>
      <span className="xr-step-num" aria-hidden="true">
        {done ? <Icon name="check" size={16} /> : n}
      </span>
      <span className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
        <strong>
          {title}
          {done && <span className="sr-only"> (feito)</span>}
        </strong>
        <span className="small muted">{text}</span>
        {children}
      </span>
    </li>
  );
}
