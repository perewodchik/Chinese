/**
 * What a tap, a hold or a key means for the hero (concept §4), decided
 * without Phaser so it can be tested:
 *
 * - a tap on the ground walks there by A* (or as near as can be reached);
 * - a tap on a person walks up beside them, turns to face them and talks;
 * - a tap on a sign or a thing walks up to it and looks;
 * - a second tap within 300 ms runs;
 * - holding walks one step at a time toward the finger;
 * - arrows / WASD step, Shift runs, Space or Enter acts on what is ahead.
 */

import { ahead, approach, STEP, walkable, walkTo, type Grid } from '../core/grid';
import type { Facing, MapObject, Tile } from '../core/types';

export type Plan =
  | { kind: 'walk'; path: Tile[]; arrived: boolean }
  | { kind: 'talk'; npc: string; spot: string; path: Tile[]; facing: Facing; arrived: boolean }
  | { kind: 'look'; object: MapObject; path: Tile[]; facing: Facing; arrived: boolean };

const at = (o: MapObject, [x, y]: Tile) => 'tile' in o && o.tile[0] === x && o.tile[1] === y;

/** The person or thing standing on a tile, if any: people first, then signs and other things to look at. */
export function objectAt(objects: readonly MapObject[], tile: Tile): MapObject | undefined {
  return (
    objects.find((o) => o.kind === 'npc' && at(o, tile)) ??
    objects.find((o) => (o.kind === 'sign' || o.kind === 'spirit' || o.kind === 'bike') && at(o, tile)) ??
    // a prop is tapped anywhere on its footprint
    objects.find((o) => o.kind === 'prop' && inFootprint(o, tile))
  );
}

function inFootprint(o: Extract<MapObject, { kind: 'prop' }>, [x, y]: Tile): boolean {
  const [w, h] = o.blocks ?? [1, 1];
  return x >= o.tile[0] && x < o.tile[0] + Math.max(1, w) && y <= o.tile[1] && y > o.tile[1] - Math.max(1, h);
}

export function planTap(g: Grid, objects: readonly MapObject[], from: Tile, tile: Tile, occupied: ReadonlySet<string>): Plan {
  const o = objectAt(objects, tile);
  if (o?.kind === 'npc') {
    const a = approach(g, from, o.tile, occupied);
    return { kind: 'talk', npc: o.npc, spot: o.id, path: a.path, facing: a.facing, arrived: a.arrived };
  }
  if (o && o.kind !== 'prop' && 'tile' in o) {
    const a = approach(g, from, o.tile, occupied);
    return { kind: 'look', object: o, path: a.path, facing: a.facing, arrived: a.arrived };
  }
  if (o?.kind === 'prop' && !walkable(g, tile[0], tile[1])) {
    const a = approach(g, from, tile, occupied);
    return { kind: 'look', object: o, path: a.path, facing: a.facing, arrived: a.arrived };
  }
  const w = walkTo(g, from, tile, occupied);
  return { kind: 'walk', path: w.path, arrived: w.arrived };
}

/** One step for a key or a held finger: the tile ahead if it is free, else just turn. */
export function stepOnce(g: Grid, from: Tile, facing: Facing, occupied: ReadonlySet<string>): { to: Tile | null; facing: Facing } {
  const next = ahead(from, facing);
  return { to: walkable(g, next[0], next[1], occupied) ? next : null, facing };
}

/** Which way to step toward a point held on screen (in tiles, fractions allowed). */
export function facingTo(from: Tile, x: number, y: number): Facing | null {
  const dx = x - (from[0] + 0.5);
  const dy = y - (from[1] + 0.5);
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

export const KEY_FACING: Record<string, Facing> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

/** ms for one tile */
export const WALK_MS = 180;
export const RUN_MS = 100;
export const DOUBLE_TAP_MS = 300;

/**
 * The zooms a pinch can choose, around the page's own: 0.75× to 1.5× of it,
 * but only whole numbers, so pixels stay square.
 */
export function pinchZooms(base: number): number[] {
  const lo = Math.max(1, Math.ceil(base * 0.75));
  const hi = Math.max(lo, Math.floor(base * 1.5));
  const out: number[] = [];
  for (let z = lo; z <= hi; z++) out.push(z);
  return out;
}

/** The zoom a pinch lands on: the allowed zoom nearest to base × scale. */
export function pinchTo(base: number, scale: number): number {
  const want = base * scale;
  return pinchZooms(base).reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
}

export { STEP };
