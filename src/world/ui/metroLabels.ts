import { AT, labelBox, type Box, type Side } from '../core/metro';

/**
 * Which station names the metro map shows at this zoom, and where (the learner, 2026-09-30,
 * iPhone: fully zoomed out the names ran into each other and off the edge). Names are placed
 * in order of importance — where you are, where your task is, neighbourhoods with side
 * quests, the other neighbourhoods, then the small stations — each on its own side of the
 * station if that is free and on screen, else on the first other side that is; a name with
 * no free side waits for a closer zoom. A neighbourhood's "2 new" badge shows only where it
 * has room too. Everything in grid units.
 */

export interface LabelWant {
  station: string;
  /** font size, grid units */
  fs: number;
  /** higher first */
  rank: number;
  /** the "2 new · 1 on" badge over the station: its size, grid units */
  badge?: { w: number; h: number; above: number };
}

export interface Placed {
  box: Box;
  anchor: 'start' | 'middle' | 'end';
  badge?: Box;
}

const SIDES: readonly Side[] = ['e', 'w', 'n', 's', 'ne', 'nw', 'se', 'sw'];

const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, v: Box) => a.x >= v.x && a.y >= v.y && a.x + a.w <= v.x + v.w && a.y + a.h <= v.y + v.h;
/** a name's box with a little air around it, so two names never touch */
const air = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });

/** `blocked`: parts of the view with something over them (the zoom buttons, the key) */
export function placeLabels(wants: readonly LabelWant[], view: Box, blocked: readonly Box[] = []): Map<string, Placed> {
  const out = new Map<string, Placed>();
  const taken: Box[] = [...blocked];
  for (const w of [...wants].sort((a, b) => b.rank - a.rank)) {
    const own = AT[w.station]?.[2];
    if (!own) continue;
    const m = w.fs * 0.18;
    for (const side of [own, ...SIDES.filter((s) => s !== own)]) {
      const b = labelBox(w.station, w.fs, side);
      if (!inside(b, view) || taken.some((t) => hit(air(b, m), t))) continue;
      taken.push(air(b, m));
      const placed: Placed = { box: b, anchor: b.anchor };
      if (w.badge) {
        const [x, y] = AT[w.station]!;
        const bb = { x: x - w.badge.w / 2, y: y - w.badge.above - w.badge.h, w: w.badge.w, h: w.badge.h };
        if (inside(bb, view) && !taken.some((t) => hit(bb, t))) {
          taken.push(air(bb, m));
          placed.badge = bb;
        }
      }
      out.set(w.station, placed);
      break;
    }
  }
  return out;
}
