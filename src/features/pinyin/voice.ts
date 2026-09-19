import { useSyncExternalStore } from 'react';
import type { VoiceRange } from '../../domain/pinyin/contour';

/**
 * What the pronunciation section remembers: the learner's voice range, and
 * how each tone and tone pair has been going.
 *
 * Kept on the device for now rather than in the synced workspace. A voice
 * range belongs to a microphone as much as to a person — the iPad's and the
 * laptop's hear the same voice differently — and the tallies are a first cut
 * that will move into the account once their shape has settled.
 */

export interface Tally {
  tries: number;
  right: number;
  /** the last few results, newest last, 1 = right */
  recent: number[];
}

interface Saved {
  range: VoiceRange | null;
  /** keyed "pair:3-3" or "tone:2" */
  tallies: Record<string, Tally>;
}

const KEY = 'hanzi.pinyin.v1';
const RECENT = 10;

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      return { range: v.range ?? null, tallies: v.tallies ?? {} };
    }
  } catch {
    void 0;
  }
  return { range: null, tallies: {} };
}

let state = read();
const listeners = new Set<() => void>();

function write(next: Saved) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing, or storage full: it works for this sitting anyway.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const usePinyinMemory = () => useSyncExternalStore(subscribe, () => state);

export const voiceRange = () => state.range;

export const saveRange = (range: VoiceRange | null) => write({ ...state, range });

export function record(key: string, right: boolean) {
  const t = state.tallies[key] ?? { tries: 0, right: 0, recent: [] };
  const next: Tally = {
    tries: t.tries + 1,
    right: t.right + (right ? 1 : 0),
    recent: [...t.recent, right ? 1 : 0].slice(-RECENT),
  };
  write({ ...state, tallies: { ...state.tallies, [key]: next } });
}

/** Share right over the recent attempts, or null when there are too few to say. */
export function recentScore(t: Tally | undefined): number | null {
  if (!t || t.recent.length < 3) return null;
  return t.recent.reduce((a, b) => a + b, 0) / t.recent.length;
}

export const pairKey = (id: string) => `pair:${id}`;
export const toneKey = (tone: number) => `tone:${tone}`;
/** telling a lesson's pairs apart by ear */
export const hearKey = (lesson: string) => `hear:${lesson}`;
/** saying a lesson's words so recognition hears them as meant */
export const sayKey = (lesson: string) => `say:${lesson}`;
