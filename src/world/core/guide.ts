/**
 * "Take me there" (prompt §9⅞ M6): where the footprints lead next. Pure — the page asks it
 * on every map change, the scene draws the trail, the ride sheet marks the right train.
 *
 * The way is the journal's (`directions`): on foot through doors and street ends, else to
 * this neighbourhood's station, a ride (with changes), and on foot from the station you get
 * off at. On each map the trail leads to the door or street end of the next map on the way;
 * on a station map with the ride next, to the train board by the platform. Saved nowhere.
 */

import { directions, type RouteLeg } from './journal';
import { walkPath, type MapLinks } from './places';
import type { MapObject, Tile, WorldSave } from './types';

/** what the trail on the map on screen leads to */
export type TrailSpec = { to: string } | { board: true };

export type Hop =
  | { kind: 'here' }
  | { kind: 'none'; note?: string }
  /** on foot to the next map on the way (`then`: the maps after it, for the corner map's route) */
  | { kind: 'walk'; next: string; then: string[] }
  /** on the platform: the rides to take, the first from this station */
  | { kind: 'board'; rides: Extract<RouteLeg, { kind: 'ride' }>[] };

/** The next step from where you stand to `to`. */
export function nextHop(s: WorldSave, to: string, index: MapLinks): Hop {
  const d = directions(s, to, index);
  if (d.kind === 'here') return { kind: 'here' };
  if (d.kind === 'none' || !d.legs.length) return { kind: 'none', ...(d.note ? { note: d.note } : {}) };
  const first = d.legs[0]!;
  const rides = d.legs.filter((l): l is Extract<RouteLeg, { kind: 'ride' }> => l.kind === 'ride');
  // the ride is next (perhaps after a walk to it): go to where it leaves from — the subway hall,
  // or a bus's or the train's own stop (西直门: out of the station, over to the 332)
  if (rides.length && (first.kind === 'ride' || d.legs[1]?.kind === 'ride')) {
    const r = rides[0]!;
    const from = r.mode === 'subway' ? `station-${r.from}` : `stop-${r.from}`;
    if (index[from]) {
      if (s.place.map === from) return { kind: 'board', rides };
      const walk = walkPath(index, s.place.map, from);
      if (walk && walk.length > 1) return { kind: 'walk', next: walk[1]!, then: walk.slice(2) };
    }
  }
  if (first.kind === 'walk') {
    const at = first.maps.indexOf(s.place.map);
    const next = first.maps[at + 1];
    if (next) return { kind: 'walk', next, then: first.maps.slice(at + 2) };
  }
  return rides.length ? { kind: 'board', rides } : { kind: 'none' };
}

/** What the trail on this map leads to, for a hop. */
export const trailFor = (h: Hop): TrailSpec | null => (h.kind === 'walk' ? { to: h.next } : h.kind === 'board' ? { board: true } : null);

const BOARDS = new Set(['board', 'bus-board', 'train-board']);

/**
 * The tiles the trail may end on: the doors into the next map and its street end (every tile
 * of the stretch of edge that leads there), or the free tiles beside the train board.
 */
export function trailGoals(spec: TrailSpec, objects: readonly MapObject[], width: number, height: number): Tile[] {
  const out: Tile[] = [];
  if ('board' in spec) {
    for (const o of objects) {
      if (o.kind !== 'sign' || !BOARDS.has(o.id)) continue;
      const [x, y] = o.tile;
      out.push([x, y + 1], [x - 1, y], [x + 1, y], [x, y - 1]);
    }
    return out;
  }
  for (const o of objects) {
    if (o.kind === 'door' && o.to.map === spec.to) out.push([o.tile[0], o.tile[1]]);
    if (o.kind === 'edge' && o.target.map === spec.to) {
      for (let i = Math.min(o.from, o.to); i <= Math.max(o.from, o.to); i++)
        out.push(o.side === 'left' ? [0, i] : o.side === 'right' ? [width - 1, i] : o.side === 'up' ? [i, 0] : [i, height - 1]);
    }
  }
  return out;
}

/** The ride leg to take from a station (the train to mark on its platform), if the way goes on from there. */
export const rideFrom = (rides: readonly Extract<RouteLeg, { kind: 'ride' }>[], at: string) => rides.find((r) => r.from === at);
