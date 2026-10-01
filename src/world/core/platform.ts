/**
 * MT (the learner, 2026-10-01): a subway platform as a place — an island
 * platform with a track on each side, one direction per side — and what the
 * train's screens show on the way. No timetable: a train is pulling in as you
 * step up to its side (the learner: "keep platforms but don't make me wait").
 * Pure; the ride itself is `ride.ts`.
 */

import { nextStop, trainsAt, type Dir, type Train } from './ride';
import { line, linesAt } from './travel';

export type Side = 'top' | 'bottom';

/** The side of the platform a direction stops at: trains to the line's start on top, to its end below. */
export const sideOf = (dir: Dir): Side => (dir === -1 ? 'top' : 'bottom');

/** The subway lines with a platform at a station, in the order the station's signs list them. */
export const platformLines = (at: string): string[] => linesAt(at).filter((l) => l.mode === 'subway').map((l) => l.id);

/** The train on each side of one line's platform (null on the side that goes nowhere: an end of the line). */
export function platformTrains(at: string, lineId: string): Record<Side, Train | null> {
  const out: Record<Side, Train | null> = { top: null, bottom: null };
  for (const t of trainsAt(at, 'subway')) if (t.line === lineId) out[sideOf(t.dir)] = t;
  return out;
}

/** The next `n` stops a train calls at from `from` (fewer at the end of the line; a loop stops before coming round). */
export function stopsAhead(lineId: string, from: string, dir: Dir, n: number): string[] {
  const out: string[] = [];
  for (let at = from; out.length < n; ) {
    const next = nextStop(lineId, at, dir);
    if (!next || next === from) break;
    out.push(next);
    at = next;
  }
  return out;
}

/** The stops a train has called at before `at` (nearest first), at most `n`. */
export function stopsBehind(lineId: string, at: string, dir: Dir, n: number): string[] {
  return stopsAhead(lineId, at, dir === 1 ? -1 : 1, n);
}

/**
 * The line map over the train's doors (动态地图): a window of the line in the direction of travel —
 * up to `before` stops already called at, the stop the train is at (or has just left), and up to
 * `after` ahead. `at` is the train's position: the station it stands at, or the one it has left.
 */
export function doorMap(lineId: string, at: string, dir: Dir, before = 3, after = 5): { stops: string[]; here: number } {
  const back = stopsBehind(lineId, at, dir, before).reverse();
  return { stops: [...back, at, ...stopsAhead(lineId, at, dir, after)], here: back.length };
}

/** Which doors open at a stop — the game's own pattern (it alternates down a line), as `stopCalls` says it. */
export const doorsOpen = (lineId: string, at: string): 'left' | 'right' => (line(lineId).stops.indexOf(at) % 2 === 0 ? 'left' : 'right');
