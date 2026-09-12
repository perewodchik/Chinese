import type { StrokeData } from './types';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const NUM = /-?\d+(?:\.\d+)?/g;
const cache = new WeakMap<StrokeData, Bounds>();

/**
 * The box a set of outlines occupies, in the y-down 1024-unit square that both
 * the page and the screen draw into. hanzi-writer stores y pointing up with the
 * baseline at 900, so y is flipped here exactly as the drawing code flips it.
 *
 * Every number in a path is a vertex or a control point, and a curve never
 * leaves the hull of its points, so their extent is a box the outline fits
 * inside — a hair generous on a curve, which is the side to err on.
 */
export function strokeBounds(d: StrokeData): Bounds {
  const hit = cache.get(d);
  if (hit) return hit;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const path of d.s) {
    let i = 0;
    for (const m of path.matchAll(NUM)) {
      const v = Number(m[0]);
      if (i++ % 2 === 0) {
        x0 = Math.min(x0, v);
        x1 = Math.max(x1, v);
      } else {
        y0 = Math.min(y0, 900 - v);
        y1 = Math.max(y1, 900 - v);
      }
    }
  }
  const box = Number.isFinite(x0)
    ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    : { x: 0, y: 0, w: 1024, h: 1024 };
  cache.set(d, box);
  return box;
}

/**
 * The least a fitted outline is scaled down to. A form that fills half the
 * square or less — a lone dot, 冖 — keeps a size in proportion to a character
 * instead of being blown up until it is the biggest thing on the card.
 */
export const FIT_FLOOR = 560;
