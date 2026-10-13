import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
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

export const TABS = [
  { id: 'painel', label: 'Painel' },
  { id: 'passos', label: 'Passo a passo' },
  { id: 'dna', label: 'DNA' },
  { id: 'mapa', label: 'Mapa mental' },
  { id: 'quadros', label: 'Quadros' },
  { id: 'cartoes', label: 'Cartões' },
  { id: 'consulta', label: 'Consulta rápida' },
  { id: 'acoes', label: 'Plano de ação' },
  { id: 'resumo', label: 'Resumo' },
  { id: 'infografico', label: 'Infográfico' },
  { id: 'editar', label: 'Editar' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** Um material aberto: todas as visões dele, em abas. */
export default function MaterialPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('aba'))?.id ?? 'painel') as TabId;
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
    setParams(next === 'painel' ? { ...extra } : { aba: next, ...extra }, { replace: false });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="page page-wide">
      <div className="row row-wrap" style={{ marginBottom: 'var(--sp-2)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          ← Biblioteca
        </button>
      </div>
      <header style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="row row-wrap" style={{ gap: 'var(--sp-2)' }}>
          <span className="badge">{KIND_LABEL[material.kind]}</span>
          {material.author && <span className="small dim">{material.author}</span>}
        </div>
        <h1 className="page-title" style={{ overflowWrap: 'anywhere' }}>
          {material.title}
        </h1>
      </header>

      <div className="tabs xr-tabs" role="tablist" style={{ marginBottom: 'var(--sp-4)' }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'calc(-1 * var(--sp-2))', marginBottom: 'var(--sp-2)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/ajuda?t=${tab}`)}>
          ? Como usar: {TABS.find((t) => t.id === tab)?.label}
        </button>
      </div>

      {tab === 'painel' && <DashboardTab material={material} reading={reading} go={go} />}
      {tab === 'passos' && <StepsTab material={material} />}
      {tab === 'dna' && <DnaTab material={material} reading={reading} />}
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
