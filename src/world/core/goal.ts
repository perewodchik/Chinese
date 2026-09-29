/**
 * Where the task in hand is (prompt §9⅞ M3): the maps the first active
 * quest's step is waiting on, read from its `done` condition — a scene to
 * play (its map), a station to reach, a person to meet (where their day
 * starts). Only what is not yet true counts; none when the step names no
 * place (a flag, an item, a time of day).
 */

import { holds } from './flags';
import { activeQuests } from './quests';
import type { Condition, NpcCard, Quest, Scene, WorldSave } from './types';

export function goalMaps(s: WorldSave, quests: readonly Quest[], scenes: readonly Scene[], npcs: readonly NpcCard[]): string[] {
  const [first] = activeQuests(s, quests);
  if (!first?.step.done) return [];
  const out = new Set<string>();
  const walk = (c: Condition) => {
    if (holds(c, s)) return;
    if ('all' in c) c.all.forEach(walk);
    else if ('any' in c) c.any.forEach(walk);
    else if ('scene' in c) {
      const sc = scenes.find((x) => x.id === c.scene);
      if (sc?.map) out.add(sc.map);
    } else if ('station' in c) out.add(`station-${c.station}`);
    else if ('met' in c) {
      const map = npcs.find((n) => n.id === c.met)?.routine[0]?.map;
      if (map) out.add(map);
    }
  };
  walk(first.step.done);
  return [...out];
}
