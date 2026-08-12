import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../components/ui';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { db } from '../../core/db/db';
import { categoryColor } from '../../core/categories';
import { countHighlightsByCategory } from '../../core/data/highlights';
import { readingStats } from '../../core/data/reading';

/** Painel "Minha vida ministerial" — seção 34 da especificação. */
export default function DashboardPage() {
  const { categories } = useSettings();
  const stats = useAsync(() => readingStats(), []);
  const byCategory = useAsync(() => countHighlightsByCategory(), []);

  const counts = useLiveQuery(
    async () => ({
      sermons: await db.sermons.count(),
      studies: await db.studies.count(),
      devotionals: await db.devotionals.count(),
      docs: await db.libraryDocs.count(),
      notes: await db.notes.count(),
      favorites: await db.favorites.count(),
      highlights: await db.highlights.count(),
      plans: await db.plans.count(),
    }),
    [],
    null,
  );

  const last7 = stats.data?.last7 ?? [];
  const peak = Math.max(1, ...last7.map((d) => d.count));
  const totalHighlights = Object.values(byCategory.data ?? {}).reduce((a, b) => a + b, 0);

  const cards = [
    { label: 'Sermões preparados', value: counts?.sermons ?? 0, to: '/sermoes', icon: '🎙️' },
    { label: 'Estudos realizados', value: counts?.studies ?? 0, to: '/estudos', icon: '📚' },
    { label: 'Devocionais', value: counts?.devotionals ?? 0, to: '/devocionais', icon: '🙏' },
    { label: 'Materiais', value: counts?.docs ?? 0, to: '/biblioteca', icon: '📂' },
    { label: 'Capítulos lidos', value: stats.data?.distinctChapters ?? 0, to: '/biblia', icon: '📖' },
    { label: 'Dias consecutivos', value: stats.data?.streak ?? 0, to: '/planos', icon: '🔥' },
    { label: 'Versículos favoritos', value: counts?.favorites ?? 0, to: '/favoritos', icon: '⭐' },
    { label: 'Anotações criadas', value: counts?.notes ?? 0, to: '/anotacoes', icon: '📝' },
  ];

  return (
    <div className="page page-wide">
      <PageHeader
        title="Minha vida ministerial"
        lead="Um retrato da sua caminhada na Palavra e no preparo."
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {cards.map((card) => (
          <Link key={card.label} className="stat card-link" to={card.to}>
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">
              <span aria-hidden="true">{card.icon}</span> {card.label}
            </div>
          </Link>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Leitura nos últimos 7 dias</h2>
        </div>
        <div className="card">
          <div
            className="row"
            style={{ alignItems: 'flex-end', gap: 'var(--sp-2)', height: 140, marginBottom: 'var(--sp-2)' }}
          >
            {last7.map((day) => (
              <div key={day.day} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  title={`${day.count} capítulo(s)`}
                  style={{
                    height: `${Math.max(6, (day.count / peak) * 116)}px`,
                    background:
                      day.count > 0
                        ? 'linear-gradient(180deg, var(--accent), var(--accent-strong))'
                        : 'var(--surface-2)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)',
                  }}
                />
                <div className="small dim" style={{ marginTop: 6 }}>
                  {new Date(`${day.day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
              </div>
            ))}
          </div>
          <p className="small dim">
            {stats.data?.chaptersRead ?? 0} leituras registradas em {stats.data?.daysActive ?? 0} dia(s).
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Marcações por categoria</h2>
          <span className="small dim">{totalHighlights} no total</span>
        </div>
        <div className="card stack">
          {totalHighlights === 0 && (
            <p className="small dim">
              Você ainda não destacou versículos. Na leitura, selecione um versículo e escolha “Destacar”.
            </p>
          )}
          {categories
            .map((c) => ({ ...c, count: byCategory.data?.[c.id] ?? 0 }))
            .filter((c) => c.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((c) => (
              <div key={c.id} className="row">
                <span className="chip-dot" style={{ background: categoryColor(c.id) }} aria-hidden="true" />
                <span style={{ flex: 1 }}>{c.label}</span>
                <div className="progress" style={{ width: 140 }}>
                  <i style={{ width: `${(c.count / totalHighlights) * 100}%`, background: categoryColor(c.id) }} />
                </div>
                <span className="mono-num small dim" style={{ width: 32, textAlign: 'right' }}>
                  {c.count}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
