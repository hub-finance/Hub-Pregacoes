import type { ExportCategory, ExportLayout, ExportSourceKind } from '../db/types';

/**
 * Categorias e modelos documentais.
 *
 * Um modelo é um conjunto de padrões — modelo visual, capa, sumário,
 * numeração, quebras de página, espaço para anotações. Ele **não escreve
 * conteúdo**: não cria introdução, exercícios nem oração que o autor não
 * escreveu. O texto do arquivo é sempre o do conteúdo de origem, revisado
 * pelo autor.
 *
 * Para acrescentar um modelo ou uma categoria basta incluir uma entrada aqui;
 * as telas e os geradores leem esta lista.
 */

export interface ExportModel {
  id: string;
  label: string;
  /** Uma linha explicando para que serve. */
  hint: string;
  /** Padrões que o modelo aplica sobre os da categoria. */
  defaults?: Partial<ExportLayout>;
}

export interface ExportCategoryDef {
  id: ExportCategory;
  label: string;
  description: string;
  /** De onde costuma vir o conteúdo desta categoria — sugerido primeiro na escolha. */
  preferredSources: ExportSourceKind[];
  defaults: Partial<ExportLayout>;
  models: ExportModel[];
}

const SHORT: Partial<ExportLayout> = { cover: false, toc: false, breakBeforeSections: false };
const BOOKLET: Partial<ExportLayout> = { cover: true, toc: true, breakBeforeSections: true, pageNumbers: true };

