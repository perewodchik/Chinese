/**
 * A ride on the subway, stop by stop (prompt F4, concept §5): on the
 * platform you choose a train (line and direction, as the signs say it —
 * 往天桥方向), the train calls each next stop (「下一站：王府井。可以换乘1号线。」),
 * and you get off where you like. Getting off at the wrong stop costs
 * nothing: you take a train back. The fare is paid from the 交通卡 when you
 * leave through a station's gates, by the stops ridden since you came in.
 */

import { announcement, line, linesAt, station, subwayFare } from './travel';

export type Dir = 1 | -1;

export interface Train {
  line: string;
  dir: Dir;
  /** 8号线 */
  name: string;
  /** 往天桥方向, or 外环 / 内环 on the loop */
  towards: string;
}

/** The trains that leave from a station: every subway line, both ways (one way at an end of the line). */
export function trainsAt(at: string): Train[] {
  const out: Train[] = [];
  for (const l of linesAt(at)) {
    if (l.mode !== 'subway') continue;
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

/** What leaving through the gates costs: nothing when you never rode. */
export const fareOut = (r: RideState) => (r.stops > 0 ? subwayFare(r.stops) : 0);

/** A station's name as its signs show it: 南锣鼓巷站. */
export const stationSign = (id: string) => `${station(id).zh}站`;
