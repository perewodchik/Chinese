/**
 * Who is on a map now (the "cast"): the people its file places, minus those
 * whose `when` does not hold or whose routine has them somewhere else at
 * this hour, moved to where their routine says if it says here — plus the
 * people whose routine brings them here though the map does not name them.
 *
 * A card with no routine stays where the map puts it; a routine that says
 * nothing about this hour leaves the person at their spot on the map.
 */

import { holds } from './flags';
import { whereIs } from './schedule';
import type { MapObject, NpcCard, WorldSave } from './types';

type Npc = Extract<MapObject, { kind: 'npc' }>;

export function castMap(objects: readonly MapObject[], map: string, npcs: readonly NpcCard[], save: WorldSave, minutes = save.clock): MapObject[] {
  const cards = new Map(npcs.map((n) => [n.id, n]));
  const out: MapObject[] = [];
  const here = new Set<string>();
  for (const o of objects) {
    if (o.kind !== 'npc') {
      // a prop may be there only sometimes (the lantern whole, then broken); a door's `when` is its lock, not its presence
      if (o.kind === 'prop' && o.when && !holds(o.when, save)) continue;
      out.push(o);
      continue;
    }
    if (o.when && !holds(o.when, save)) continue;
    const card = cards.get(o.npc);
    const stop = card ? whereIs(card, minutes) : null;
    if (stop && stop.map !== map) continue;
    here.add(o.npc);
    out.push(stop ? ({ ...o, tile: stop.tile, facing: stop.facing ?? o.facing } satisfies Npc) : o);
  }
  for (const card of npcs) {
    if (here.has(card.id)) continue;
    const stop = whereIs(card, minutes);
    if (stop?.map === map) out.push({ kind: 'npc', id: `routine-${card.id}`, npc: card.id, tile: stop.tile, ...(stop.facing ? { facing: stop.facing } : {}) });
  }
  return out;
}

/** The sprite frame prefix each person is drawn with: their card's look (with its palette), else their id. */
export function looksOf(npcs: readonly NpcCard[]): Record<string, string> {
  return Object.fromEntries(npcs.map((n) => [n.id, n.look.palette ? `${n.look.sprite}-${n.look.palette}` : n.look.sprite]));
}
