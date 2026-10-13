import { useLiveQuery } from 'dexie-react-hooks';
import { Icon, type IconName } from '../../components/Icon';
import { db } from '../../core/db';
import { PART_LABEL, progressRatio } from '../../core/materials';
import type { MaterialReading } from '../../core/text';
import type { Material } from '../../core/types';
import type { TabId } from '../MaterialPage';

interface Props {
  material: Material;
  reading: MaterialReading;
  go: (tab: TabId, extra?: Record<string, string>) => void;
}

const TOOLS: Array<{ tab: TabId; icon: IconName; title: string; text: string }> = [
  { tab: 'passos', icon: 'list', title: 'Passo a passo', text: 'Estudar parte por parte, marcando o que já foi feito.' },
  { tab: 'dna', icon: 'sparkle', title: 'DNA', text: 'Ideia central, texto-chave, palavras, versículos e estrutura.' },
  { tab: 'mapa', icon: 'layers', title: 'Mapa mental', text: 'Cada assunto com todos os seus desdobramentos, interativo.' },
  { tab: 'quadros', icon: 'columns', title: 'Quadros', text: 'DNA, folha de consulta, conceitos, painel, fluxograma e cartões em imagem.' },
  { tab: 'cartoes', icon: 'copy', title: 'Cartões', text: 'Frente e verso, com revisão espaçada para lembrar.' },
  { tab: 'consulta', icon: 'note', title: 'Consulta rápida', text: 'Tudo o essencial numa folha, pronta para imprimir.' },
  { tab: 'acoes', icon: 'check', title: 'Plano de ação', text: 'O que fazer com o que foi estudado, com prazo.' },
  { tab: 'resumo', icon: 'text', title: 'Resumo', text: 'As frases principais do próprio texto.' },
  { tab: 'infografico', icon: 'chart', title: 'Infográfico', text: 'Uma imagem com o essencial, para salvar ou enviar.' },
];

/** O painel do material: andamento, números e o próximo passo. */
export function DashboardTab({ material, reading, go }: Props) {
  const stats = useLiveQuery(async () => {
    const [progress, cards, actions] = await Promise.all([
      db.progress.get(material.id),
      db.cards.where('materialId').equals(material.id).toArray(),
      db.actions.where('materialId').equals(material.id).toArray(),
    ]);
    return { progress, cards, actions };
  }, [material.id]);

  const ratio = progressRatio(material, stats?.progress);
  const done = new Set(stats?.progress?.done ?? []);
  const next = material.sections.find((s) => !done.has(s.id));
  const due = (stats?.cards ?? []).filter((c) => c.due <= Date.now()).length;
  const openActions = (stats?.actions ?? []).filter((a) => a.status !== 'feito').length;
  const learned = (stats?.cards ?? []).filter((c) => c.box >= 4).length;

  const tiles: Array<[string, string]> = [
    [`${Math.round(ratio * 100)}%`, 'estudado'],
    [String(material.sections.length), `${PART_LABEL[material.kind].toLowerCase()}s`],
    [`${reading.minutes} min`, 'de leitura'],
    [String(reading.references.length), 'versículos citados'],
    [`${due}/${stats?.cards.length ?? 0}`, 'cartões para hoje'],
    [String(openActions), 'ações abertas'],
  ];

  return (
    <div className="stack">
      <section className="card stack" style={{ gap: 'var(--sp-3)' }}>
        <div className="row row-wrap">
          <strong>Andamento</strong>
          <span className="spacer" />
          <span className="small dim">
            {done.size > 0 ? `${[...done].filter((d) => material.sections.some((s) => s.id === d)).length} de ${material.sections.length} partes` : 'Ainda não começou'}
          </span>
        </div>
        <span className="xr-bar xr-bar-lg" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Andamento do estudo">
          <i style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        <div className="row row-wrap">
          {next ? (
            <button className="btn btn-primary" onClick={() => go('passos', { passo: next.id })}>
              {done.size ? 'Continuar' : 'Começar'}: {next.title || 'próxima parte'} →
            </button>
          ) : material.sections.length ? (
            <span className="small muted">Todas as partes foram estudadas. Revise os cartões para fixar.</span>
          ) : (
            <button className="btn btn-primary" onClick={() => go('editar')}>
              Escrever o conteúdo
            </button>
          )}
          {due > 0 && (
            <button className="btn" onClick={() => go('cartoes', { revisar: '1' })}>
              Revisar {due} cartão(ões)
            </button>
          )}
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {tiles.map(([value, label]) => (
          <div key={label} className="stat">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      <section className="card stack" style={{ gap: 'var(--sp-2)' }}>
        <strong>Ideia central</strong>
        {material.centralIdea ? (
          <p style={{ margin: 0 }}>{material.centralIdea}</p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Ainda não escrita. Em uma ou duas frases, o que este material quer ensinar?{' '}
            <button className="btn btn-ghost btn-sm" onClick={() => go('dna')}>
              Escrever no DNA
            </button>
          </p>
        )}
        {learned > 0 && <span className="small dim">{learned} cartão(ões) já bem fixados.</span>}
      </section>

      <section>
        <h2 className="xr-h2">Ferramentas</h2>
        <div className="grid grid-cards">
          {TOOLS.map((t) => (
            <button key={t.tab} className="card card-link row" style={{ textAlign: 'left', alignItems: 'flex-start' }} onClick={() => go(t.tab)}>
              <Icon name={t.icon} size={22} className="dim" />
              <span>
                <strong style={{ display: 'block' }}>{t.title}</strong>
                <span className="small dim">{t.text}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
