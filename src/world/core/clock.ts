/**
 * The game clock: one real minute is one game hour, so a day passes in
 * about 24 minutes — roughly one sitting.
 *
 * Time is kept as game minutes since day 1 00:00 (a float while running;
 * the save rounds it). The clock only runs while the hero walks the world:
 * a conversation, a panel, a 点单 game or a hidden tab each pause it, and it
 * runs again only when every reason has been lifted.
 */

import type { PartOfDay } from './types';

export const MINUTES_PER_DAY = 24 * 60;
/** game minutes per real millisecond: 60 game minutes per 60 000 ms */
export const GAME_MINUTES_PER_MS = 60 / 60_000;
/** a new game starts on day 1 at 7:00, at home */
export const START_MINUTES = 7 * 60;
export const WAKE_HOUR = 7;

export const dayOf = (minutes: number) => Math.floor(minutes / MINUTES_PER_DAY) + 1;
const inDay = (minutes: number) => ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
export const hourOf = (minutes: number) => Math.floor(inDay(minutes) / 60);
export const minuteOf = (minutes: number) => inDay(minutes) % 60;

/** morning 6–11, day 11–17, evening 17–21, night 21–6 */
export function partOfDay(minutes: number): PartOfDay {
  const h = hourOf(minutes);
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** `7:05`, `21:40` — the clock in the top bar. */
export const formatTime = (minutes: number) => `${hourOf(minutes)}:${String(minuteOf(minutes)).padStart(2, '0')}`;

/** Whether an hour range `[from, to)` holds at this time; `[21, 6]` wraps midnight. */
export function inHours(minutes: number, [from, to]: readonly [number, number]): boolean {
  const h = hourOf(minutes);
  if (from === to) return true;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

/** Sleeping skips to the next 7:00 — the same night's morning, or tomorrow's. */
export function sleep(minutes: number): number {
  const day = Math.floor(minutes / MINUTES_PER_DAY);
  const today = day * MINUTES_PER_DAY + WAKE_HOUR * 60;
  return minutes < today ? today : today + MINUTES_PER_DAY;
}

export interface ClockState {
  minutes: number;
  /** why it is stopped: 'dialogue', 'panel', 'game', 'hidden' … */
  pauses: readonly string[];
}

export const clockAt = (minutes: number): ClockState => ({ minutes, pauses: [] });

export const isRunning = (c: ClockState) => c.pauses.length === 0;

/** Moves the clock on by `realMs` of real time, unless something holds it. */
export function advance(c: ClockState, realMs: number): ClockState {
  if (!isRunning(c) || realMs <= 0) return c;
  return { ...c, minutes: c.minutes + realMs * GAME_MINUTES_PER_MS };
}

export function pause(c: ClockState, reason: string): ClockState {
  return c.pauses.includes(reason) ? c : { ...c, pauses: [...c.pauses, reason] };
}

export function resume(c: ClockState, reason: string): ClockState {
  return c.pauses.includes(reason) ? { ...c, pauses: c.pauses.filter((r) => r !== reason) } : c;
}
