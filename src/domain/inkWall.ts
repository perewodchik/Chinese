import type { Library } from '../data/types';
import { charId, wordId, type ItemId } from './ids';
import { masteryOf, type RecallBook } from './memory';

/**
 * The wall: every character (or word) of a band as a tile, inked as darkly as
 * it is held today.
 *
 * Memory fades, and here it can be seen fading: a character reviewed last
 * week and not since is visibly paler than one reviewed yesterday. Five steps
 * of ink rather than a smooth scale — five read at a glance and do not shimmer
 * as the clock moves — and an outline for what has never been met.
 */

/** 0: never met; 1–5: faint to solid. */
export type Ink = 0 | 1 | 2 | 3 | 4 | 5;

export function inkOf(score: number, met: boolean): Ink {
  if (!met) return 0;
  if (score >= 0.85) return 5;
  if (score >= 0.6) return 4;
  if (score >= 0.35) return 3;
  if (score >= 0.12) return 2;
  return 1;
}

export interface WallTile {
  id: ItemId;
  text: string;
  ink: Ink;
}

export function wallOf(
  lib: Library,
  recall: RecallBook,
  learned: ReadonlySet<ItemId>,
  kind: 'chars' | 'words',
  band: number,
  now: number,
): WallTile[] {
  const items =
    kind === 'chars'
      ? lib.characters.filter((c) => c.hsk === band).map((c) => ({ id: charId(c.c), text: c.c }))
      : lib.words.filter((w) => w.hsk === band).map((w) => ({ id: wordId(w.w), text: w.w }));
  return items.map(({ id, text }) => {
    const sk = recall[id];
    const met = Boolean(sk && Object.keys(sk).length) || learned.has(id);
    return { id, text, ink: inkOf(sk ? masteryOf(sk, now).score : 0, met) };
  });
}

/** How many tiles at each step, 0–5, for the legend. */
export const inkCounts = (tiles: WallTile[]) =>
  tiles.reduce((a, t) => ((a[t.ink] += 1), a), [0, 0, 0, 0, 0, 0]);
