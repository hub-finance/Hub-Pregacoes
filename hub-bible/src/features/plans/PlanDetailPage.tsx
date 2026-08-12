import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProgressBar, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { bookName } from '../../core/bible/canon';
import { getPlan, nextPendingDay, planProgress, toggleDay } from '../../core/data/plans';
import { dayChapterCount } from '../../core/plans/templates';
import type { PlanDay, ReadingPlan } from '../../core/db/types';

const rangeLabel = (range: [string, number, number]) =>
  range[1] === range[2]
    ? `${bookName(range[0])} ${range[1]}`
    : `${bookName(range[0])} ${range[1]}-${range[2]}`;

export const dayLabel = (day: PlanDay) => day.ranges.map(rangeLabel).join(' · ');

/** Detalhe do plano: leitura do dia, progresso e histórico. */
export default function PlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [plan, setPlan] = useState<ReadingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const currentRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!id) return;
    getPlan(id).then((found) => {
      setPlan(found ?? null);
      setLoading(false);
    });
  }, [id]);

  const completed = useMemo(() => new Set(plan?.completedDays ?? []), [plan]);
  const current = plan ? nextPendingDay(plan) : 1;

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, [loading]);

  if (loading) return <Spinner label="Abrindo plano…" />;
  if (!plan) {
    return (
      <div className="page">
        <p className="muted">Plano não encontrado.</p>
        <button className="btn" onClick={() => navigate('/planos')}>
          Voltar
        </button>
      </div>
    );
  }

  const today = plan.days.find((d) => d.day === current);

  const mark = async (day: number) => {
    const updated = await toggleDay(plan.id, day);
    if (updated) setPlan(updated);
    notify(completed.has(day) ? 'Dia reaberto.' : 'Leitura concluída. Continue firme!');
  };

  const openDay = (day: PlanDay) => {
    const first = day.ranges[0];
    if (first) navigate(`/biblia/${first[0]}/${first[1]}`);
  };

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/planos')}>
          ← Planos
        </button>
      </div>

      <h1 className="page-title">{plan.name}</h1>
      <p className="page-lead">{plan.description}</p>

      <div className="card stack" style={{ marginTop: 'var(--sp-4)' }}>
        <ProgressBar value={planProgress(plan)} label={`${plan.completedDays.length} de ${plan.totalDays} dias`} />
        {today && (
          <>
            <div className="row">
              <span className="badge">Dia {today.day}</span>
              <span className="spacer" />
              <span className="small dim">{dayChapterCount(today)} capítulo(s)</span>
            </div>
            <p className="card-title">{dayLabel(today)}</p>
            <div className="row row-wrap">
              <button className="btn btn-primary" onClick={() => openDay(today)}>
                📖 Ler agora
              </button>
              <button className="btn" onClick={() => mark(today.day)}>
                ✓ Marcar como lido
              </button>
            </div>
          </>
        )}
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Cronograma</h2>
        </div>
        <ul className="list">
          {plan.days.map((day) => {
            const done = completed.has(day.day);
            return (
              <li
                key={day.day}
                className="list-item"
                ref={day.day === current ? currentRef : undefined}
                style={
                  day.day === current
                    ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                    : undefined
                }
              >
                <button
                  className="icon-btn"
                  aria-label={done ? `Reabrir dia ${day.day}` : `Concluir dia ${day.day}`}
                  onClick={() => mark(day.day)}
                  style={{ color: done ? 'var(--success)' : 'var(--text-3)' }}
                >
                  {done ? '☑' : '☐'}
                </button>
                <button className="list-body" style={{ textAlign: 'left' }} onClick={() => openDay(day)}>
                  <span className="list-title" style={{ opacity: done ? 0.6 : 1 }}>
                    {dayLabel(day)}
                  </span>
                  <span className="list-meta">
                    Dia {day.day} · {dayChapterCount(day)} capítulo(s)
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
