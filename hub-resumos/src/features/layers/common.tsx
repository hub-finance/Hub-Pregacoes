import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { listActions } from '../../core/actions';
import { currentBrief, refsNotInText, sectionIdByTitle } from '../../core/brief';
import type { MaterialReading } from '../../core/text';
import type { ActionItem, BriefOrigin, Material, StudyBrief } from '../../core/types';

/** A estrutura do estudo em uso (salva ou montada pelas regras) e os versículos a conferir. */
export function useBrief(material: Material, reading: MaterialReading): { brief: StudyBrief; badRefs: Set<string> } {
  const actions = useLiveQuery(() => listActions(material.id), [material.id], [] as ActionItem[]);
  const brief = useMemo(() => currentBrief(material, reading, actions), [material, reading, actions]);
  const badRefs = useMemo(() => refsNotInText(brief, material), [brief, material]);
  return { brief, badRefs };
}

/** Selo de origem: dito no texto, ou inferência da IA (regra 3 da auditoria). */
export function OriginBadge({ origin }: { origin: BriefOrigin }) {
  return origin === 'ia' ? (
    <span className="xr-origin is-ia" title="Inferência feita pela IA a partir do texto">
      <Icon name="sparkle" size={12} /> inferência da IA
    </span>
  ) : (
    <span className="xr-origin" title="Dito no próprio material">
      do texto
    </span>
  );
}

/** Referência bíblica; avisa quando não aparece no material (regra 9). */
export function RefChip({ value, bad }: { value: string; bad: Set<string> }) {
  if (!value) return null;
  const warn = bad.has(value);
  return (
    <span className={`xr-ref${warn ? ' is-warn' : ''}`} title={warn ? 'Esta referência não aparece no texto do material. Confira.' : undefined}>
      {warn && '⚠ '}
      {value}
    </span>
  );
}

/** "Ver no texto": abre a parte de origem no Passo a passo (regra 6). */
export function SeeInText({ material, section }: { material: Material; section: string }) {
  const navigate = useNavigate();
  const id = sectionIdByTitle(material, section);
  if (!id) return null;
  return (
    <button className="xr-see" onClick={() => navigate(`/m/${material.id}?aba=passos&passo=${id}`)}>
      ver no texto ›
    </button>
  );
}

/** Cabeçalho de seção no estilo dos slides: ícone em quadrado colorido, título e pergunta. */
export function LayerHead({ tone, icon, title, question }: { tone: Tone; icon: Parameters<typeof Icon>[0]['name']; title: string; question?: string }) {
  return (
    <div className="xr-lhead">
      <span className={`xr-licon tone-${tone}`} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <span>
        <strong>{title}</strong>
        {question && <span className="small dim">{question}</span>}
      </span>
    </div>
  );
}

export type Tone = 'blue' | 'green' | 'purple' | 'orange' | 'pink';
export const STEP_TONES: Tone[] = ['blue', 'green', 'purple', 'orange', 'pink', 'blue'];
