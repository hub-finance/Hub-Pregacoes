import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Breadcrumb } from '../components/Breadcrumb';
import { Spinner } from '../components/ui';
import { db } from '../core/db';
import { KIND_LABEL, touchMaterial } from '../core/materials';
import { readMaterial, sectionsKey } from '../core/text';
import { ActionsTab } from './material/ActionsTab';
import { CardsTab } from './material/CardsTab';
import { EditTab } from './material/EditTab';
import { ImagesTab } from './material/ImagesTab';
import { StepsTab } from './material/StepsTab';
import { SummaryTab } from './material/SummaryTab';
import { AplicarTab } from './layers/AplicarTab';
import { AprofundarTab } from './layers/AprofundarTab';
import { CaptarTab } from './layers/CaptarTab';
import { CompreenderTab } from './layers/CompreenderTab';
import { DnaMatrixTab } from './layers/DnaMatrixTab';

/**
 * As abas seguem as 4 camadas de aprendizagem (docs/AJUSTES-RESUMOS.md), o
 * DNA, o estudo do texto e a edição. Em "Ferramentas" ficam só as que têm
 * função própria (auditoria da etapa 1, docs/AUDITORIA-ETAPA1.md): revisão
 * espaçada, plano de ação, resumo completo e imagens para compartilhar.
 */
export const TABS = [
  { id: 'captar', label: 'Captar', group: 'main' },
  { id: 'compreender', label: 'Compreender', group: 'main' },
  { id: 'aprofundar', label: 'Aprofundar', group: 'main' },
  { id: 'aplicar', label: 'Aplicar', group: 'main' },
  { id: 'dna', label: 'DNA', group: 'main' },
  { id: 'passos', label: 'Passo a passo', group: 'main' },
  { id: 'editar', label: 'Editar', group: 'main' },
  { id: 'cartoes', label: 'Cartões de revisão', group: 'more' },
  { id: 'acoes', label: 'Plano de ação', group: 'more' },
  { id: 'resumo', label: 'Resumo completo', group: 'more' },
  { id: 'imagens', label: 'Imagens (quadros e infográfico)', group: 'more' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

/** Um material aberto: todas as visões dele, em abas. */
export default function MaterialPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // abas antigas que foram juntadas (links e favoritos antigos continuam funcionando)
  const asked = { quadros: 'imagens', infografico: 'imagens' }[params.get('aba') ?? ''] ?? params.get('aba');
  const tab = (TABS.find((t) => t.id === asked)?.id ?? 'captar') as TabId;
  const [moreOpen, setMoreOpen] = useState(false);
  const material = useLiveQuery(() => (id ? db.materials.get(id) : undefined), [id], null);
  const textKey = material ? sectionsKey(material.sections) : '';
  // só o texto das partes conta para a leitura (ver sectionsKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reading = useMemo(() => (material ? readMaterial(material) : null), [material?.id, textKey]);

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
          Ferramentas {moreOpen ? '▴' : '▾'}
        </button>
      </div>
      {moreOpen && (
        <div className="chip-row" style={{ marginBottom: 'var(--sp-4)' }} aria-label="Ferramentas">
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
      {tab === 'passos' && <StepsTab material={material} />}
      {tab === 'imagens' && <ImagesTab material={material} reading={reading} />}
      {tab === 'cartoes' && <CardsTab material={material} />}
      {tab === 'acoes' && <ActionsTab material={material} />}
      {tab === 'resumo' && <SummaryTab material={material} reading={reading} />}
      {tab === 'editar' && <EditTab material={material} />}
    </div>
  );
}
