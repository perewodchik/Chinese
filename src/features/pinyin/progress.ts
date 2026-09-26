import { logSpoken } from '../../store/commands';
import { useSyncExternalStore } from 'react';

/**
 * Whether you are being understood, over time.
 *
 * The pitch chart answers "did it look like the recording?", which is not
 * the question — a native speaker's sentence does not look like the textbook
 * either. The question is whether a listener takes away the words you meant,
 * and the nearest thing to a listener the app has is speech recognition,
 * which learned Mandarin from native speakers and hears a sentence the way a
 * person does: whole, with context.
 *
 * So every whole sentence said — shadowed, or said from a situation in your
 * own words — is kept here as understood or not, and the Speaking page shows
 * the share per week. Only the first try at a sentence each day counts
 * towards it: the fifth try at the same sentence, straight after hearing it,
 * says how well you copy, not how well you speak.
 *
 * Kept on the device, like the other pronunciation tallies (voice.ts).
 */

export type SaidMode = 'shadow' | 'context' | 'video';

export interface Said {
  /** the sentence, by its id in the pack */
  id: string;
  mode: SaidMode;
  ok: boolean;
  /** share of its syllables heard as meant, sounds and tones */
  share: number;
  /** the first try at this sentence, in this mode, that day */
  first: boolean;
  at: number;
}

const KEY = 'hanzi.understood.v1';
const KEEP = 2000;

function read(): Said[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Said[]) : [];
  } catch {
    return [];
  }
}

let log = read();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useSaidLog = () => useSyncExternalStore(subscribe, () => log);

const day = (t: number) => new Date(t).toDateString();

export function recordSaid(entry: Omit<Said, 'first' | 'at'>, now = Date.now()) {
  const first = !log.some((s) => s.id === entry.id && s.mode === entry.mode && day(s.at) === day(now));
  log = [...log, { ...entry, first, at: now }].slice(-KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Private browsing, or storage full: it counts for this sitting anyway.
  }
  for (const l of listeners) l();
  logSpoken();
}

export interface Week {
  /** Monday 00:00 of the week, local time */
  start: number;
  tries: number;
  understood: number;
}

const monday = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

/** First tries per week, newest first, for the weeks that have any. */
export function weeks(entries: readonly Said[], mode?: SaidMode): Week[] {
  const by = new Map<number, Week>();
  for (const s of entries) {
    if (!s.first || (mode && s.mode !== mode)) continue;
    const start = monday(s.at);
    const w = by.get(start) ?? { start, tries: 0, understood: 0 };
    w.tries++;
    if (s.ok) w.understood++;
    by.set(start, w);
  }
  return [...by.values()].sort((a, b) => b.start - a.start);
}

/** A week's share as a whole percentage, or null with too few tries to mean anything. */
export const share = (w: Week | undefined) => (w && w.tries >= 3 ? Math.round((100 * w.understood) / w.tries) : null);
