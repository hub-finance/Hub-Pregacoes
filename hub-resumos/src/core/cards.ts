import { db, now, uid } from './db';
import { findReferences } from './bible';
import { readMaterial, sentences } from './text';
import type { Card, CardOrigin, Material } from './types';

/**
 * Cartões de revisão com repetição espaçada (caixas de Leitner).
 *
 * Acertou, o cartão sobe de caixa e demora mais a voltar; errou, volta para a
 * caixa 1 e reaparece no mesmo dia. É o jeito mais simples de lembrar por
 * muito tempo estudando poucos minutos.
 */

/** Dias até a próxima revisão em cada caixa. */
export const BOX_DAYS = [0, 0, 1, 3, 7, 16];
const DAY = 24 * 60 * 60 * 1000;

export type Answer = 'errei' | 'dificil' | 'acertei';

export function schedule(card: Card, answer: Answer, at = now()): Card {
  let box = card.box;
  if (answer === 'errei') box = 1;
  else if (answer === 'acertei') box = Math.min(5, box + 1);
  // "difícil" fica na mesma caixa
  const days = BOX_DAYS[box];
  return {
    ...card,
    box,
    // caixa 1: volta em 10 minutos, ainda na mesma sessão do dia
    due: days ? startOfDay(at) + days * DAY : at + 10 * 60 * 1000,
    reviews: card.reviews + 1,
    lapses: card.lapses + (answer === 'errei' ? 1 : 0),
    updatedAt: at,
  };
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const isDue = (card: Card, at = now()) => card.due <= at;

export const ORIGIN_LABEL: Record<CardOrigin, string> = {
  definicao: 'Definição',
  destaque: 'Destaque',
  pergunta: 'Pergunta do texto',
  lista: 'Lista da seção',
  referencia: 'Referência bíblica',
  manual: 'Escrito por você',
};

export interface CardDraft {
  sectionId?: string;
  front: string;
  back: string;
  origin: CardOrigin;
}

/** A palavra mais significativa de uma frase, para virar lacuna. */
function clozeWord(sentence: string, keywords: string[]): string | null {
  const words = sentence.match(/[\p{L}]{5,}/gu) ?? [];
  const key = keywords.find((k) => words.some((w) => w.toLowerCase() === k.toLowerCase()));
  if (key) return words.find((w) => w.toLowerCase() === key.toLowerCase()) ?? null;
  return words.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * Sugestões de cartões tiradas do próprio texto — o usuário escolhe quais
 * guardar. Nenhum cartão traz conteúdo que não esteja no material:
 *
 * - definição "Termo: sentido" → frente o termo, verso o sentido;
 * - destaque → frase com lacuna na palavra-chave;
 * - pergunta escrita no texto → verso é o parágrafo que vem depois dela;
 * - lista de uma seção → "Quais os pontos de …?";
 * - referência bíblica → "Em que ponto o estudo usa …?", verso a frase em que aparece.
 */
export function suggestCards(material: Material): CardDraft[] {
  const reading = readMaterial(material);
  const keys = reading.keywords.map((k) => k.word);
  const drafts: CardDraft[] = [];

  for (const d of reading.definitions) {
    drafts.push({ sectionId: d.sectionId, front: d.term, back: d.meaning, origin: 'definicao' });
  }

  for (const s of reading.sections) {
    const title = s.section.title || 'esta seção';
    for (const h of s.highlights) {
      const word = clozeWord(h, keys);
      if (!word) continue;
      const front = h.replace(new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'u'), '_____');
      if (front === h) continue;
      drafts.push({ sectionId: s.section.id, front: `Complete (${title}):\n${front}`, back: h, origin: 'destaque' });
    }

    // a resposta é o que vem logo depois da pergunta: o resto do parágrafo
    // ou, se ela fecha o parágrafo, o parágrafo seguinte
    s.paragraphs.forEach((p, i) => {
      const parts = sentences(p);
      parts.forEach((x, j) => {
        if (!x.endsWith('?')) return;
        const rest = parts.slice(j + 1).filter((y) => !y.endsWith('?')).join(' ');
        const answer = rest || s.paragraphs[i + 1];
        if (answer) drafts.push({ sectionId: s.section.id, front: x, back: answer, origin: 'pergunta' });
      });
    });

    const items = s.listItems.filter((item) => !s.definitions.some((d) => item.startsWith(d.term)));
    if (items.length >= 2 && items.length <= 9) {
      drafts.push({
        sectionId: s.section.id,
        front: `Quais são os pontos de “${title}”?`,
        back: items.map((x) => `• ${x}`).join('\n'),
        origin: 'lista',
      });
    }

    for (const r of s.references) {
      const where = [...s.paragraphs, ...s.highlights, ...s.listItems]
        .flatMap(sentences)
        .find((x) => findReferences(x).some((found) => found.label === r.label));
      if (!where) continue;
      drafts.push({
        sectionId: s.section.id,
        front: `Em que ponto o material usa ${r.label}?`,
        back: `${title}: ${where}`,
        origin: 'referencia',
      });
    }
  }

  // sem repetir o que já foi sugerido
  const seen = new Set<string>();
  return drafts.filter((d) => {
    const key = `${d.front}|${d.back}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function addCards(materialId: string, drafts: CardDraft[]): Promise<Card[]> {
  const t = now();
  const existing = await db.cards.where('materialId').equals(materialId).toArray();
  const known = new Set(existing.map((c) => `${c.front}|${c.back}`));
  const cards: Card[] = drafts
    .filter((d) => d.front.trim() && d.back.trim() && !known.has(`${d.front}|${d.back}`))
    .map((d) => ({
      id: uid('crd_'),
      materialId,
      sectionId: d.sectionId,
      front: d.front.trim(),
      back: d.back.trim(),
      origin: d.origin,
      box: 1,
      due: t,
      reviews: 0,
      lapses: 0,
      createdAt: t,
      updatedAt: t,
    }));
  await db.cards.bulkPut(cards);
  return cards;
}

export async function answerCard(card: Card, answer: Answer): Promise<Card> {
  const next = schedule(card, answer);
  await db.cards.put(next);
  return next;
}

export const listCards = (materialId: string) => db.cards.where('materialId').equals(materialId).toArray();
