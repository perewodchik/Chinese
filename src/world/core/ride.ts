/**
 * A ride on the subway, stop by stop (prompt F4, concept §5): on the
 * platform you choose a train (line and direction, as the signs say it —
 * 往天桥方向), the train calls each next stop (「下一站：王府井。可以换乘1号线。」),
 * and you get off where you like. Getting off at the wrong stop costs
 * nothing: you take a train back. The fare is paid from the 交通卡 when you
 * leave through a station's gates, by the stops ridden since you came in.
 */

import { announcement, line, LINES, linesAt, station, subwayFare, type Mode } from './travel';

export type Dir = 1 | -1;

export interface Train {
  line: string;
  dir: Dir;
  /** 8号线 */
  name: string;
  /** 往天桥方向, or 外环 / 内环 on the loop */
  towards: string;
}

/** What leaves from a stop: every line of that kind (subway, bus, train), both ways (one way at an end of the line). */
export function trainsAt(at: string, mode: Mode = 'subway'): Train[] {
  const out: Train[] = [];
  for (const l of linesAt(at)) {
    if (l.mode !== mode) continue;
    const i = l.stops.indexOf(at);
    for (const dir of [1, -1] as const) {
      if (!l.loop && (dir === 1 ? i === l.stops.length - 1 : i === 0)) continue;
      const towards = l.loop && l.loopNames ? l.loopNames[dir === 1 ? 0 : 1] : `往${station(dir === 1 ? l.stops.at(-1)! : l.stops[0]!).zh}方向`;
      out.push({ line: l.id, dir, name: l.zh, towards });
    }
  }
  return out;
}

/** The next stop of a train from `at`, or null at the end of the line. */
export function nextStop(lineId: string, at: string, dir: Dir): string | null {
  const l = line(lineId);
  const i = l.stops.indexOf(at);
  if (i < 0) return null;
  const j = i + dir;
  if (l.loop) return l.stops[(j + l.stops.length) % l.stops.length]!;
  return j >= 0 && j < l.stops.length ? l.stops[j]! : null;
}

/** Whether `at` is the last stop the train goes to that way. */
export const isTerminus = (lineId: string, at: string, dir: Dir) => nextStop(lineId, at, dir) === null;

/** What the train says as it leaves `at` for its next stop (null at the end of the line). */
export function callNext(lineId: string, at: string, dir: Dir): string | null {
  const next = nextStop(lineId, at, dir);
  if (!next) return null;
  return announcement(lineId, next, isTerminus(lineId, next, dir));
}

export interface RideState {
  /** where the train is (or the platform you stand on) */
  at: string;
  /** the station you came in at, for the ride's key */
  from: string;
  /** stops ridden since the gates, for the fare */
  stops: number;
  train: Train | null;
}

export const startRide = (at: string): RideState => ({ at, from: at, stops: 0, train: null });

export const board = (r: RideState, t: Train): RideState => ({ ...r, train: t });

/** The train runs on to its next stop; at the end of the line it stays and everyone gets off. */
export function runOn(r: RideState): RideState {
  if (!r.train) return r;
  const next = nextStop(r.train.line, r.at, r.train.dir);
  return next ? { ...r, at: next, stops: r.stops + 1 } : { ...r, train: null };
}

/** Off the train, onto the platform: a new train may be chosen (a change is free). */
export const getOff = (r: RideState): RideState => ({ ...r, train: null });

/** What getting out costs from the card: the subway by distance, a bus 2 元; the train's ticket is bought at the window; nothing when you never rode. */
export function fareOut(r: RideState, mode: Mode = 'subway'): number {
  if (r.stops === 0 || mode === 'train') return 0;
  return mode === 'bus' ? 2 : subwayFare(r.stops);
}

/** The map you get out onto at a stop: `station-<id>` for the subway, `stop-<id>` for buses and trains. */
export const stopMap = (id: string, mode: Mode = 'subway') => `${mode === 'subway' ? 'station' : 'stop'}-${id}`;

/** What the train says as it stops: 「王府井到了。」 */
export const arrivalCall = (at: string) => `${station(at).zh}到了。`;

/** Every call a train can make, for rendering the announcer's voice ahead of time. */
export function allCalls(): string[] {
  const out = new Set<string>();
  for (const l of LINES) {
    for (const at of l.stops) {
      out.add(arrivalCall(at));
      for (const dir of [1, -1] as const) {
        const c = callNext(l.id, at, dir);
        if (c) out.add(c);
      }
    }
  }
  return [...out];
}

/** A station's name as its signs show it: 南锣鼓巷站. */
export const stationSign = (id: string) => `${station(id).zh}站`;

// ---------------------------------------------------------------------------
// §13 N1 — the rest of what a Beijing train says (facts.md `metro-announcements`)
// ---------------------------------------------------------------------------

/** The English after the Chinese call, as Beijing's trains say it: "Next station: Wangfujing. You can transfer to Line 1." */
export function callEn(lineId: string, at: string, dir: Dir): string | null {
  const next = nextStop(lineId, at, dir);
  if (!next) return null;
  const l = line(lineId);
  const st = station(next).en;
  if (l.mode === 'bus') return `Next stop: ${st}.`;
  const last = isTerminus(lineId, next, dir) ? ' This is the terminal station.' : '';
  const changes = linesAt(next).filter((x) => x.mode === 'subway' && x.id !== lineId).map((x) => x.en);
  return `Next station: ${st}.${last}${changes.length ? ` You can transfer to ${changes.join(', ')}.` : ''}`;
}

/** Said as the train pulls out of the first station: hold on. */
export const HOLD_ON = { zh: '请站稳扶好。', en: 'Please hold on tight.' };

/**
 * Said as the train stops (after 「王府井到了。」): where to change, and which
 * doors open. Which side is the game's own (it alternates down a line), not
 * each real station's.
 */
export function stopCalls(lineId: string, at: string): Array<{ zh: string; en: string }> {
  const l = line(lineId);
  if (l.mode !== 'subway') return [];
  const out: Array<{ zh: string; en: string }> = [];
  for (const x of linesAt(at).filter((y) => y.mode === 'subway' && y.id !== lineId)) out.push({ zh: `换乘${x.zh}的乘客，请在本站下车。`, en: `Passengers for ${x.en}, please get off here.` });
  const left = l.stops.indexOf(at) % 2 === 0;
  out.push(left ? { zh: '开左侧门。', en: 'Doors open on the left.' } : { zh: '开右侧门。', en: 'Doors open on the right.' });
  return out;
}
