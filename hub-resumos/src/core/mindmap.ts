import { fold } from './bible';
import { findTurnsByRules } from './brief';
import { cleanTitle, readMaterial, referenceSentence, sentences, type MaterialReading } from './text';
import type { ActionItem, Material } from './types';

/**
 * Mapa mental interativo do material.
 *
 * No centro, o material; em volta, cada assunto (cada parte do texto); ao
 * tocar num assunto, abrem os pontos principais dele — no máximo
 * MAX_POINTS, para o mapa ser objetivo e fácil de estudar. Nada é escrito
 * pelo app: cada ponto é um trecho do próprio texto, na ordem de
 * importância — destaque, definição, base bíblica (com a frase em que
 * aparece), item de lista, pergunta e, se ainda faltar, a frase principal
 * de cada parágrafo. O rótulo do círculo é curto só para caber; a frase
 * inteira aparece ao tocar.
 */

export type MindNodeType = 'virada' | 'conceito' | 'pratica' | 'biblica' | 'pergunta' | 'texto';

export const MIND_TYPE_LABEL: Record<MindNodeType, string> = {
  virada: 'Ponto de inflexão',
  conceito: 'Conceitos-chave',
  pratica: 'Práticas e ações',
  biblica: 'Base bíblica',
  pergunta: 'Perguntas',
  texto: 'Desenvolvimento',
};

/** Cores do modelo: azul-noite com dourado. */
export const MIND_COLORS = {
  fundo: '#071320',
  painel: '#0D1B2A',
  ouro: '#C9973A',
  ouroClaro: '#E8B96A',
  texto: '#D9E0E9',
  apagado: '#8A9BB0',
  tipo: {
    virada: '#9A6B12',
    conceito: '#8B1A2E',
    pratica: '#1A5E3A',
    biblica: '#2A4060',
    pergunta: '#5A3E8B',
    texto: '#1A2E44',
  } as Record<MindNodeType, string>,
  /** Cores dos assuntos, em sequência. */
  assuntos: ['#C9973A', '#8B1A2E', '#1A5E3A', '#0D5F7A', '#5A3E8B', '#8B5A0A', '#7A2E5E', '#2E6B5E', '#4A5A8B', '#8B3A1A'],
};

export interface MindTip {
  title: string;
  body: string;
  /** Linha de rodapé: de onde veio (a parte, o autor). */
  source: string;
}

export interface MindChild {
  label: string;
  type: MindNodeType;
  color: string;
  tip: MindTip;
}

export interface MindModule {
  id: number;
  label: string;
  color: string;
  textColor: string;
  tip: MindTip;
  children: MindChild[];
}

export interface MindMapData {
  title: string;
  subtitle: string;
  center: { label: string; tip: MindTip };
  modules: MindModule[];
  legend: Array<{ label: string; color: string }>;
}

const LOOSE_END = /^(a|o|as|os|de|do|da|dos|das|que|e|em|no|na|nos|nas|um|uma|para|pelo|pela|por|com|sem|ao|aos|à|às|se|seu|sua|é|me|te|lhe|não|também|mesmo|mais|muito|já)$/i;

/**
 * Rótulo do círculo: até `lines` linhas de até `width` letras, só com palavras
 * inteiras e sem reticências (pedido do usuário). O que não cabe fica de fora
 * e o rótulo não termina em palavra solta ("de", "que"); o texto inteiro
 * aparece ao tocar.
 */
export function circleLabel(text: string, width = 12, lines = 3): string {
  const words = text.replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out: string[] = [];
  let line = '';
  let used = 0;
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line = `${line} ${word}`;
    else {
      out.push(line);
      if (out.length === lines) {
        line = '';
        break;
      }
      line = word;
    }
    used++;
  }
  if (line && out.length < lines) out.push(line);
  if (used < words.length) {
    // cortado: tira pontuação e palavras soltas do fim
    const kept = out.join(' ').replace(/[,;:—–-]+$/, '').split(' ');
    while (kept.length > 1 && LOOSE_END.test(kept[kept.length - 1].replace(/[,;:.]$/, ''))) kept.pop();
    return circleLabel(kept.join(' ').replace(/[,;:—–-]+$/, ''), width, lines);
  }
  return out.join('\n');
}

const APPLICATION_TITLE = /aplica|pr[aá]tic|desafio|a[cç][aã]o|a[cç][oõ]es|tarefa|compromisso|exerc[ií]cio|passos/i;
const pad = (n: number) => String(n).padStart(2, '0');
/** Pontos por assunto: o bastante para entender, pouco para não cansar. */
export const MAX_POINTS = 6;