export const EXPORT_CATEGORIES: ExportCategoryDef[] = [
  {
    id: 'pregacao',
    label: 'Pregações e mensagens',
    description: 'Esboços, mensagens completas, séries e roteiros de ministração.',
    preferredSources: ['sermon', 'study'],
    defaults: { theme: 'pastoral', cover: false, toc: false, pageNumbers: true },
    models: [
      { id: 'esboco', label: 'Esboço de pregação', hint: 'Pontos principais, para levar ao púlpito.', defaults: { fontSize: 12 } },
      { id: 'mensagem-completa', label: 'Mensagem completa', hint: 'O texto inteiro da ministração.' },
      { id: 'textual', label: 'Pregação textual', hint: 'Desenvolvida a partir de um texto bíblico.' },
      { id: 'tematica', label: 'Pregação temática', hint: 'Desenvolvida a partir de um tema.' },
      { id: 'expositivo', label: 'Estudo expositivo', hint: 'Exposição verso a verso.', defaults: { theme: 'academico' } },
      { id: 'roteiro', label: 'Roteiro de ministração', hint: 'Sequência do culto ou da ministração.', defaults: { theme: 'institucional' } },
      { id: 'reflexao', label: 'Mensagem com perguntas para reflexão', hint: 'Com espaço para anotar as respostas.', defaults: { notesSpace: true } },
      { id: 'impressao', label: 'Versão para impressão', hint: 'Folha limpa, em preto.', defaults: { theme: 'classico' } },
      { id: 'apostila', label: 'Versão para apostila', hint: 'Com capa, sumário e cada parte em página nova.', defaults: BOOKLET },
    ],
  },
  {
    id: 'devocional',
    label: 'Devocionais',
    description: 'Devocional diário e para líderes, famílias, grupos e igreja.',
    preferredSources: ['devotional'],
    defaults: { theme: 'pastoral', cover: false, toc: false, pageNumbers: false, notesSpace: true },
    models: [
      { id: 'diario', label: 'Devocional diário', hint: 'Uma página para o dia, com espaço para anotações.' },
      { id: 'lideres', label: 'Devocional para líderes', hint: 'Para enviar ou imprimir à liderança.' },
      { id: 'familias', label: 'Devocional para famílias', hint: 'Leitura em casa, com espaço para anotações.' },
      { id: 'grupos', label: 'Devocional para grupos', hint: 'Para pequenos grupos e células.' },
      { id: 'igreja', label: 'Devocional para a igreja', hint: 'Para distribuição na igreja.', defaults: { notesSpace: false } },
    ],
  },
  {
    id: 'estudo',
    label: 'Estudos bíblicos',
    description: 'Estudos temáticos, de livro, de passagem, de palavras e para grupos.',
    preferredSources: ['study', 'sermon'],
    defaults: { theme: 'academico', cover: false, toc: false, pageNumbers: true },
    models: [
      { id: 'tematico', label: 'Estudo temático', hint: 'Um tema percorrido nas Escrituras.' },
      { id: 'livro', label: 'Estudo de livro bíblico', hint: 'Panorama e conteúdo de um livro.', defaults: { cover: true, toc: true } },
      { id: 'capitulo', label: 'Estudo de capítulo', hint: 'Um capítulo estudado em partes.' },
      { id: 'passagem', label: 'Estudo de passagem bíblica', hint: 'Um trecho estudado em detalhe.' },
      { id: 'palavras', label: 'Estudo de palavras', hint: 'Termos e seus sentidos no texto.' },
      { id: 'referencias', label: 'Estudo com referências cruzadas', hint: 'Passagens ligadas entre si.' },
      { id: 'expositivo', label: 'Estudo expositivo', hint: 'Exposição verso a verso.' },
      { id: 'pequenos-grupos', label: 'Estudo para pequenos grupos', hint: 'Com espaço para as respostas do grupo.', defaults: { theme: 'didatico', notesSpace: true } },
      { id: 'individual', label: 'Estudo individual', hint: 'Para o estudo pessoal, com espaço para anotações.', defaults: { notesSpace: true } },
      { id: 'professores', label: 'Material de apoio para professores', hint: 'Com capa e sumário.', defaults: { ...BOOKLET, theme: 'didatico' } },
    ],
  },
  {
    id: 'treinamento',
    label: 'Treinamentos e apostilas',
    description: 'Apostilas, manuais, roteiros de aula e materiais de capacitação.',
    preferredSources: ['doc', 'study', 'devotional'],
    defaults: { theme: 'didatico', ...BOOKLET },
    models: [
      { id: 'apostila', label: 'Apostila de treinamento', hint: 'Capa, sumário e cada módulo em página nova.' },
      { id: 'manual-formacao', label: 'Manual de formação ministerial', hint: 'Material de formação em módulos.' },
      { id: 'lideres', label: 'Material para líderes', hint: 'Orientação para a liderança.' },
      { id: 'equipes', label: 'Treinamento de equipes', hint: 'Para capacitação de equipes de serviço.' },
      { id: 'gc', label: 'Treinamento para Grupos de Crescimento', hint: 'Para líderes e auxiliares de GC.' },
      { id: 'departamentos', label: 'Manual de departamentos', hint: 'Funcionamento de um departamento.', defaults: { theme: 'institucional' } },
      { id: 'roteiro-aula', label: 'Roteiro de aula', hint: 'Sequência de uma aula, sem capa.', defaults: SHORT },
      { id: 'capacitacao', label: 'Plano de capacitação', hint: 'Etapas e conteúdos da capacitação.', defaults: { theme: 'institucional' } },
      { id: 'integracao', label: 'Integração de novos membros ou voluntários', hint: 'Material de boas-vindas e integração.' },
      { id: 'instrutor', label: 'Guia do instrutor', hint: 'O material completo, para quem ensina.' },
      { id: 'participante', label: 'Material do participante', hint: 'Com espaço para anotações.', defaults: { notesSpace: true } },
    ],
  },
  {
    id: 'institucional',
    label: 'Documentos ministeriais e institucionais',
    description: 'Comunicados, cartas, atas, relatórios, planos e manuais.',
    preferredSources: ['doc', 'blank'],
    defaults: { theme: 'institucional', ...SHORT, pageNumbers: false },
    models: [
      { id: 'comunicado', label: 'Comunicado', hint: 'Aviso oficial, em uma folha.' },
      { id: 'carta', label: 'Carta', hint: 'Correspondência, sem capa nem numeração.' },
      { id: 'convite', label: 'Convite', hint: 'Convite para culto, evento ou reunião.', defaults: { theme: 'pastoral' } },
      { id: 'mensagem', label: 'Mensagem institucional', hint: 'Palavra da liderança à igreja.' },
      { id: 'plano-acao', label: 'Plano de ação', hint: 'Objetivos, ações e responsáveis.', defaults: { pageNumbers: true } },
      { id: 'planejamento', label: 'Planejamento ministerial', hint: 'Planejamento do ano ou do ministério.', defaults: { cover: true, toc: true, pageNumbers: true } },
      { id: 'pauta', label: 'Pauta de reunião', hint: 'Assuntos da reunião, em ordem.' },
      { id: 'ata', label: 'Ata de reunião', hint: 'Registro do que foi tratado e decidido.', defaults: { theme: 'classico', pageNumbers: true } },
      { id: 'relatorio', label: 'Relatório', hint: 'Relato de atividades e resultados.', defaults: { pageNumbers: true } },
      { id: 'manual', label: 'Manual operacional', hint: 'Com capa, sumário e numeração.', defaults: BOOKLET },
      { id: 'cronograma', label: 'Cronograma', hint: 'Datas e atividades — use uma tabela.', defaults: { pageNumbers: true } },
      { id: 'procedimentos', label: 'Guia de procedimentos', hint: 'Passo a passo de um procedimento.', defaults: { pageNumbers: true } },
      { id: 'orientacao', label: 'Orientação para líderes', hint: 'Diretrizes para a liderança.', defaults: { pageNumbers: true } },
    ],
  },
];

