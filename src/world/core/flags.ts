/**
 * Conditions: whether something holds of a save right now.
 *
 * Content writes them as small JSON objects — `{ "flag": "lantern_broken" }`,
 * `{ "all": [{ "hours": [6, 10] }, { "not": { "scene": "breakfast" } }] }` —
 * and everything that depends on the story (doors, scenes, NPC spawns,
 * quest steps) asks here.
 */

import { inHours } from './clock';
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
  return false;
}
