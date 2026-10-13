import type { MaterialReading } from '../../core/text';
import type { BriefCard, BriefCardKind, Material } from '../../core/types';
import { Icon } from '../../components/Icon';
import { BriefBar } from './BriefBar';
import { LayerHead, OriginBadge, RefChip, SeeInText, useBrief, type Tone } from './common';

export const CARD_KINDS: Record<BriefCardKind, { title: string; subtitle: string; tone: Tone; icon: Parameters<typeof Icon>[0]['name']; front: string; back: string; extra?: string }> = {
  biblico: { title: 'Cartão bíblico', subtitle: 'Texto e fundamento', tone: 'blue', icon: 'book', front: 'Referência', back: 'Verdade central', extra: 'Relação com a mensagem' },
  principio: { title: 'Cartão de princípio', subtitle: 'Verdade e significado', tone: 'green', icon: 'sparkle', front: 'Princípio', back: 'Explicação', extra: 'Implicação' },
  conexao: { title: 'Cartão de conexão', subtitle: 'Relação entre textos e ideias', tone: 'purple', icon: 'link', front: 'Conexão', back: 'Por que se ligam' },
  revisao: { title: 'Cartão de revisão', subtitle: 'Recordação ativa', tone: 'orange', icon: 'layers', front: 'Pergunta', back: 'Resposta' },
};

/** Camada 3 — Aprofundar: o que fundamenta cada afirmação. */
export function AprofundarTab({ material, reading }: { material: Material; reading: MaterialReading }) {
  const { brief, badRefs } = useBrief(material, reading);
  const kinds: BriefCardKind[] = ['biblico', 'principio', 'conexao'];
  return (
    <div className="stack xr-layer">
      <BriefBar material={material} brief={brief} />
      <LayerHead tone="purple" icon="book" title="Aprofundar" question="O que fundamenta cada afirmação?" />
      {kinds.map((k) => {
        const cards = brief.cards.filter((c) => c.kind === k);
        return (
          <section key={k} className="stack" style={{ gap: 'var(--sp-2)' }}>
            <KindHead kind={k} />
            {cards.length ? (
              <div className="xr-cardgrid">
                {cards.map((c, i) => (
                  <StudyCard key={i} card={c} material={material} badRefs={badRefs} />
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                {k === 'conexao' ? 'As conexões entre textos e ideias são montadas pela IA (botão “Montar com IA”).' : 'Nenhum cartão deste tipo no material.'}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function KindHead({ kind }: { kind: BriefCardKind }) {
  const k = CARD_KINDS[kind];
  return (
    <div className={`xr-kindhead tone-${k.tone}`}>
      <Icon name={k.icon} size={16} />
      <strong>{k.title}</strong>
      <span className="small dim">{k.subtitle}</span>
    </div>
  );
}

/** Um cartão no estilo dos slides: faixa colorida, rótulos claros, origem e "ver no texto". */
export function StudyCard({ card, material, badRefs }: { card: BriefCard; material: Material; badRefs: Set<string> }) {
  const k = CARD_KINDS[card.kind];
  return (
    <article className={`xr-scard tone-${k.tone}`}>
      <span className="xr-scard-label">{k.front}</span>
      <p className="xr-scard-front">{card.kind === 'biblico' ? <RefChip value={card.front} bad={badRefs} /> : card.front}</p>
      <span className="xr-scard-label">{k.back}</span>
      <p>{card.back}</p>
      {card.extra && k.extra && (
        <>
          <span className="xr-scard-label">{k.extra}</span>
          <p>{card.extra}</p>
        </>
      )}
      <span className="xr-meta">
        {card.ref && card.kind !== 'biblico' && <RefChip value={card.ref} bad={badRefs} />}
        <OriginBadge origin={card.origin} />
        <SeeInText material={material} section={card.section} />
      </span>
    </article>
  );
}
