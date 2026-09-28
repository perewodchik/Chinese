/**
 * The city's timetable: when places open, and where people are at an hour.
 *
 * From the concept: breakfast shops and the market 6–10, shops 9–21, the
 * bank until 17, dancing on squares 18–21, and after 21 only the snack
 * streets, 簋街 and the convenience stores. A closed door is never a dead
 * end — the quest waits for the next day.
 */

import { inHours } from './clock';
import type { NpcCard, RoutineStop } from './types';

export type PlaceKind =
  | 'breakfast'
  | 'market'
  | 'shop'
  | 'kiosk'
  | 'pharmacy'
  | 'bank'
  | 'post'
  | 'barber'
  | 'teahouse'
  | 'restaurant'
  | 'snack_street'
  | 'guijie'
  | 'convenience'
  | 'museum'
  | 'park'
  | 'subway'
  | 'home'
  | 'toilet';

/** Open hours `[from, to)` — `[0, 0]` is round the clock, `[17, 2]` runs past midnight. */
export const OPENING: Record<PlaceKind, readonly [number, number]> = {
  breakfast: [6, 10],
  market: [6, 10],
  shop: [9, 21],
  kiosk: [7, 21],
  pharmacy: [9, 21],
  bank: [9, 17],
  post: [9, 17],
  barber: [9, 21],
  teahouse: [10, 21],
  restaurant: [11, 21],
  snack_street: [10, 2],
  guijie: [11, 4],
  convenience: [0, 0],
  museum: [9, 17],
  park: [6, 21],
  subway: [5, 23],
  home: [0, 0],
  toilet: [0, 0],
};

export const isOpen = (kind: PlaceKind, minutes: number) => inHours(minutes, OPENING[kind]);

/** `9:00–21:00`, for the sign on a door. */
export function hoursText(kind: PlaceKind): string {
  const [a, b] = OPENING[kind];
  return a === b ? '24小时' : `${a}:00–${b}:00`;
}

/** The hour a place opens next (for "come back at 6"), or null if it is open. */
export function opensAt(kind: PlaceKind, minutes: number): number | null {
  return isOpen(kind, minutes) ? null : OPENING[kind][0];
}

/** City life by the hour, for the engine's crowds and the companion's small talk. */
export const EVENTS = [
  { id: 'taiji', hours: [6, 10] as const, where: 'park' },
  { id: 'dancing', hours: [18, 21] as const, where: 'square' },
  { id: 'lanterns', hours: [18, 6] as const, where: 'street' },
] as const;

export const eventsAt = (minutes: number) => EVENTS.filter((e) => inHours(minutes, e.hours));

/** Where an NPC is at this time: the first routine stop whose hours hold, or null (not about). */
export function whereIs(npc: NpcCard, minutes: number): RoutineStop | null {
  return npc.routine.find((r) => inHours(minutes, r.hours)) ?? null;
}

/** The NPCs on a map at this time. */
export function npcsOnMap(npcs: readonly NpcCard[], map: string, minutes: number): { npc: NpcCard; stop: RoutineStop }[] {
  const out: { npc: NpcCard; stop: RoutineStop }[] = [];
  for (const npc of npcs) {
    const stop = whereIs(npc, minutes);
    if (stop?.map === map) out.push({ npc, stop });
  }
  return out;
}

/** Whether the hour has changed between two clock readings — the engine re-places NPCs then. */
export const hourChanged = (a: number, b: number) => Math.floor(a / 60) !== Math.floor(b / 60);
