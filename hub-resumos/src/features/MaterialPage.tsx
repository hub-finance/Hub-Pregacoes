import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Breadcrumb } from '../components/Breadcrumb';
import { Spinner } from '../components/ui';
import { db } from '../core/db';
import { KIND_LABEL, touchMaterial } from '../core/materials';
import { readMaterial } from '../core/text';
import { ActionsTab } from './material/ActionsTab';
import { CardsTab } from './material/CardsTab';
import { DashboardTab } from './material/DashboardTab';
import { BoardsTab } from './material/BoardsTab';
import { DnaTab } from './material/DnaTab';
import { EditTab } from './material/EditTab';
import { InfographicTab } from './material/InfographicTab';
import { MapTab } from './material/MapTab';
import { QuickSheetTab } from './material/QuickSheetTab';
import { StepsTab } from './material/StepsTab';
import { SummaryTab } from './material/SummaryTab';
import { AplicarTab } from './layers/AplicarTab';
import { AprofundarTab } from './layers/AprofundarTab';
import { CaptarTab } from './layers/CaptarTab';
import { CompreenderTab } from './layers/CompreenderTab';
import { DnaMatrixTab } from './layers/DnaMatrixTab';

/**
 * As abas seguem as 4 camadas de aprendizagem da auditoria do usuário
 * (docs/AJUSTES-RESUMOS.md) e o DNA; depois o estudo do texto e a edição.
 * As ferramentas anteriores continuam em "Mais ferramentas".
 */
export const TABS = [
  { id: 'captar', label: 'Captar', group: 'main' },
  { id: 'compreender', label: 'Compreender', group: 'main' },
  { id: 'aprofundar', label: 'Aprofundar', group: 'main' },
  { id: 'aplicar', label: 'Aplicar', group: 'main' },
  { id: 'dna', label: 'DNA', group: 'main' },
  { id: 'passos', label: 'Passo a passo', group: 'main' },
  { id: 'editar', label: 'Editar', group: 'main' },
  { id: 'painel', label: 'Painel', group: 'more' },
  { id: 'cartoes', label: 'Cartões (revisão)', group: 'more' },
  { id: 'acoes', label: 'Plano de ação', group: 'more' },
  { id: 'consulta', label: 'Consulta rápida', group: 'more' },
  { id: 'resumo', label: 'Resumo', group: 'more' },
  { id: 'analise', label: 'Análise do texto', group: 'more' },
  { id: 'mapa', label: 'Mapa em círculos', group: 'more' },
  { id: 'quadros', label: 'Quadros', group: 'more' },
  { id: 'infografico', label: 'Infográfico', group: 'more' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** Um material aberto: todas as visões dele, em abas. */
export default function MaterialPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('aba'))?.id ?? 'captar') as TabId;
  const [moreOpen, setMoreOpen] = useState(false);
  const material = useLiveQuery(() => (id ? db.materials.get(id) : undefined), [id], null);
  const reading = useMemo(() => (material ? readMaterial(material) : null), [material]);

  useEffect(() => {
    if (id) void touchMaterial(id);
  }, [id]);

  if (material === null) return <Spinner label="Abrindo…" />;
  if (!material || !reading) {
    return (
      <div className="page">
        <p className="muted">Material não encontrado.</p>
        <button className="btn" onClick={() => navigate('/')}>
          Voltar à biblioteca
        </button>
      </div>
    );
  }

  const go = (next: TabId, extra?: Record<string, string>) => {
    setParams(next === 'captar' ? { ...extra } : { aba: next, ...extra }, { replace: false });
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="page page-wide">
      <Breadcrumb
        items={[
          { label: 'Biblioteca', to: '/' },
          { label: material.title, to: `/m/${material.id}` },
          { label: TABS.find((t) => t.id === tab)?.label ?? '' },
        ]}
      />
      <header style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
          <span className="badge">{KIND_LABEL[material.kind]}</span>
          {material.author && <span className="small dim">{material.author}</span>}
        </div>
        <h1 className="page-title" style={{ overflowWrap: 'anywhere' }}>
          {material.title}
        </h1>
      </header>

      <div className="tabs xr-tabs" role="tablist" style={{ marginBottom: moreOpen ? 'var(--sp-2)' : 'var(--sp-4)' }}>
        {TABS.filter((t) => t.group === 'main' || t.id === tab).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
        <button className="tab" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          Mais ferramentas {moreOpen ? '▴' : '▾'}
        </button>
      </div>
      {moreOpen && (
        <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }} aria-label="Mais ferramentas">
          {TABS.filter((t) => t.group === 'more').map((t) => (
            <button key={t.id} className={`chip${tab === t.id ? ' active' : ''}`} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'calc(-1 * var(--sp-2))', marginBottom: 'var(--sp-2)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/ajuda?t=${tab}`)}>
          ? Como usar: {TABS.find((t) => t.id === tab)?.label}
        </button>
      </div>

      {tab === 'captar' && <CaptarTab material={material} reading={reading} />}
      {tab === 'compreender' && <CompreenderTab material={material} reading={reading} />}
      {tab === 'aprofundar' && <AprofundarTab material={material} reading={reading} />}
      {tab === 'aplicar' && <AplicarTab material={material} reading={reading} />}
      {tab === 'dna' && <DnaMatrixTab material={material} reading={reading} />}
      {tab === 'painel' && <DashboardTab material={material} reading={reading} go={go} />}
      {tab === 'passos' && <StepsTab material={material} />}
      {tab === 'analise' && <DnaTab material={material} reading={reading} />}
      {tab === 'mapa' && <MapTab material={material} reading={reading} />}
      {tab === 'quadros' && <BoardsTab material={material} reading={reading} />}
      {tab === 'cartoes' && <CardsTab material={material} />}
      {tab === 'consulta' && <QuickSheetTab material={material} reading={reading} />}
      {tab === 'acoes' && <ActionsTab material={material} />}
      {tab === 'resumo' && <SummaryTab material={material} reading={reading} />}
      {tab === 'infografico' && <InfographicTab material={material} reading={reading} />}
      {tab === 'editar' && <EditTab material={material} />}
    </div>
  );
}