export function buildMindMap(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): MindMapData {
  const r = reading ?? readMaterial(material);
  const author = material.author ? ` — ${material.author}` : '';
  const source = (part: string) => `${part}${author}`;

  // a virada de cada capítulo: a da estrutura salva (IA ou revisada) ou a sugestão das regras
  const turns = material.brief?.chapterTurns?.length ? material.brief.chapterTurns : findTurnsByRules(r).chapterTurns;

  const modules: MindModule[] = r.sections.map((s, i) => {
    const title = s.section.title || `Parte ${i + 1}`;
    const practical = APPLICATION_TITLE.test(title);
    const children: MindChild[] = [];
    const seen = new Set<string>();
    let available = 0;
    const labels = new Set<string>();
    const add = (type: MindNodeType, label: string, tipTitle: string, body: string) => {
      // a mesma frase não volta com outro tipo (ex.: a virada que também é destaque)
      const key = fold(body).replace(/\s*\([^)]*\)\s*$/, '').replace(/[.!?;:\s]+$/, '');
      // o mesmo rótulo duas vezes no mapa não ensina nada: fica só o primeiro
      const labelKey = fold(circleLabel(label)).replace(/\W+/g, ' ').trim();
      if (!body.trim() || seen.has(key) || labels.has(labelKey)) return;
      seen.add(key);
      labels.add(labelKey);
      available++;
      if (children.length >= MAX_POINTS) return;
      children.push({ label: circleLabel(label), type, color: MIND_COLORS.tipo[type], tip: { title: tipTitle, body, source: source(title) } });
    };

    const turn = turns.find((t) => t.section === s.section.title);
    if (turn) add('virada', 'Ponto de inflexão', turn.guess ? 'Ponto de inflexão (sugestão)' : 'Ponto de inflexão', turn.turn + (turn.ref && !turn.turn.includes(turn.ref) ? ` (${turn.ref})` : ''));
    for (const h of s.highlights) add('conceito', h, 'Destaque', h);
    for (const d of s.definitions) add('conceito', d.term, d.term, d.meaning);
    for (const ref of s.references) {
      // a frase em que a referência aparece
      const context = referenceSentence(s, ref);
      add('biblica', ref.label, ref.label, context || ref.label);
    }
    for (const item of s.listItems) {
      if (s.definitions.some((d) => item.startsWith(d.term))) continue;
      add(practical ? 'pratica' : 'texto', item, practical ? 'Prática' : 'Ponto', item);
    }
    for (const q of s.questions) add('pergunta', q, 'Pergunta', q);
    // só se ainda houver lugar: a frase principal (a primeira) de cada parágrafo
    for (const p of s.paragraphs) {
      if (s.questions.includes(p)) continue;
      const first = sentences(p)[0] ?? p;
      add(practical ? 'pratica' : 'texto', first, practical ? 'Prática' : 'Ideia', first);
    }

    const color = MIND_COLORS.assuntos[i % MIND_COLORS.assuntos.length];
    const opening = s.highlights[0] ?? sentences(s.paragraphs[0] ?? '')[0] ?? s.listItems[0] ?? '';
    return {
      id: i + 1,
      label: `${pad(i + 1)}\n${circleLabel(cleanTitle(title).toUpperCase(), 11, 2)}`,
      color,
      textColor: color === '#C9973A' ? '#071320' : '#FFFFFF',
      tip: {
        title,
        body: opening || 'Toque para ver os pontos principais.',
        source: `${children.length} ponto${children.length === 1 ? '' : 's'} principa${children.length === 1 ? 'l' : 'is'}${available > children.length ? ` (de ${available} no texto)` : ''}${author}`,
      },
      children,
    };
  });

  // as ações do plano que ainda estão abertas viram um assunto próprio
  const open = actions.filter((a) => a.status !== 'feito');
  if (open.length) {
    const id = modules.length + 1;
    modules.push({
      id,
      label: `${pad(id)}\nPLANO DE\nAÇÃO`,
      color: '#1A5E3A',
      textColor: '#FFFFFF',
      tip: { title: 'Plano de ação', body: 'O que fazer com o que foi estudado.', source: `${open.length} ações abertas` },
      children: open.map((a) => ({
        label: circleLabel(a.text),
        type: 'pratica',
        color: MIND_COLORS.tipo.pratica,
        tip: {
          title: 'Ação',
          body: [a.text, a.owner && `Responsável: ${a.owner}`, a.due && `Prazo: ${a.due.split('-').reverse().join('/')}`].filter(Boolean).join('\n'),
          source: 'Plano de ação',
        },
      })),
    });
  }

  const used = new Set(modules.flatMap((m) => m.children.map((c) => c.type)));
  return {
    title: material.title,
    subtitle: `${modules.length} assuntos · toque num assunto para ver os pontos principais`,
    center: {
      label: circleLabel(material.title.toUpperCase(), 12, 3),
      tip: {
        title: material.title,
        body: material.centralIdea.trim() || `${r.sections.length} partes · ${r.words} palavras · ${r.references.length} referências bíblicas.`,
        source: material.author,
      },
    },
    modules,
    legend: [
      { label: 'Centro / Assuntos', color: MIND_COLORS.ouro },
      ...(Object.keys(MIND_TYPE_LABEL) as MindNodeType[])
        .filter((t) => used.has(t))
        .map((t) => ({ label: MIND_TYPE_LABEL[t], color: MIND_COLORS.tipo[t] })),
    ],
  };
}
