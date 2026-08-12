import { db, now, today, uid } from '../db/db';
import { LOCAL_USER, type ReadingEvent } from '../db/types';

/** Histórico de leitura, sequência de dias e indicadores do painel ministerial. */

export async function registerReading(
  translation: string,
  book: string,
  chapter: number,
): Promise<void> {
  const day = today();
  const already = await db.readingEvents
    .where('[userId+day]')
    .equals([LOCAL_USER, day])
    .filter((e) => e.book === book && e.chapter === chapter)
    .first();
  if (already) return;

  const event: ReadingEvent = {
    id: uid('rd_'),
    userId: LOCAL_USER,
    translation,
    book,
    chapter,
    day,
    at: now(),
  };
  await db.readingEvents.put(event);
}

export interface ReadingStats {
  chaptersRead: number;
  distinctChapters: number;
  daysActive: number;
  streak: number;
  last7: Array<{ day: string; count: number }>;
}

const dayKey = (date: Date) => today(date);

export async function readingStats(): Promise<ReadingStats> {
  const events = await db.readingEvents.where('userId').equals(LOCAL_USER).toArray();
  const days = new Set(events.map((e) => e.day));
  const distinct = new Set(events.map((e) => `${e.book}:${e.chapter}`));

  // sequência de dias consecutivos terminando hoje ou ontem
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const last7: Array<{ day: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    last7.push({ day: key, count: events.filter((e) => e.day === key).length });
  }

  return {
    chaptersRead: events.length,
    distinctChapters: distinct.size,
    daysActive: days.size,
    streak,
    last7,
  };
}

export async function recentChapters(limit = 8): Promise<ReadingEvent[]> {
  const events = await db.readingEvents.orderBy('at').reverse().limit(limit * 3).toArray();
  const seen = new Set<string>();
  const out: ReadingEvent[] = [];
  for (const e of events) {
    const key = `${e.book}:${e.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}
