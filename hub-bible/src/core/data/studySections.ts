import { uid } from '../db/db';
import type { Study, StudySection, StudySectionKind } from '../db/types';

/**
 * O corpo do Rhema em seções.
 *
 * Antes, um estudo tinha campos fixos — Texto principal, Introdução,
 * Desenvolvimento, Comentários, Aplicações, Conclusão —, todos sempre na tela,
 * na mesma ordem, vazios ou não. Um estudo curto ficava com quatro caixas em
 * branco; um estudo com dois desenvolvimentos não cabia.
 *
 * Agora o corpo é uma lista: o autor acrescenta a seção que quer, na ordem que
 * quiser, quantas vezes precisar.
 */

export const SECTION_LABEL: Record<StudySectionKind, string> = {
  texto: 'Texto principal',
  introducao: 'Introdução',
  desenvolvimento: 'Desenvolvimento',
  aplicacao: 'Aplicações',
  conclusao: 'Conclusão',
  livre: 'Seção livre',
};

/** A ordem em que aparecem no menu do "+", que é a ordem em que se escreve. */
export const SECTION_KINDS: StudySectionKind[] = [
  'texto',
  'introducao',
  'desenvolvimento',
  'aplicacao',
  'conclusao',
  'livre',
];

export const newSection = (kind: StudySectionKind): StudySection => ({
  id: uid('sec_'),
  kind,
  text: '',
  ...(kind === 'livre' ? { title: '' } : {}),
});

/** O título que a seção mostra: o do autor nas livres, o do tipo nas demais. */
export const sectionTitle = (section: StudySection): string =>
  section.kind === 'livre' ? section.title || 'Seção' : SECTION_LABEL[section.kind];

/**
 * As seções do estudo, convertendo os campos antigos quando ainda não houver.
 *
 * A conversão acontece na leitura e **não apaga nada**: os campos antigos ficam
 * gravados como estavam. Um estudo escrito antes desta mudança abre com o
 * mesmo conteúdo, na mesma ordem, e passa a ser editável como lista.
 *
 * Os "Comentários" viram uma seção livre com esse título. Ele saiu da tela como
 * campo fixo, mas quem escreveu ali não pode perder o que escreveu.
 */
export function sectionsOf(doc: Study): StudySection[] {
  if (doc.sections) return doc.sections;

  const legado: Array<[StudySectionKind, string, string?]> = [
    ['texto', doc.mainText],
    ['introducao', doc.introduction],
    ['desenvolvimento', doc.development],
    ['livre', doc.comments, 'Comentários'],
    ['aplicacao', doc.application],
    ['conclusao', doc.conclusion],
  ];

  return legado
    .filter(([, texto]) => texto?.trim())
    .map(([kind, texto, titulo]) => ({
      id: uid('sec_'),
      kind,
      text: texto,
      ...(titulo ? { title: titulo } : {}),
    }));
}

/**
 * A referência principal do estudo, para a lista e a busca.
 *
 * Vem da primeira seção de texto bíblico; sem ela, do campo antigo — estudos
 * que nunca foram reabertos continuam mostrando o que sempre mostraram.
 */
export function mainTextOf(doc: Study): string {
  const secao = sectionsOf(doc).find((s) => s.kind === 'texto' && s.text.trim());
  return secao?.text ?? doc.mainText ?? '';
}

/** Só o que tem conteúdo — para exportar sem seções em branco. */
export const filledSections = (doc: Study): StudySection[] =>
  sectionsOf(doc).filter((s) => s.text.trim());
