import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { getDoctrinalGuides, getTheologicalEntry } from '../../core/bible/reference-data';
import { shareFile } from '../../core/share/share';
import {
  doctrinalPackFile,
  getDoctrinalPack,
  importDoctrinalPack,
  removeDoctrinalPack,
  type PackGuide,
  type PackStep,
} from '../../core/bible/doctrinalPack';
import { CANON_BY_OSIS } from '../../core/bible/canon';
import type { DoctrinalGuide, GuideStep } from '../../core/bible/reference-data';

function formatRef(key: string): { label: string; path: string } {
  const [b, c, v] = key.split('.');
  const canon = CANON_BY_OSIS.get(b);
  const name = canon?.abbrev ?? b;
  const first = v.split('-')[0];
  return { label: `${name} ${c}:${v}`, path: `/biblia/${b}/${c}?v=${first}` };
}

function RefBadges({ textos }: { textos: string[] }) {
  return (
    <div className="row row-wrap" style={{ gap: 'var(--sp-1)' }}>
      {textos.map((t) => {
        const { label, path } = formatRef(t);
        return (
          <Link key={t} to={path} className="badge badge-link">
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function StepNumber({ index }: { index: number }) {
  return (
    <span
      className="badge"
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {index + 1}
    </span>
  );
}

function StepCard({ step, index }: { step: GuideStep; index: number }) {
  const entry = useAsync(() => getTheologicalEntry(step.verbete), [step.verbete]);

  return (
    <div className="card stack" style={{ gap: 'var(--sp-2)' }}>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>
        <StepNumber index={index} />
        <strong style={{ fontSize: '1.05rem' }}>{step.conceito}</strong>
      </div>
      <p className="small" style={{ margin: 0 }}>{step.resumo}</p>
      <RefBadges textos={step.textos} />
      {entry.data && (
        <details className="small" style={{ marginTop: 'var(--sp-1)' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>
            Ver verbete: {entry.data.termo}
          </summary>
          <p className="muted" style={{ marginTop: 'var(--sp-2)' }}>
            {entry.data.definicao}
          </p>
        </details>
      )}
    </div>
  );
}

function PackStepCard({ step, index }: { step: PackStep; index: number }) {
  return (
    <div className="card stack" style={{ gap: 'var(--sp-2)' }}>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>
        <StepNumber index={index} />
        <strong style={{ fontSize: '1.05rem' }}>{step.conceito}</strong>
      </div>
      <p style={{ margin: 0, fontWeight: 600 }}>{step.resumo}</p>
      <RefBadges textos={step.textos} />
      {step.explicacao.split(/\n\s*\n/).map((p, i) => (
        <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>{p}</p>
      ))}
      {!!step.original?.length && (
        <div className="stack small" style={{ gap: 'var(--sp-1)' }}>
          {step.original.map((o) => (
            <div key={o.termo}>
              <strong>{o.termo}</strong>
              {o.transliteracao && <span className="muted"> ({o.transliteracao})</span>}
              <span> — {o.significado}</span>
            </div>
          ))}
        </div>
      )}
      {step.aplicacao && (
        <div className="notice notice-accent small">
          <Icon name="sparkle" size={18} style={{ flex: 'none' }} />
          <span>{step.aplicacao}</span>
        </div>
      )}
    </div>
  );
}

function DetailHeader({ title, lead, onBack }: { title: string; lead: string; onBack: () => void }) {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Voltar">
          <Icon name="chevron-left" size={18} />
          Guias
        </button>
      </div>
      <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{title}</h2>
      <p className="muted" style={{ marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
        {lead}
      </p>
    </>
  );
}

function GuideDetail({ guide, onBack }: { guide: DoctrinalGuide; onBack: () => void }) {
  return (
    <div className="page">
      <DetailHeader title={guide.titulo} lead={guide.descricao} onBack={onBack} />
      <div className="stack" style={{ gap: 'var(--sp-3)' }}>
        {guide.passos.map((step, i) => (
          <StepCard key={step.verbete} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

function PackGuideDetail({ guide, onBack }: { guide: PackGuide; onBack: () => void }) {
  return (
    <div className="page">
      <DetailHeader title={guide.titulo} lead={guide.descricao} onBack={onBack} />
      {guide.fonte && <p className="small dim" style={{ marginTop: 0 }}>{guide.fonte}</p>}
      <div className="stack" style={{ gap: 'var(--sp-3)' }}>
        {guide.passos.map((step, i) => (
          <PackStepCard key={step.conceito} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

function GuideListItem({ title, meta, onOpen }: { title: string; meta: string; onOpen: () => void }) {
  return (
    <button
      className="list-item"
      onClick={onOpen}
      style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
    >
      <Icon name="layers" size={22} className="dim" style={{ flexShrink: 0 }} />
      <span className="list-body">
        <span className="list-title">{title}</span>
        <span className="list-meta">{meta}</span>
      </span>
      <Icon name="chevron-right" size={18} className="dim" />
    </button>
  );
}

const stepMeta = (passos: Array<{ textos: string[] }>) =>
  `${passos.length} passos · ${passos.reduce((n, s) => n + s.textos.length, 0)} textos`;

export default function GuidesPage() {
  const { notify } = useToast();
  const { data, loading } = useAsync(() => getDoctrinalGuides(), []);
  const pack = useAsync(() => getDoctrinalPack(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (loading || pack.loading) return <Spinner />;

  const packGuide = selected?.startsWith('pack:')
    ? pack.data?.guias.find((g) => `pack:${g.id}` === selected)
    : null;
  if (packGuide) return <PackGuideDetail guide={packGuide} onBack={() => setSelected(null)} />;
  const guide = selected ? data?.find((g) => g.id === selected) : null;
  if (guide) return <GuideDetail guide={guide} onBack={() => setSelected(null)} />;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = await importDoctrinalPack(file);
      notify(`${imported.nome}: ${imported.guias.length} guias importados neste aparelho.`);
      pack.reload();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Guias Doutrinários"
        lead="Roteiros de estudo temático — cada guia percorre os conceitos-chave de um assunto, com textos bíblicos e verbetes do dicionário teológico."
      />

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      <div className="card stack" style={{ marginBottom: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
        <div className="row" style={{ gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
          <Icon name="lock" size={22} style={{ flex: 'none', color: 'var(--accent-strong)' }} />
          <span className="list-body" style={{ flex: 1, minWidth: 0 }}>
            <span className="list-title">{pack.data ? pack.data.nome : 'Base doutrinária'}</span>
            <span className="list-meta">
              {pack.data
                ? `${pack.data.guias.length} guias, só neste aparelho. Também orientam a seção "Leitura na linha da fé" da exegese.`
                : 'Importe o arquivo da sua base doutrinária. Ela fica só neste aparelho e orienta a exegese.'}
            </span>
          </span>
        </div>
        {pack.data ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
            <button
              className="btn btn-sm"
              style={{ gridColumn: '1 / -1' }}
              onClick={async () => {
                if (!pack.data) return;
                const { blob, filename } = doctrinalPackFile(pack.data);
                const result = await shareFile(blob, filename);
                notify(result === 'shared' ? 'Arquivo pronto para enviar.' : `Arquivo ${filename} baixado.`);
              }}
            >
              <Icon name="share" size={18} />
              Compartilhar base
            </button>
            <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
              Substituir
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(true)}>
              <Icon name="trash" size={18} />
              Remover
            </button>
          </div>
        ) : (
          <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={18} />
            Importar
          </button>
        )}
      </div>

      {!!pack.data?.guias.length && (
        <>
          <h2 className="section-title">Da sua base</h2>
          <div className="list" style={{ marginBottom: 'var(--sp-5)' }}>
            {pack.data.guias.map((g) => (
              <GuideListItem
                key={g.id}
                title={g.titulo}
                meta={stepMeta(g.passos)}
                onOpen={() => setSelected(`pack:${g.id}`)}
              />
            ))}
          </div>
          <h2 className="section-title">Que acompanham o aplicativo</h2>
        </>
      )}

      {!data?.length ? (
        <EmptyState icon="layers" title="Nenhum guia disponível." />
      ) : (
        <div className="list">
          {data.map((g) => (
            <GuideListItem
              key={g.id}
              title={g.titulo}
              meta={stepMeta(g.passos)}
              onOpen={() => setSelected(g.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remover a base doutrinária?"
        message="Os guias importados saem deste aparelho e a exegese deixa de usá-los. O seu arquivo continua onde estava; dá para importar de novo."
        confirmLabel="Remover"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          setConfirmRemove(false);
          await removeDoctrinalPack();
          notify('Base doutrinária removida deste aparelho.');
          pack.reload();
        }}
      />
    </div>
  );
}
