import { db, now, today, uid } from '../db/db';
import { normalize } from '../bible/canon';
import { htmlToPlain } from './sermonContent';
import {
  LOCAL_USER,
  type Devotional,
  type LibraryDoc,
  type OutlineBlock,
  type Sermon,
  type Study,
} from '../db/types';

/**
 * Documentos ministeriais: sermões, Rhema, cursos e materiais livres. Na tela
 * eles têm esses nomes; aqui guardam os identificadores originais do banco.
 * Todos compartilham o mesmo ciclo de vida (criar/salvar/duplicar/excluir) e
 * alimentam a Biblioteca Ministerial.
 */

export type DocKind = 'sermon' | 'study' | 'devotional' | 'doc';

export const DOC_LABEL: Record<DocKind, string> = {
  sermon: 'Sermão',
  study: 'Rhema',
  devotional: 'Curso',
  doc: 'Material',
};

export const DOC_ROUTE: Record<DocKind, string> = {
  sermon: '/sermoes',
  study: '/rhema',
  devotional: '/cursos',
  doc: '/biblioteca',
};

const tableFor = (kind: DocKind) =>
  ({ sermon: db.sermons, study: db.studies, devotional: db.devotionals, doc: db.libraryDocs })[kind];

export const emptyBlock = (): OutlineBlock => ({
  id: uid('blk_'),
  title: '',
  scripture: '',
  comment: '',
  application: '',
});

