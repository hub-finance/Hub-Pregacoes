import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { EmptyState, PageHeader, Spinner } from '../../components/ui';
import { useAsync } from '../../hooks';
import { getDoctrinalGuides, getTheologicalEntry } from '../../core/bible/reference-data';
import { CANON_BY_OSIS } from '../../core/bible/canon';
import type { DoctrinalGuide, GuideStep } from '../../core/bible/reference-data';

function formatRef(key: string): { label: string; path: string } {
  const [b, c, v] = key.split('.');
  const canon = CANON_BY_OSIS.get(b);
  const name = canon?.abbrev ?? b;
  return { label: `${name} ${c}:${v}`, path: `/biblia/${b}/${c}?v=${v}` };
}

function StepCard({ step, index }: { step: GuideStep; index: number }) {
  const entry = useAsync(() => getTheologicalEntry(step.verbete), [step.verbete]);

  return (
    <div className="card stack" style={{ gap: 'var(--sp-2)' }}>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>
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
        <strong style={{ fontSize: '1.05rem' }}>{step.conceito}</strong>
      </div>
      <p className="small" style={{ margin: 0 }}>{step.resumo}</p>
      <div className="row row-wrap" style={{ gap: 'var(--sp-1)' }}>
        {step.textos.map((t) => {
          const { label, path } = formatRef(t);
          return (
            <Link key={t} to={path} className="badge badge-link">
              {label}
            </Link>
          );
        })}
      </div>
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

function GuideDetail({ guide, onBack }: { guide: DoctrinalGuide; onBack: () => void }) {
  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 'var(--sp-3)' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" size={18} />
          Guias
        </button>
      </div>
      <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{guide.titulo}</h2>
      <p className="muted" style={{ marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
        {guide.descricao}
      </p>

      <div className="stack" style={{ gap: 'var(--sp-3)' }}>
        {guide.passos.map((step, i) => (
          <StepCard key={step.verbete} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

export default function GuidesPage() {
  const { data, loading } = useAsync(() => getDoctrinalGuides(), []);
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <Spinner />;

  const guide = selected ? data?.find((g) => g.id === selected) : null;
  if (guide) return <GuideDetail guide={guide} onBack={() => setSelected(null)} />;

  return (
    <div className="page">
      <PageHeader
        title="Guias Doutrinários"
        lead="Roteiros de estudo temático — cada guia percorre os conceitos-chave de um assunto, com textos bíblicos e verbetes do dicionário teológico."
      />

      {!data?.length ? (
        <EmptyState icon="layers" title="Nenhum guia disponível." />
      ) : (
        <div className="list">
          {data.map((g) => (
            <button
              key={g.id}
              className="list-item"
              onClick={() => setSelected(g.id)}
              style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <Icon name="layers" size={22} className="dim" style={{ flexShrink: 0 }} />
              <span className="list-body">
                <span className="list-title">{g.titulo}</span>
                <span className="list-meta">
                  {g.passos.length} passos · {g.passos.reduce((n, s) => n + s.textos.length, 0)} textos
                </span>
              </span>
              <Icon name="chevron-right" size={18} className="dim" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
