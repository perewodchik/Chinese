/**
 * The city going about its day (prompt D5): passers-by who cross the map and
 * leave, pigeons that peck and take off when you come close, cyclists, and
 * people standing about who turn and blink. The choices are made here with
 * a seeded random, so they can be tested; the scene only animates them.
 */

import { findPath, walkable, type Grid } from '../core/grid';
import type { Facing, Tile } from '../core/types';

export type Rand = () => number;

export function rand(seed: number): Rand {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

/** Walkable tiles on the map's border — where passers-by come in and go out. */
export function borderTiles(g: Grid): Tile[] {
  const out: Tile[] = [];
  for (let x = 0; x < g.width; x++) for (const y of [0, g.height - 1]) if (walkable(g, x, y)) out.push([x, y]);
  for (let y = 1; y < g.height - 1; y++) for (const x of [0, g.width - 1]) if (walkable(g, x, y)) out.push([x, y]);
  return out;
}

/** Every walkable tile. */
export function openTiles(g: Grid): Tile[] {
  const out: Tile[] = [];
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (walkable(g, x, y)) out.push([x, y]);
  return out;
}

/**
 * A trip for a passer-by: in at one border tile, out at another at least
 * half the map away. Maps with no border way through get wanderers instead:
 * from one open tile to another far off.
 */
export function crowdTrip(g: Grid, r: Rand): Tile[] | null {
  const border = borderTiles(g);
  const pool = border.length >= 2 ? border : openTiles(g);
  const far = Math.max(4, Math.floor((g.width + g.height) / 3));
  for (let tries = 0; tries < 12; tries++) {
    const a = pick(r, pool);
    const b = pick(r, pool);
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < far) continue;
    const path = findPath(g, a, [b]);
    if (path?.length) return [a, ...path];
  }
  return null;
}

/** The looks passers-by wear. */
export const PASSERS = [
  'woman', 'woman-teal', 'woman-black', 'uncle', 'uncle-brown', 'tourist', 'tourist-green',
  'auntie-green', 'auntie-purple', 'kid-blue', 'grandpa-blue', 'rider-blue',
];

/** Somewhere to stand for pigeons: open tiles, spread out. */
export function pigeonSpots(g: Grid, r: Rand, n: number): Tile[] {
  const open = openTiles(g);
  const out: Tile[] = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const t = pick(r, open);
    if (out.every((o) => Math.abs(o[0] - t[0]) + Math.abs(o[1] - t[1]) > 1)) out.push(t);
  }
  return out;
}

/** Pigeons fly off when the hero comes within this many tiles. */
export const SCARE = 2;
export const scared = (bird: Tile, hero: Tile) => Math.abs(bird[0] - hero[0]) + Math.abs(bird[1] - hero[1]) <= SCARE;

/** What a person standing about does next, and in how many ms. */
export function idleNext(r: Rand, facing: Facing): { after: number; act: 'blink' | 'turn' | 'still'; facing: Facing } {
  const after = 1200 + Math.floor(r() * 3800);
  const roll = r();
  if (roll < 0.45) return { after, act: 'blink', facing };
  if (roll < 0.75) return { after, act: 'turn', facing: pick(r, ['up', 'down', 'left', 'right'] as const) };
  return { after, act: 'still', facing };
}

/** The way a step goes. */
export function facingOf(from: Tile, to: Tile): Facing {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}
