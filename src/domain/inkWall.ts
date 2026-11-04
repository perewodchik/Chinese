import type { Library } from '../data/types';
import { charId, wordId, type ItemId } from './ids';
import { levelOf, type Level, type RecallBook } from './memory';

/**
 * The wall: every character (or word) of a band as a tile, filled as deeply
 * as it is known today — the same 0 to 3 as everywhere else, from review
 * alone. Memory fades, and here it can be seen fading: a level slips when an
 * item goes long past due.
 */

export interface WallTile {
  id: ItemId;
  text: string;
  level: Level;
}

export function wallOf(lib: Library, recall: RecallBook, kind: 'chars' | 'words', band: number, now: number): WallTile[] {
  const items =
    kind === 'chars'
      ? lib.characters.filter((c) => c.hsk === band).map((c) => ({ id: charId(c.c), text: c.c }))
      : lib.words.filter((w) => w.hsk === band).map((w) => ({ id: wordId(w.w), text: w.w }));
  return items.map(({ id, text }) => ({ id, text, level: levelOf(recall[id], now) }));
}

/** How many tiles at each level, 0–3, for the legend. */
export const levelCounts = (tiles: WallTile[]) => tiles.reduce((a, t) => ((a[t.level] += 1), a), [0, 0, 0, 0]);
