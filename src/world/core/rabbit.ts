/**
 * 兔儿爷 alive (prompt X7): what he shows over his head, and what he wears.
 *
 * Emotes are little pictures that pop up for a moment — proud and cheering
 * when a spirit is found, happy at a stamp or a new friend, sulky when
 * someone says 守株待兔 (a rabbit fool — he takes it personally), sleepy
 * when you stand still a while, blushing when you pat him. His hat follows
 * the calendar: a snow cap in winter, a flower on a festival, and on 中秋
 * the armour of the clay figure he is modelled on.
 */

import { festivalOf, seasonOf } from './calendar';
import { dayOf } from './clock';
import { STEP, walkable, type Grid } from './grid';
import type { Facing, Tile, WorldSave } from './types';

export type Emote = 'happy' | 'sulky' | 'sleepy' | 'proud' | 'blush';
export type Hat = 'none' | 'snow' | 'flower' | 'armour';

export const EMOTES: readonly Emote[] = ['happy', 'sulky', 'sleepy', 'proud', 'blush'];

/** standing still this long, he dozes off */
export const DOZE_AFTER_MS = 25_000;
/** how long an emote stays up */
export const EMOTE_MS = 2_400;

export function hatFor(clock: number): Hat {
  const day = dayOf(clock);
  const f = festivalOf(day);
  if (f?.id === 'zhongqiu') return 'armour';
  if (f) return 'flower';
  return seasonOf(day) === 'winter' ? 'snow' : 'none';
}

/** How he takes what just happened, if he has a feeling about it. */
export function emoteFor(before: WorldSave, after: WorldSave): Emote | null {
  const newly = <T>(a: Record<string, T>, b: Record<string, T>) => Object.keys(b).filter((k) => !(k in a));
  if (newly(before.spirits, after.spirits).length) return 'proud';
  if (newly(before.idioms, after.idioms).includes('守株待兔')) return 'sulky';
  if (newly(before.stamps, after.stamps).length) return 'happy';
  const friend = Object.keys(after.npcs).some((k) => (after.npcs[k]?.hearts ?? 0) >= 3 && (before.npcs[k]?.hearts ?? 0) < 3);
  if (friend || (after.cat.name && !before.cat.name)) return 'happy';
  return null;
}

/**
 * Where he floats: over a free tile beside you, never over a wall, a
 * building or someone standing there. He keeps his side while it stays free,
 * and never waits on the tile you are about to step onto. Boxed in, it is
 * [0, 0] and he rides on your shoulder.
 */
export function rabbitSpot(
  g: Grid,
  at: Tile,
  facing: Facing,
  keep: Tile | null,
  occupied?: ReadonlySet<string>,
): Tile {
  const [fx, fy] = STEP[facing];
  const free = ([dx, dy]: Tile) => !(dx === fx && dy === fy) && walkable(g, at[0] + dx, at[1] + dy, occupied);
  const back: Tile = [-fx || 0, -fy || 0];
  // his own sides for the way you face: right/left of you, then behind, then the corners behind
  const side: Tile = fx === 0 ? [1, 0] : [0, 1];
  const other: Tile = [-side[0] || 0, -side[1] || 0];
  const order: Tile[] = [
    ...(keep ? [keep] : []),
    side,
    other,
    back,
    [back[0] + side[0], back[1] + side[1]],
    [back[0] + other[0], back[1] + other[1]],
  ];
  return order.find(free) ?? [0, 0];
}
