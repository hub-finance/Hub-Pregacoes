import { readMaterial, sentences, type MaterialReading } from './text';
import type { Material } from './types';

/**
 * Resumo extrativo: escolhe frases do próprio texto, sem reescrever nenhuma.
 *
 * Por seção, entram primeiro os destaques (o que o autor marcou como
 * essencial); faltando, as frases com mais palavras-chave do material, com um
 * pequeno peso para a primeira frase da seção, onde a ideia costuma ser
 * apresentada. É um ponto de partida — o autor revisa e completa.
 */

export type SummaryLength = 'curto' | 'medio' | 'longo';

const PER_SECTION: Record<SummaryLength, number> = { curto: 1, medio: 2, longo: 4 };

export interface SummaryPart {
  sectionId: string;
  title: string;
  sentences: string[];
}

export function extractiveSummary(material: Material, length: SummaryLength, reading?: MaterialReading): SummaryPart[] {
  const r = reading ?? readMaterial(material);
  const keys = new Set(r.keywords.map((k) => k.word.toLowerCase()));
  const quota = PER_SECTION[length];

  return r.sections
    .map((s) => {
      const picked: string[] = [...s.highlights.slice(0, quota)];
      if (picked.length < quota) {
        // itens de lista também contam: há seções feitas só de tópicos
        const candidates = [...s.paragraphs, ...s.listItems].flatMap((p, pi) =>
          sentences(p).map((text, si) => {
            const words = text.match(/[\p{L}]{4,}/gu) ?? [];
            const hits = words.filter((w) => keys.has(w.toLowerCase())).length;
            const score = hits / Math.sqrt(words.length || 1) + (pi === 0 && si === 0 ? 0.6 : 0) - (text.endsWith('?') ? 0.5 : 0);
            return { text, score, order: pi * 100 + si };
          }),
        );
        candidates
          .filter((c) => c.text.length >= 12 && !picked.includes(c.text))
          .sort((a, b) => b.score - a.score)
          .slice(0, quota - picked.length)
          .sort((a, b) => a.order - b.order)
          .forEach((c) => picked.push(c.text));
      }
      return { sectionId: s.section.id, title: s.section.title, sentences: picked };
    })
    .filter((p) => p.sentences.length);
}

/** O resumo como texto de um novo material (cada seção vira um tópico). */
export function summaryAsSections(parts: SummaryPart[]): Array<{ title: string; text: string }> {
  return parts.map((p) => ({ title: p.title || 'Tópico', text: p.sentences.join('\n\n') }));
}
