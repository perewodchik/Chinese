import { AT, labelBox, linePoints, ROUTES, type Box, type Side } from '../core/metro';

/**
 * Which station names the metro map shows at this zoom, and where (the learner, 2026-09-30,
 * iPhone: fully zoomed out the names ran into each other and off the edge). Names are placed
 * in order of importance — where you are, where your task is, neighbourhoods with side
 * quests, the other neighbourhoods, then the small stations — each on its own side of the
 * station if that is free and on screen, else on the first other side that is; a name with
 * no free side waits for a closer zoom. A neighbourhood's "2 new" badge shows only where it
 * has room too. Everything in grid units.
 *
 * 2026-10-01 (the learner, iPhone again): names also ran over station circles and lines —
 * the gap was fixed in grid units, smaller than a circle on a phone, and lines were not
 * obstacles. Now the gap is the circle's radius plus air, no name covers a circle
 * (`circleBoxes`), and only where you are and your task may cross a line (`lineBoxes`) when no
 * side is clear.
 */

export interface LabelWant {
  station: string;
  /** font size, grid units */
  fs: number;
  /** higher first */
  rank: number;
  /** where you are or your task: if no side is clear it may cross a line (never a circle or a name) */
  key?: boolean;
  /** how far the name sits from the station's centre, grid units (its circle's radius and some air) */
  gap?: number;
  /** the "2 new · 1 on" badge over the station: its size, grid units */
  badge?: { w: number; h: number; above: number };
}

export interface Placed {
  box: Box;
  /** a key name set further out: draw a thin line from the station to it */
  leader?: boolean;
  anchor: 'start' | 'middle' | 'end';
  badge?: Box;
}

const SIDES: readonly Side[] = ['e', 'w', 'n', 's', 'ne', 'nw', 'se', 'sw'];

const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box, v: Box) => a.x >= v.x && a.y >= v.y && a.x + a.w <= v.x + v.w && a.y + a.h <= v.y + v.h;
/** a name's box with a little air around it, so two names never touch */
const air = (b: Box, m: number): Box => ({ x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m });

/** `blocked`: parts of the view with something over them (the zoom buttons, the key) */
/** `soft`: what a key name may cross when nothing else fits (the lines) */
export function placeLabels(wants: readonly LabelWant[], view: Box, blocked: readonly Box[] = [], soft: readonly Box[] = []): Map<string, Placed> {
  const out = new Map<string, Placed>();
  // names keep a little air between each other; against the map (circles, lines, the buttons) the box itself counts
  const taken: Box[] = [];
  const free = (b: Box, m: number, crossSoft = false) =>
    !blocked.some((t) => hit(b, t)) && (crossSoft || !soft.some((t) => hit(b, t))) && !taken.some((t) => hit(air(b, m), t));
  for (const w of [...wants].sort((a, b) => b.rank - a.rank)) {
    const own = AT[w.station]?.[2];
    if (!own) continue;
    const m = w.fs * 0.18;
    const sides = [own, ...SIDES.filter((s) => s !== own)];
    // a key name tries its sides, then crossing lines, then further out (with a leader line)
    const tries: { crossSoft: boolean; far: number }[] = w.key
      ? [{ crossSoft: false, far: 0 }, { crossSoft: true, far: 0 }, ...[0.6, 1.2, 1.8, 2.6].map((f) => ({ crossSoft: true, far: f * w.fs * 2 }))]
      : [{ crossSoft: false, far: 0 }];
    for (const { crossSoft, far } of tries) {
      const gap = (w.gap ?? 0.32) + far;
      const side = sides.find((sd) => {
        const b = labelBox(w.station, w.fs, sd, gap);
        return inside(b, view) && free(b, m, crossSoft);
      });
      if (!side) continue;
      const b = labelBox(w.station, w.fs, side, gap);
      taken.push(air(b, m));
      const placed: Placed = { box: b, anchor: b.anchor, ...(far ? { leader: true } : {}) };
      if (w.badge) {
        const [x, y] = AT[w.station]!;
        const bb = { x: x - w.badge.w / 2, y: y - w.badge.above - w.badge.h, w: w.badge.w, h: w.badge.h };
        if (inside(bb, view) && free(bb, 0)) {
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

/**
 * What a name may not cover on the metro map, as small boxes in grid units (the map turns its
 * screen pixels into grid units at the current zoom). `circleBoxes`: every station's circle of
 * radius `r`; `lineBoxes`: every line, `half` being half its width plus air.
 */
export function circleBoxes(r: (station: string) => number): Box[] {
  return Object.keys(AT).flatMap((st) => {
    const [x, y] = AT[st]!;
    const k = r(st);
    // a circle as a plus of two boxes, so a name may sit close on a diagonal
    return [
      { x: x - k, y: y - k * 0.7, w: 2 * k, h: 1.4 * k },
      { x: x - k * 0.7, y: y - k, w: 1.4 * k, h: 2 * k },
    ];
  });
}

export function lineBoxes(half: number): Box[] {
  const out: Box[] = [];
  const step = Math.max(0.05, Math.min(0.25, half * 1.5));
  for (const id of Object.keys(ROUTES)) {
    const pts = linePoints(id);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let j = 0; j <= n; j++) {
        const x = ax + ((bx - ax) * j) / n;
        const y = ay + ((by - ay) * j) / n;
        out.push({ x: x - half, y: y - half, w: 2 * half, h: 2 * half });
      }
    }
  }
  return out;
}

/**
 * Which names a zoom shows (2026-10-01): fully out only where you are and where your task is;
 * closer, every neighbourhood; closest, every station. `pxPerGrid` is screen pixels per grid unit.
 */
export function zoomLevel(pxPerGrid: number): 0 | 1 | 2 {
  return pxPerGrid >= 34 ? 2 : pxPerGrid >= 14 ? 1 : 0;
}
