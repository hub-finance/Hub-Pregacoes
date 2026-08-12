import { parseReference } from '../bible/reference';
import { getVerses } from '../bible/repository';

/**
 * Versículo do dia — seleção determinística (mesma data ⇒ mesmo versículo),
 * calculada localmente para funcionar offline.
 */

export const DAILY_REFERENCES = [
  'João 3:16', 'Salmos 23:1', 'Filipenses 4:13', 'Provérbios 3:5', 'Isaías 41:10',
  'Romanos 8:28', 'Josué 1:9', 'Jeremias 29:11', 'Mateus 11:28', 'Salmos 46:1',
  'Filipenses 4:6', '2 Coríntios 5:17', 'Gálatas 2:20', 'Hebreus 11:1', 'Tiago 1:2',
  '1 Pedro 5:7', 'Salmos 119:105', 'Isaías 40:31', 'João 14:6', 'Efésios 2:8',
  'Romanos 12:2', 'Colossenses 3:23', 'Mateus 6:33', 'Salmos 37:5', 'Provérbios 16:3',
  '1 Coríntios 13:4', 'Salmos 91:1', 'João 15:5', 'Atos 1:8', 'Romanos 10:9',
  '2 Timóteo 1:7', 'Salmos 34:8', 'Lamentações 3:22', 'Miqueias 6:8', 'Sofonias 3:17',
  'Mateus 28:19', 'João 8:32', 'Hebreus 4:16', 'Tiago 4:8', '1 João 1:9',
  'Salmos 27:1', 'Isaías 26:3', 'Provérbios 18:10', 'Romanos 5:8', 'Efésios 6:10',
  'Salmos 121:1', 'Neemias 8:10', 'Deuteronômio 31:6', '1 Crônicas 16:11', 'Marcos 11:24',
  'Lucas 6:38', 'João 10:10', '2 Coríntios 12:9', 'Gálatas 5:22', 'Filipenses 1:6',
  'Colossenses 3:15', '1 Tessalonicenses 5:16', 'Hebreus 12:1', 'Tiago 1:22', 'Apocalipse 3:20',
];

export interface DailyVerse {
  reference: string;
  text: string;
  book: string;
  chapter: number;
  verse: number;
}

/** Índice estável a partir da data (yyyy-mm-dd). */
export function dailyIndex(date = new Date(), size = DAILY_REFERENCES.length): number {
  const seed = date.getFullYear() * 1000 + dayOfYear(date);
  return seed % size;
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export async function getVerseOfDay(
  translation: string,
  date = new Date(),
): Promise<DailyVerse | null> {
  const total = DAILY_REFERENCES.length;
  // percorre a lista a partir do índice do dia até achar um versículo existente
  for (let offset = 0; offset < total; offset++) {
    const raw = DAILY_REFERENCES[(dailyIndex(date, total) + offset) % total];
    const parsed = parseReference(raw);
    if (!parsed?.verse) continue;
    try {
      const rows = await getVerses({
        translation,
        book: parsed.book,
        chapter: parsed.chapter,
        verse: parsed.verse,
      });
      if (rows[0]?.text) {
        return {
          reference: raw,
          text: rows[0].text,
          book: parsed.book,
          chapter: parsed.chapter,
          verse: parsed.verse,
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}
