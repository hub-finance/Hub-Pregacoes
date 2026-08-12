import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../../app/navigation';
import { ShareSheet } from '../share/ShareSheet';
import { EmptyState, ProgressBar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks';
import { useSettings } from '../../core/settings/SettingsContext';
import { bookName } from '../../core/bible/canon';
import { getMeta } from '../../core/bible/repository';
import { getVerseOfDay } from '../../core/data/verseOfDay';
import { addFavorite } from '../../core/data/favorites';
import { createNote } from '../../core/data/notes';
import { readingStats } from '../../core/data/reading';
import { listPlans, nextPendingDay, planProgress } from '../../core/data/plans';
import { loadLibrary } from '../../core/data/documents';
import { DOC_ROUTE } from '../../core/data/documents';

/** Tela inicial: atalhos, continuidade de leitura e versículo do dia. */
export default function HomePage() {
  const { settings } = useSettings();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  const meta = useAsync(() => getMeta(settings.defaultTranslation), [settings.defaultTranslation]);
  const daily = useAsync(() => getVerseOfDay(settings.defaultTranslation), [settings.defaultTranslation]);
  const stats = useAsync(() => readingStats(), []);
  const plans = useAsync(() => listPlans(), []);
  const library = useAsync(() => loadLibrary(), []);

  const quickItems = NAV_ITEMS.filter((i) => i.quick);
  const position = settings.lastPosition;
  const activePlan = (plans.data ?? []).find((p) => !p.archived);
  const recent = (library.data ?? []).slice(0, 4);
  const greeting = settings.userName ? `Paz, ${settings.userName}.` : 'Que a Palavra guie o seu dia.';

  return (
    <div className="page">
      <section>
        <h1 className="page-title">Hub Bible</h1>
        <p className="page-lead">{greeting}</p>
      </section>

      {position && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Continue de onde parou</h2>
          </div>
          <Link
            className="card card-link row"
            to={`/biblia/${position.book}/${position.chapter}`}
            style={{ gap: 'var(--sp-4)' }}
          >
            <span aria-hidden="true" style={{ fontSize: '1.6rem' }}>
              📖
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="card-title" style={{ display: 'block' }}>
                {bookName(position.book)} {position.chapter}
              </span>
              <span className="small dim">{meta.data?.name ?? position.translation}</span>
            </span>
            <span className="dim">›</span>
          </Link>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Acesso rápido</h2>
        </div>
        <div className="grid grid-quick">
          {quickItems.map((item) => (
            <Link key={item.to} to={item.to} className="quick">
              <span className="ico" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Versículo do dia</h2>
        </div>
        {daily.loading && <div className="card">Carregando…</div>}
        {daily.data && (
          <div className="verse-hero">
            <p className="verse-hero-text">“{daily.data.text}”</p>
            <p className="verse-hero-ref">{daily.data.reference}</p>
            <div className="row row-wrap" style={{ marginTop: 'var(--sp-4)' }}>
              <button className="btn btn-sm" onClick={() => setShareOpen(true)}>
                📤 Compartilhar
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await addFavorite({
                    ref: {
                      translation: settings.defaultTranslation,
                      book: daily.data!.book,
                      chapter: daily.data!.chapter,
                      verse: daily.data!.verse,
                    },
                    reference: daily.data!.reference,
                    text: daily.data!.text,
                    category: 'promessas',
                  });
                  notify('Adicionado aos favoritos.');
                }}
              >
                ⭐ Favoritar
              </button>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await createNote({
                    targetType: 'verse',
                    reference: daily.data!.reference,
                    content: '',
                    ref: {
                      translation: settings.defaultTranslation,
                      book: daily.data!.book,
                      chapter: daily.data!.chapter,
                      verse: daily.data!.verse,
                    },
                  });
                  navigate('/anotacoes');
                }}
              >
                📝 Anotar
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() =>
                  navigate(`/biblia/${daily.data!.book}/${daily.data!.chapter}?v=${daily.data!.verse}`)
                }
              >
                Abrir no texto →
              </button>
            </div>
          </div>
        )}
        {!daily.loading && !daily.data && (
          <div className="card">
            <EmptyState
              icon="📖"
              title="Texto ainda não disponível"
              description="Abra a Bíblia uma vez para baixar o texto e o versículo do dia aparecerá aqui."
              action={
                <Link className="btn btn-primary btn-sm" to="/biblia">
                  Abrir a Bíblia
                </Link>
              }
            />
          </div>
        )}
      </section>

      {activePlan && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Plano de leitura</h2>
            <Link className="small" to="/planos" style={{ color: 'var(--accent-strong)' }}>
              ver todos
            </Link>
          </div>
          <Link className="card card-link stack" to={`/planos/${activePlan.id}`}>
            <div className="row">
              <span className="card-title" style={{ flex: 1 }}>
                {activePlan.name}
              </span>
              <span className="badge">Dia {nextPendingDay(activePlan)}</span>
            </div>
            <ProgressBar value={planProgress(activePlan)} label="Progresso" />
          </Link>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Sua caminhada</h2>
          <Link className="small" to="/painel" style={{ color: 'var(--accent-strong)' }}>
            painel completo
          </Link>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div className="stat">
            <div className="stat-value">{stats.data?.streak ?? 0}</div>
            <div className="stat-label">dias seguidos</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.data?.distinctChapters ?? 0}</div>
            <div className="stat-label">capítulos lidos</div>
          </div>
          <div className="stat">
            <div className="stat-value">{library.data?.length ?? 0}</div>
            <div className="stat-label">itens na biblioteca</div>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Retomar o preparo</h2>
            <Link className="small" to="/biblioteca" style={{ color: 'var(--accent-strong)' }}>
              biblioteca
            </Link>
          </div>
          <div className="list">
            {recent.map((entry) => (
              <Link
                key={entry.id}
                className="list-item"
                to={
                  entry.kind === 'doc'
                    ? `/biblioteca/material/${entry.id}`
                    : `${DOC_ROUTE[entry.kind]}/${entry.id}`
                }
              >
                <span className="list-body">
                  <span className="list-title truncate">{entry.title}</span>
                  <span className="list-meta truncate">{entry.subtitle || entry.category}</span>
                </span>
                <span className="badge">{entry.category}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {daily.data && (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          reference={daily.data.reference}
          text={daily.data.text}
          translationLabel={meta.data?.abbrev}
        />
      )}
    </div>
  );
}
