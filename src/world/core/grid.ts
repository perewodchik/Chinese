/**
 * Where the hero can walk, and the way there.
 *
 * A map's `collide` layer becomes a grid of blocked tiles. People standing
 * about block too, but they move, so they are passed to each search rather
 * than baked into the grid. Paths are 4-directional A* with a Manhattan
 * guess; a tap on a tile nobody can reach walks to the nearest tile that can
 * be reached, so a tap is never simply ignored.
 */

import type { Facing, Tile } from './types';

export interface Grid {
  width: number;
  height: number;
  /** 1 = blocked, row by row */
  blocked: Uint8Array;
}

export const key = (x: number, y: number) => `${x},${y}`;

/** From rows of text (`#` blocks, anything else is free) — how maps and tests write it. */
export function gridFromRows(rows: readonly string[]): Grid {
  const height = rows.length;
  const width = Math.max(0, ...rows.map((r) => r.length));
  const blocked = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) blocked[y * width + x] = (row[x] ?? '#') === '#' ? 1 : 0;
  });
  return { width, height, blocked };
}

export function gridFromLayer(width: number, height: number, isBlocked: (x: number, y: number) => boolean): Grid {
  const blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) blocked[y * width + x] = isBlocked(x, y) ? 1 : 0;
  return { width, height, blocked };
}

export const inside = (g: Grid, x: number, y: number) => x >= 0 && y >= 0 && x < g.width && y < g.height;

/** Walkable: on the map, not a wall, nobody standing there. */
export function walkable(g: Grid, x: number, y: number, occupied?: ReadonlySet<string>): boolean {
  return inside(g, x, y) && g.blocked[y * g.width + x] === 0 && !occupied?.has(key(x, y));
}

export const STEP: Record<Facing, Tile> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const ahead = ([x, y]: Tile, f: Facing): Tile => [x + STEP[f][0], y + STEP[f][1]];

/** Which way to face to look from `from` at `to` (the larger difference wins; ties look up/down). */
export function facingToward(from: Tile, to: Tile): Facing {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  if (dy === 0 && dx === 0) return 'down';
  return dy > 0 ? 'down' : 'up';
}

/** Facing of one step between neighbouring tiles. */
export const stepFacing = (from: Tile, to: Tile): Facing => facingToward(from, to);

class Heap {
  private items: [number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(node: number, f: number) {
    const a = this.items;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0][1];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const ORDER: Facing[] = ['up', 'right', 'down', 'left'];

/**
 * A* from `from` to any of `goals`. Returns the tiles after `from`, ending on
 * a goal, or null when none can be reached. `from` itself may be occupied
 * (the hero stands there).
 */
export function findPath(g: Grid, from: Tile, goals: readonly Tile[], occupied?: ReadonlySet<string>): Tile[] | null {
  const targets = goals.filter(([x, y]) => walkable(g, x, y, occupied) || (x === from[0] && y === from[1]));
  if (!targets.length) return null;
  const idx = (x: number, y: number) => y * g.width + x;
  const start = idx(from[0], from[1]);
  const goalSet = new Set(targets.map(([x, y]) => idx(x, y)));
  if (goalSet.has(start)) return [];
  const h = (i: number) => {
    const x = i % g.width;
    const y = (i - x) / g.width;
    let best = Infinity;
    for (const [tx, ty] of targets) best = Math.min(best, Math.abs(tx - x) + Math.abs(ty - y));
    return best;
  };
  const cost = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open = new Heap();
  open.push(start, h(start));
  while (open.size) {
    const cur = open.pop();
    if (goalSet.has(cur)) {
      const path: Tile[] = [];
      for (let c = cur; c !== start; c = came.get(c)!) path.push([c % g.width, Math.floor(c / g.width)]);
      return path.reverse();
    }
    const cx = cur % g.width;
    const cy = (cur - cx) / g.width;
    const g0 = cost.get(cur)!;
    for (const f of ORDER) {
      const nx = cx + STEP[f][0];
      const ny = cy + STEP[f][1];
      if (!walkable(g, nx, ny, occupied)) continue;
      const n = idx(nx, ny);
      const g1 = g0 + 1;
      if (g1 < (cost.get(n) ?? Infinity)) {
        cost.set(n, g1);
        came.set(n, cur);
        open.push(n, g1 + h(n));
      }
    }
  }
  return null;
}

/** Every tile reachable from `from`, with its distance in steps. */
export function reachable(g: Grid, from: Tile, occupied?: ReadonlySet<string>): Map<string, number> {
  const out = new Map<string, number>([[key(from[0], from[1]), 0]]);
  const queue: Tile[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    const d = out.get(key(x, y))!;
    for (const f of ORDER) {
      const nx = x + STEP[f][0];
      const ny = y + STEP[f][1];
      if (!walkable(g, nx, ny, occupied) || out.has(key(nx, ny))) continue;
      out.set(key(nx, ny), d + 1);
      queue.push([nx, ny]);
    }
  }
  return out;
}

export interface Walk {
  path: Tile[];
  /** where the walk ends */
  end: Tile;
  /** false when the tapped tile could not be reached and the walk stops short */
  arrived: boolean;
}

/**
 * A walk toward a tapped tile: the tile itself if it can be reached, else
 * the reachable tile nearest to it (then the one fewest steps away).
 */
export function walkTo(g: Grid, from: Tile, to: Tile, occupied?: ReadonlySet<string>): Walk {
  const direct = findPath(g, from, [to], occupied);
  if (direct) return { path: direct, end: direct.length ? direct[direct.length - 1] : from, arrived: true };
  let best: { tile: Tile; far: number; steps: number } | null = null;
  for (const [k, steps] of reachable(g, from, occupied)) {
    const [x, y] = k.split(',').map(Number);
    const far = Math.abs(x - to[0]) + Math.abs(y - to[1]);
    if (!best || far < best.far || (far === best.far && steps < best.steps)) best = { tile: [x, y], far, steps };
  }
  const end = best?.tile ?? from;
  return { path: findPath(g, from, [end], occupied) ?? [], end, arrived: false };
}

export interface Approach extends Walk {
  /** the way to face on arrival, toward the person or thing */
  facing: Facing;
}

/**
 * Walking up to a person or a thing: to the nearest free tile beside it,
 * then facing it. Counters work too — a tile beside the counter is enough
 * when `reach` is 2 (talking across a shop counter).
 */
export function approach(g: Grid, from: Tile, target: Tile, occupied?: ReadonlySet<string>, reach = 1): Approach {
  const goals: Tile[] = [];
  for (let r = 1; r <= reach; r++) for (const f of ORDER) goals.push([target[0] + STEP[f][0] * r, target[1] + STEP[f][1] * r]);
  const already = goals.find(([x, y]) => x === from[0] && y === from[1]);
  if (already) return { path: [], end: from, arrived: true, facing: facingToward(from, target) };
  const path = findPath(g, from, goals, occupied);
  if (path) {
    const end = path.length ? path[path.length - 1] : from;
    return { path, end, arrived: true, facing: facingToward(end, target) };
  }
  const w = walkTo(g, from, target, occupied);
  return { ...w, arrived: false, facing: facingToward(w.end, target) };
}