export const categoryById = (id: string): ExportCategoryDef =>
  EXPORT_CATEGORIES.find((c) => c.id === id) ?? EXPORT_CATEGORIES[0];

export function modelById(category: string, model: string): ExportModel {
  const cat = categoryById(category);
  return cat.models.find((m) => m.id === model) ?? cat.models[0];
}

/** Layout neutro — o ponto de partida antes da categoria e do modelo. */
export const BASE_LAYOUT: ExportLayout = {
  theme: 'pastoral',
  pageSize: 'A4',
  margins: 'normal',
  fontSize: 11.5,
  lineSpacing: 1.35,
  accentColor: '',
  cover: false,
  subtitle: '',
  author: '',
  institution: '',
  dateLabel: '',
  toc: false,
  pageNumbers: true,
  pageNumberAlign: 'center',
  header: '',
  footer: '',
  breakBeforeSections: false,
  notesSpace: false,
};

/**
 * Layout de um documento novo: base → preferência salva pelo usuário → padrões
 * da categoria → padrões do modelo.
 *
 * Da preferência do usuário vêm a aparência e os dados que se repetem (autor,
 * instituição, logotipo, cabeçalho, rodapé). A estrutura — capa, sumário,
 * quebras — é do modelo, porque uma carta não pode herdar a capa da apostila.
 */
export function layoutFor(
  category: string,
  model: string,
  preferred?: Partial<ExportLayout> | null,
): ExportLayout {
  const cat = categoryById(category);
  const mod = modelById(category, model);
  const fromPreference: Partial<ExportLayout> = preferred
    ? {
        pageSize: preferred.pageSize,
        margins: preferred.margins,
        fontSize: preferred.fontSize,
        lineSpacing: preferred.lineSpacing,
        accentColor: preferred.accentColor,
        author: preferred.author,
        institution: preferred.institution,
        logo: preferred.logo,
        header: preferred.header,
        footer: preferred.footer,
        pageNumberAlign: preferred.pageNumberAlign,
      }
    : {};
  const layout: ExportLayout = { ...BASE_LAYOUT };
  for (const patch of [fromPreference, cat.defaults, mod.defaults ?? {}]) {
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (layout as unknown as Record<string, unknown>)[key] = value;
    }
  }
  // o modelo visual preferido vale quando o modelo documental não exige outro
  if (preferred?.theme && !mod.defaults?.theme) layout.theme = preferred.theme;
  return layout;
}
