/**
 * Doors and the edges of maps (prompt D4): stepping onto a door, or onto an
 * edge tile inside an exit's range, takes you to another map. Pure, so the
 * rules are tested without Phaser.
 */

import { holds } from '../core/flags';
import type { Facing, MapObject, Tile, WorldSave } from '../core/types';

export type Door = Extract<MapObject, { kind: 'door' }>;
export type Edge = Extract<MapObject, { kind: 'edge' }>;

/** Where to arrive. `x` or `y` of -1 means "the far side" of the next map, known only once it loads. */
export interface Arrival {
  map: string;
  tile: Tile;
  facing: Facing;
}

/** The edge exit the hero is on, if any. */
export function edgeAt(objects: readonly MapObject[], [x, y]: Tile, width: number, height: number): Edge | undefined {
  return objects.find((o): o is Edge => {
    if (o.kind !== 'edge') return false;
    const along = o.side === 'left' || o.side === 'right' ? y : x;
    if (along < o.from || along > o.to) return false;
    if (o.side === 'left') return x === 0;
    if (o.side === 'right') return x === width - 1;
    if (o.side === 'up') return y === 0;
    return y === height - 1;
  });
}

const OPPOSITE: Record<Facing, Facing> = { left: 'right', right: 'left', up: 'down', down: 'up' };

/** Leaving by an edge: you come in at the opposite side of the next map, moved along by `offset`. */
export function throughEdge(e: Edge, [x, y]: Tile): Arrival {
  const facing = e.side; // keep walking the way you were going
  const o = e.target.offset;
  switch (e.side) {
    case 'right':
      return { map: e.target.map, tile: [0, y + o], facing };
    case 'left':
      return { map: e.target.map, tile: [-1, y + o], facing };
    case 'down':
      return { map: e.target.map, tile: [x + o, 0], facing };
    default:
      return { map: e.target.map, tile: [x + o, -1], facing };
  }
}

/** The far side filled in, once the map's size is known. */
export function resolveArrival(tile: Tile, width: number, height: number): Tile {
  return [tile[0] < 0 ? width - 1 : tile[0], tile[1] < 0 ? height - 1 : tile[1]];
}

export type DoorResult = { open: true; to: Arrival } | { open: false; why: string };

/** Whether a door lets you through now, and where it goes. */
export function throughDoor(d: Door, save: WorldSave): DoorResult {
  if (d.when && !holds(d.when, save)) return { open: false, why: d.locked ?? 'It is locked.' };
  return { open: true, to: { map: d.to.map, tile: d.to.tile, facing: d.to.facing ?? 'down' } };
}

export { OPPOSITE };
