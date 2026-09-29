/**
 * A ride drawn on the metro diagram (§10 J3b): the part of a line between
 * the stops of one leg, through the same bend points the whole line is
 * drawn with (core/metro.ts), so the thick route lies exactly on the line.
 */

import { AT, ROUTES, type Pt } from '../core/metro';

const pt = (s: string | Pt): Pt => (typeof s === 'string' ? [AT[s]![0], AT[s]![1]] : s);

/** The route entries from one stop to the next along a line (both ends in). */
function between(route: ReadonlyArray<string | Pt>, a: string, b: string): Array<string | Pt> {
  let best: [number, number] | null = null;
  route.forEach((x, i) => {
    if (x !== a) return;
    route.forEach((y, j) => {
      if (y !== b) return;
      if (!best || Math.abs(i - j) < Math.abs(best[0] - best[1])) best = [i, j];
    });
  });
  if (!best) return [a, b];
  const [i, j] = best as [number, number];
  const part = route.slice(Math.min(i, j), Math.max(i, j) + 1);
  return i <= j ? [...part] : [...part].reverse();
}

/** The points of a leg on a line through its stops, with the diagram's 45° bends put in. */
export function routePoints(line: string, stops: readonly string[]): Pt[] {
  const route = ROUTES[line];
  const raw: Array<string | Pt> = [];
  for (let i = 1; i < stops.length; i++) {
    const seg = route ? between(route, stops[i - 1]!, stops[i]!) : [stops[i - 1]!, stops[i]!];
    raw.push(...(raw.length ? seg.slice(1) : seg));
  }
  const out: Pt[] = [];
  for (const s of raw) {
    if (typeof s === 'string' && !AT[s]) continue;
    const p = pt(s);
    const q = out[out.length - 1];
    if (q) {
      const dx = p[0] - q[0];
      const dy = p[1] - q[1];
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax > 1e-9 && ay > 1e-9 && Math.abs(ax - ay) > 1e-9) {
        const d = Math.min(ax, ay);
        out.push([q[0] + Math.sign(dx) * d, q[1] + Math.sign(dy) * d]);
      }
    }
    out.push(p);
  }
  return out;
}

/** The box around some points, in grid units. */
export function boxOf(points: readonly Pt[]): { x: number; y: number; w: number; h: number } | null {
  if (!points.length) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
