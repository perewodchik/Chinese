/**
 * Conditions: whether something holds of a save right now.
 *
 * Content writes them as small JSON objects — `{ "flag": "lantern_broken" }`,
 * `{ "all": [{ "hours": [6, 10] }, { "not": { "scene": "breakfast" } }] }` —
 * and everything that depends on the story (doors, scenes, NPC spawns,
 * quest steps) asks here.
 */

import { festivalOf, seasonOf, weatherOf } from './calendar';
import { dayOf, inHours } from './clock';
import { CAT_TRUST_DAYS } from './room';
import type { Condition, WorldSave } from './types';

export function holds(c: Condition | undefined, s: WorldSave): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => holds(x, s));
  if ('any' in c) return c.any.some((x) => holds(x, s));
  if ('not' in c) return !holds(c.not, s);
  if ('flag' in c) return s.flags.includes(c.flag);
  if ('item' in c) return (s.bag.items[c.item] ?? 0) >= (c.count ?? 1);
  if ('money' in c) return s.bag.money >= c.money;
  if ('hours' in c) return inHours(s.clock, c.hours);
  if ('chapter' in c) return s.chapter >= c.chapter;
  if ('quest' in c) {
    const q = s.quests[c.quest];
    // { quest } started · { quest, done: true } finished · { quest, done: false } under way · { quest, step } at that step
    if (!q) return false;
    if (c.done !== undefined) return q.done === c.done;
    if (c.step !== undefined) return !q.done && q.step === c.step;
    return true;
  }
  if ('scene' in c) return s.scenes.includes(c.scene);
  if ('spirit' in c) return c.spirit in s.spirits;
  if ('idiom' in c) return c.idiom in s.idioms;
  if ('station' in c) return s.stations.includes(c.station);
  if ('met' in c) return c.met in s.npcs;
  if ('hearts' in c) return (s.npcs[c.hearts]?.hearts ?? 0) >= c.min;
  if ('remembers' in c) return !!s.npcs[c.remembers]?.notes.includes(c.note);
  if ('weather' in c) return weatherOf(dayOf(s.clock)) === c.weather;
  if ('festival' in c) return festivalOf(dayOf(s.clock))?.id === c.festival;
  if ('season' in c) return seasonOf(dayOf(s.clock)) === c.season;
  if ('photo' in c) return s.photos.includes(c.photo);
  if ('daily' in c) return s.daily[c.daily] === dayOf(s.clock);
  if ('fresh' in c) return (s.npcs[c.fresh]?.talk ?? 0) !== dayOf(s.clock);
  if ('bike' in c) return c.bike === 'none' ? !s.bike : c.bike === 'owned' ? !!s.bike : c.bike === 'riding' ? s.bike?.at === 'riding' : s.bike?.flat !== undefined;
  if ('visited' in c) return (s.visited ?? []).includes(c.visited) || s.place.map === c.visited;
  if ('read' in c) return s.flags.includes(readFlag(c.read));
  if ('cat' in c) return c.cat === 'named' ? !!s.cat.name : c.cat === 'trusts' ? s.cat.fed >= CAT_TRUST_DAYS : s.cat.day === dayOf(s.clock);
  return false;
}

/** RW2: the flag that remembers a sign was read (`<map>:<sign id>`) */
export const readFlag = (sign: string) => `read:${sign}`;
