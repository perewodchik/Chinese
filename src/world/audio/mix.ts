/**
 * What the street sounds like where you are (prompt G1): a pure answer from
 * the map's life and the part of the day, so the synth only plays it.
 * Pigeon whistles (鸽哨) over the lanes by day, bicycle bells where bikes go,
 * a murmur of people as busy as the map, the chime in stations.
 */

import type { MapLife } from '../core/maptext';
import type { PartOfDay } from '../core/types';

export interface Mix {
  /** 0–1, the murmur of people */
  crowd: number;
  /** seconds between pigeon whistles overhead, 0 for none */
  pigeonsEvery: number;
  /** seconds between bicycle bells, 0 for none */
  bellsEvery: number;
  /** a station: the chime when you arrive, and in the train */
  station: boolean;
}

export const SILENT: Mix = { crowd: 0, pigeonsEvery: 0, bellsEvery: 0, station: false };

export function mixFor(mapId: string, life: MapLife, time: PartOfDay): Mix {
  const station = mapId.startsWith('station-');
  const night = time === 'night';
  const indoors = !station && life.crowd === 0 && life.pigeons === 0 && life.bikes === 0;
  if (indoors) return { ...SILENT, crowd: 0.08 };
  const people = Math.min(1, life.crowd / 10);
  return {
    crowd: station ? 0.35 : Math.max(0.05, people * (night ? 0.35 : time === 'evening' ? 0.9 : 0.7)),
    // the flocks fly by day; more pigeons, more often
    pigeonsEvery: !station && life.pigeons > 0 && !night && time !== 'evening' ? Math.max(18, 60 - life.pigeons * 5) : 0,
    bellsEvery: !station && life.bikes > 0 && !night ? Math.max(12, 40 - life.bikes * 8) : 0,
    station,
  };
}

/** Seconds until the next such sound: around `every`, never the same twice (±40 %). */
export const nextIn = (every: number, rand: () => number) => every * (0.6 + rand() * 0.8);

/**
 * The 鼓楼's drum shows (§13 V3, facts.md `gulou-drum-times`): the drummers
 * play for visitors several times a day — about 9:30, 10:30, 11:30, 13:30,
 * 14:30, 15:30 and a last show near 16:30 (the times shift by season).
 */
export const DRUM_SHOWS: readonly number[] = [9 * 60 + 30, 10 * 60 + 30, 11 * 60 + 30, 13 * 60 + 30, 14 * 60 + 30, 15 * 60 + 30, 16 * 60 + 30];

/** Whether the drums start at this game minute. */
export const isDrumShow = (minute: number) => DRUM_SHOWS.includes(((minute % 1440) + 1440) % 1440);
