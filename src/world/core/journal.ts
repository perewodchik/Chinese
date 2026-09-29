/**
 * The journal (prompt §10 J1–J2): where a quest's step happens, the way
 * there as legs to draw, and the journal itself — the quest you follow,
 * the others under way, the story so far chapter by chapter, and leads to
 * side quests not yet started. Pure: the Journal tab only draws this.
 */

import { holds } from './flags';
import type { Shop } from './shop';
import type { Condition, NpcCard, Quest, QuestStep, Scene, WorldSave } from './types';

/** What the journal reads of the content. */
export interface JournalContent {
  quests: readonly Quest[];
  scenes: readonly Scene[];
  npcs: readonly NpcCard[];
  shops?: readonly Shop[];
}

/** A step with no place at all ("ride a shared bike anywhere"). */
export const ANYWHERE = 'anywhere';

/**
 * Where a person usually is: the first stop of their day, else the map
 * where people talk to them (the maps place most people by the map, not
 * by a timetable).
 */
export function npcHome(npc: string, c: Pick<JournalContent, 'npcs' | 'scenes'>): string | undefined {
  const card = c.npcs.find((n) => n.id === npc);
  const routine = card?.routine.find((r) => r.map !== 'school')?.map;
  if (routine) return routine;
  const counts = new Map<string, number>();
  for (const sc of c.scenes) if (sc.npc === npc && sc.trigger === 'talk') counts.set(sc.map, (counts.get(sc.map) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * The maps a condition points at: a scene's map, a station, where a person
 * is, the map a photo is taken on, the shop that sells a thing, the cat's
 * lane. With a save, only the parts that do not hold yet count (what is
 * done is no longer somewhere to go).
 */
export function conditionMaps(c: Condition, content: Omit<JournalContent, 'quests'>, s?: WorldSave): string[] {
  const out = new Set<string>();
  const walk = (x: Condition) => {
    if (s && holds(x, s)) return;
    if ('all' in x) x.all.forEach(walk);
    else if ('any' in x) x.any.forEach(walk);
    else if ('scene' in x) {
      const map = content.scenes.find((sc) => sc.id === x.scene)?.map;
      if (map) out.add(map);
    } else if ('station' in x) out.add(`station-${x.station}`);
    else if ('met' in x) {
      const map = npcHome(x.met, content);
      if (map) out.add(map);
    } else if ('photo' in x) {
      const [map] = x.photo.split(':');
      if (map && map !== 'npc') out.add(map);
    } else if ('item' in x && !('count' in x && x.count === 0)) {
      const shop = content.shops?.find((sh) => sh.stock.some((st) => st.item === x.item));
      if (shop) out.add(shop.map);
    } else if ('cat' in x) out.add('hutong-home');
  };
  walk(c);
  return [...out];
}

/** The maps of a step: what its condition points at, else its `where` (none for `anywhere`). */
export function stepMaps(step: QuestStep, content: Omit<JournalContent, 'quests'>, s?: WorldSave): string[] {
  const from = step.done ? conditionMaps(step.done, content, s) : [];
  if (from.length) return from;
  return step.where && step.where !== ANYWHERE ? [step.where] : [];
}

/**
 * The content check for the journal (J1): a kind on every quest (the
 * schema), a blurb on side quests, a place for every main step, and every
 * `where` a real map. `maps` is the set of built map ids.
 */
export function checkJournal(content: JournalContent, maps: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  for (const q of content.quests) {
    if (q.kind === 'side' && !q.blurb) errors.push(`quest ${q.id}: a side quest needs a blurb`);
    if (q.giver && !content.npcs.some((n) => n.id === q.giver)) errors.push(`quest ${q.id}: unknown giver ${q.giver}`);
    for (const st of q.steps) {
      if (st.where && st.where !== ANYWHERE && !maps.has(st.where)) errors.push(`quest ${q.id}/${st.id}: where "${st.where}" is not a map`);
      if (q.kind === 'main' && st.where !== ANYWHERE && !stepMaps(st, content).length) errors.push(`quest ${q.id}/${st.id}: a main step needs a place (a scene, station, person … or where)`);
    }
  }
  return errors;
}
