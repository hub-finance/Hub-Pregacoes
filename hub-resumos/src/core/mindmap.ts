import { fold } from './bible';
import { readMaterial, sentences, type MaterialReading } from './text';
import type { ActionItem, Material } from './types';

/**
 * Mapa mental interativo do material.
 *
 * No centro, o material; em volta, cada assunto (cada parte do texto); ao
 * tocar num assunto, abrem os desdobramentos dele. Nada é resumido nem
 * escrito pelo app: cada desdobramento é um trecho do próprio texto, inteiro
 * — destaque, definição, item de lista, referência bíblica (com a frase em
 * que aparece), pergunta e cada parágrafo. O rótulo do círculo é curto só
 * para caber; o texto completo aparece ao tocar.
 */

export type MindNodeType = 'conceito' | 'pratica' | 'biblica' | 'pergunta' | 'texto';

export const MIND_TYPE_LABEL: Record<MindNodeType, string> = {
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

/**
 * Rótulo do círculo: até `lines` linhas de até `width` letras, quebrando
 * entre palavras; o que não cabe vira reticências (o texto inteiro fica no toque).
 */
export function circleLabel(text: string, width = 12, lines = 2): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const w = word.length > width ? `${word.slice(0, width - 1)}…` : word;
    if (!line) line = w;
    else if (`${line} ${w}`.length <= width) line = `${line} ${w}`;
    else {
      out.push(line);
      line = w;
      if (out.length === lines) break;
    }
  }
  if (out.length < lines && line) out.push(line);
  const used = out.join(' ').replace(/…/g, '').split(' ').length;
  if (used < words.length && out.length) {
    const last = out[out.length - 1];
    out[out.length - 1] = last.length >= width ? `${last.slice(0, width - 1)}…` : `${last}…`;
  }
  return out.join('\n');
}

const APPLICATION_TITLE = /aplica|pr[aá]tic|desafio|a[cç][aã]o|a[cç][oõ]es|tarefa|compromisso|exerc[ií]cio|passos/i;
const pad = (n: number) => String(n).padStart(2, '0');

export function buildMindMap(material: Material, reading?: MaterialReading, actions: ActionItem[] = []): MindMapData {
  const r = reading ?? readMaterial(material);
  const author = material.author ? ` — ${material.author}` : '';
  const source = (part: string) => `${part}${author}`;

  const modules: MindModule[] = r.sections.map((s, i) => {
    const title = s.section.title || `Parte ${i + 1}`;
    const practical = APPLICATION_TITLE.test(title);
    const children: MindChild[] = [];
    const seen = new Set<string>();
    const add = (type: MindNodeType, label: string, tipTitle: string, body: string) => {
      const key = `${type}|${fold(body)}`;
      if (!body.trim() || seen.has(key)) return;
      seen.add(key);
      children.push({ label: circleLabel(label), type, color: MIND_COLORS.tipo[type], tip: { title: tipTitle, body, source: source(title) } });
    };

    for (const h of s.highlights) add('conceito', h, 'Destaque', h);
    for (const d of s.definitions) add('conceito', d.term, d.term, d.meaning);
    for (const item of s.listItems) {
      if (s.definitions.some((d) => item.startsWith(d.term))) continue;
      add(practical ? 'pratica' : 'texto', item, practical ? 'Prática' : 'Ponto', item);
    }
    for (const ref of s.references) {
      // a frase em que a referência aparece, inteira
      const context = [...s.paragraphs, ...s.highlights, ...s.listItems]
        .flatMap(sentences)
        .find((x) => x.includes(ref.raw.trim()));
      add('biblica', ref.label, ref.label, context ?? ref.label);
    }
    for (const q of s.questions) add('pergunta', q, 'Pergunta', q);
    // cada parágrafo entra inteiro: o mapa não resume o texto
    for (const p of s.paragraphs) {
      const first = sentences(p)[0] ?? p;
      if (s.questions.includes(p)) continue;
      add(practical ? 'pratica' : 'texto', first, practical ? 'Prática' : 'Desenvolvimento', p);
    }

    const color = MIND_COLORS.assuntos[i % MIND_COLORS.assuntos.length];
    const opening = s.highlights[0] ?? sentences(s.paragraphs[0] ?? '')[0] ?? s.listItems[0] ?? '';
    return {
      id: i + 1,
      label: `${pad(i + 1)}\n${circleLabel(title.toUpperCase(), 11, 2)}`,
      color,
      textColor: color === '#C9973A' ? '#071320' : '#FFFFFF',
      tip: {
        title,
        body: opening || 'Toque para ver os desdobramentos.',
        source: `${children.length} desdobramento${children.length === 1 ? '' : 's'}${author}`,
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
    subtitle: `${modules.length} assuntos · toque num assunto para abrir os desdobramentos`,
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
