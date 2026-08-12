import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { EmptyState, PageHeader, ProgressBar, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { getMeta } from '../../core/bible/repository';
import { PLAN_TEMPLATES, type PlanTemplate } from '../../core/plans/templates';
import { listPlans, nextPendingDay, planProgress, removePlan, startPlan } from '../../core/data/plans';
import type { ReadingPlan } from '../../core/db/types';

/** Planos de leitura — seção 16 da especificação. */
export default function PlansPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { settings } = useSettings();
  const meta = useAsync(() => getMeta(settings.defaultTranslation), [settings.defaultTranslation]);
  const plans = useLiveQuery(() => listPlans(), [], [] as ReadingPlan[]);

  const [creating, setCreating] = useState<PlanTemplate | null>(null);
  const [days, setDays] = useState('30');
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);

  const books = meta.data?.books ?? [];
  const isCustom = creating?.id === 'personalizado';

  const preview = useMemo(() => {
    if (!creating || !books.length) return null;
    const total = isCustom
      ? selectedBooks.length
        ? books.filter((b) => selectedBooks.includes(b.osis)).reduce((sum, b) => sum + b.chapters, 0)
        : books.reduce((sum, b) => sum + b.chapters, 0)
      : books
          .filter((b) => !creating.books.length || creating.books.includes(b.osis))
          .reduce((sum, b) => sum + b.chapters, 0);
    const dayCount = isCustom ? Math.max(1, Number(days) || 1) : creating.days;
    return { total, perDay: (total / dayCount).toFixed(1), dayCount };
  }, [creating, books, isCustom, selectedBooks, days]);

  const confirm = async () => {
    if (!creating) return;
    const plan = await startPlan(creating, books, {
      days: isCustom ? Math.max(1, Number(days) || 1) : creating.days,
      books: isCustom ? selectedBooks : undefined,
    });
    setCreating(null);
    notify('Plano iniciado.');
    navigate(`/planos/${plan.id}`);
  };

  return (
    <div className="page">
      <PageHeader title="Planos de leitura" lead="Constância gera profundidade." />

      {(plans ?? []).length > 0 && (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <h2 className="section-title">Meus planos</h2>
          </div>
          <div className="stack">
            {(plans ?? []).map((plan) => (
              <article key={plan.id} className="card stack">
                <div className="row">
                  <button
                    className="card-title"
                    style={{ textAlign: 'left', flex: 1 }}
                    onClick={() => navigate(`/planos/${plan.id}`)}
                  >
                    {plan.name}
                  </button>
                  <span className="badge">
                    dia {nextPendingDay(plan)}/{plan.totalDays}
                  </span>
                </div>
                <ProgressBar value={planProgress(plan)} label="Progresso" />
                <div className="row row-wrap">
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/planos/${plan.id}`)}>
                    Continuar
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={async () => {
                      await removePlan(plan.id);
                      notify('Plano removido.');
                    }}
                  >
                    Remover
                  </button>
                  <div className="spacer" />
                  <span className="small dim">
                    {plan.completedDays.length} de {plan.totalDays} dias
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Começar um plano</h2>
        </div>
        <div className="grid grid-cards">
          {PLAN_TEMPLATES.map((template) => (
            <article key={template.id} className="card stack">
              <h3 className="card-title">{template.name}</h3>
              <p className="small muted">{template.description}</p>
              <div className="row">
                <span className="badge">
                  {template.id === 'personalizado' ? 'você escolhe' : `${template.days} dias`}
                </span>
                <div className="spacer" />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setCreating(template);
                    setDays(String(template.days));
                    setSelectedBooks([]);
                  }}
                >
                  Iniciar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {!(plans ?? []).length && (
        <EmptyState
          icon="📅"
          title="Nenhum plano em andamento"
          description="Escolha um dos planos acima e acompanhe seu progresso dia a dia."
        />
      )}

      <Sheet
        open={!!creating}
        title={creating?.name ?? ''}
        onClose={() => setCreating(null)}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCreating(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirm} disabled={!books.length}>
              Iniciar plano
            </button>
          </>
        }
      >
        <p className="muted small">{creating?.description}</p>

        {isCustom && (
          <>
            <TextInput label="Duração (dias)" value={days} onChange={setDays} inputMode="numeric" />
            <div>
              <p className="section-title" style={{ marginBottom: 'var(--sp-2)' }}>
                Livros ({selectedBooks.length || 'todos'})
              </p>
              <div className="row row-wrap" style={{ marginBottom: 'var(--sp-2)' }}>
                <button className="btn btn-sm" onClick={() => setSelectedBooks([])}>
                  Toda a Bíblia
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setSelectedBooks(books.filter((b) => b.testament === 'AT').map((b) => b.osis))}
                >
                  Antigo Testamento
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setSelectedBooks(books.filter((b) => b.testament === 'NT').map((b) => b.osis))}
                >
                  Novo Testamento
                </button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                {books.map((b) => (
                  <button
                    key={b.osis}
                    className={`chip${selectedBooks.includes(b.osis) ? ' active' : ''}`}
                    onClick={() =>
                      setSelectedBooks((prev) =>
                        prev.includes(b.osis) ? prev.filter((x) => x !== b.osis) : [...prev, b.osis],
                      )
                    }
                  >
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {preview && (
          <div className="notice notice-accent">
            <span aria-hidden="true">📊</span>
            <span>
              {preview.total} capítulos em {preview.dayCount} dias — cerca de {preview.perDay} capítulos por dia.
            </span>
          </div>
        )}
      </Sheet>
    </div>
  );
}