export function newSermon(): Sermon {
  const timestamp = now();
  return {
    id: uid('ser_'),
    userId: LOCAL_USER,
    title: '',
    theme: '',
    mainText: '',
    date: today(),
    category: 'Culto',
    introduction: '',
    development: '',
    conclusion: '',
    application: '',
    notes: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function newStudy(): Study {
  const timestamp = now();
  return {
    id: uid('std_'),
    userId: LOCAL_USER,
    title: '',
    theme: '',
    mainText: '',
    category: 'Discipulado',
    introduction: '',
    development: '',
    relatedVerses: [],
    comments: '',
    application: '',
    conclusion: '',
    notes: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function newDevotional(): Devotional {
  const timestamp = now();
  return {
    id: uid('dev_'),
    userId: LOCAL_USER,
    title: '',
    date: today(),
    category: 'Vida cristã',
    scripture: '',
    reflection: '',
    application: '',
    prayer: '',
    notes: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function newLibraryDoc(): LibraryDoc {
  const timestamp = now();
  return {
    id: uid('doc_'),
    userId: LOCAL_USER,
    title: '',
    category: 'Liderança',
    summary: '',
    content: '',
    tags: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/* --------------------------------- CRUD ---------------------------------- */

export async function listDocs<T>(kind: DocKind): Promise<T[]> {
  const rows = (await tableFor(kind).where('userId').equals(LOCAL_USER).toArray()) as T[];
  return rows.sort(
    (a, b) => (b as { updatedAt: number }).updatedAt - (a as { updatedAt: number }).updatedAt,
  );
}

export async function getDoc<T>(kind: DocKind, id: string): Promise<T | undefined> {
  return (await tableFor(kind).get(id)) as T | undefined;
}

export async function saveDoc<T extends { id: string; updatedAt: number }>(
  kind: DocKind,
  doc: T,
): Promise<T> {
  const record = { ...doc, updatedAt: now() };
  await tableFor(kind).put(record as never);
  return record;
}

export async function removeDoc(kind: DocKind, id: string): Promise<void> {
  await tableFor(kind).delete(id);
  await db.notes.where('parentId').equals(id).delete();
  // o arquivo importado não pode ficar órfão ocupando espaço no aparelho
  await db.attachments.where('docId').equals(id).delete();
}

export async function duplicateDoc<T extends { id: string; title: string }>(
  kind: DocKind,
  doc: T,
): Promise<T> {
  const timestamp = now();
  const copy = {
    ...doc,
    id: uid(`${kind.slice(0, 3)}_`),
    title: `${doc.title} (cópia)`,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as T;

  // documento com arquivo importado leva a própria cópia do arquivo: se as duas
  // apontassem para o mesmo, excluir uma deixaria a outra sem nada para exibir
  const source = (doc as { attachmentId?: string }).attachmentId;
  if (source) {
    const original = await db.attachments.get(source);
    if (original) {
      const clone = { ...original, id: uid('att_'), docId: copy.id, createdAt: timestamp };
      await db.attachments.put(clone);
      (copy as { attachmentId?: string }).attachmentId = clone.id;
    }
  }

  await tableFor(kind).put(copy as never);
  return copy;
}

/* ---------------------------- Biblioteca unificada ------------------------ */

export interface LibraryEntry {
  id: string;
  kind: DocKind;
  title: string;
  category: string;
  subtitle: string;
  tags: string[];
  updatedAt: number;
  favorite?: boolean;
  searchBlob: string;
}

const blob = (...parts: Array<string | undefined | string[]>) =>
  normalize(parts.flat().filter(Boolean).join(' '));

export async function loadLibrary(): Promise<LibraryEntry[]> {
  const [sermons, studies, devotionals, docs] = await Promise.all([
    listDocs<Sermon>('sermon'),
    listDocs<Study>('study'),
    listDocs<Devotional>('devotional'),
    listDocs<LibraryDoc>('doc'),
  ]);

  const entries: LibraryEntry[] = [
    ...sermons.map((s) => ({
      id: s.id,
      kind: 'sermon' as const,
      title: s.title || 'Sermão sem título',
      category: s.category || 'Sermões',
      subtitle: [s.theme, s.mainText].filter(Boolean).join(' · '),
      tags: s.tags,
      updatedAt: s.updatedAt,
      favorite: s.favorite,
      searchBlob: blob(
        s.title, s.theme, s.mainText, s.introduction, s.development, s.conclusion,
        s.application, s.appeal, s.tags,
        (s.content ?? []).map((b) => `${htmlToPlain(b.html)} ${b.reference ?? ''}`),
        (s.blocks ?? []).map((b) => `${b.title} ${b.comment} ${b.application} ${b.scripture}`),
      ),
    })),
    ...studies.map((s) => ({
      id: s.id,
      kind: 'study' as const,
      title: s.title || 'Rhema sem título',
      category: s.category || 'Rhema',
      subtitle: [s.theme, s.mainText].filter(Boolean).join(' · '),
      tags: s.tags,
      updatedAt: s.updatedAt,
      favorite: s.favorite,
      searchBlob: blob(s.title, s.theme, s.mainText, s.introduction, s.development, s.comments, s.application, s.conclusion, s.tags),
    })),
    ...devotionals.map((d) => ({
      id: d.id,
      kind: 'devotional' as const,
      title: d.title || 'Curso sem título',
      category: d.category || 'Cursos',
      subtitle: [d.date, d.scripture].filter(Boolean).join(' · '),
      tags: d.tags,
      updatedAt: d.updatedAt,
      favorite: d.favorite,
      searchBlob: blob(d.title, d.scripture, d.reflection, d.application, d.prayer, d.tags),
    })),
    ...docs.map((d) => ({
      id: d.id,
      kind: 'doc' as const,
      title: d.title || 'Material sem título',
      category: d.category,
      subtitle: d.summary,
      tags: d.tags,
      updatedAt: d.updatedAt,
      favorite: d.favorite,
      searchBlob: blob(d.title, d.summary, d.content, d.tags),
    })),
  ];

  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function filterLibrary(
  entries: LibraryEntry[],
  query: string,
  category?: string | null,
): LibraryEntry[] {
  const q = normalize(query);
  return entries.filter((e) => {
    if (category && category !== 'Todos') {
      const kindCategory = { sermon: 'Sermões', study: 'Rhema', devotional: 'Cursos', doc: '' }[e.kind];
      if (e.category !== category && kindCategory !== category) return false;
    }
    return !q || e.searchBlob.includes(q);
  });
}
