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
import type { WorldSave } from './types';

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
