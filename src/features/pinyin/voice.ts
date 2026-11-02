import { logSpoken } from '../../store/commands';
import { useSyncExternalStore } from 'react';
import type { EvalResult } from '../../../shared/speechEval';
import { attemptId, keepTry, loadHistory } from './speechHistory';

/**
 * What the pronunciation section remembers: how each tone, tone pair and
 * sound has been going, as the pronunciation service scored it.
 *
 * Kept on the device for now rather than in the synced workspace; the
 * tallies are a first cut that will move into the account once their shape
 * has settled. (A voice range was kept here too, while the app measured pitch
 * itself; it no longer does.)
 */

export interface Tally {
  tries: number;
  right: number;
  /** the last few results, newest last, 1 = right */
  recent: number[];
  /** epoch ms of the latest try; absent on tallies kept before it was */
  last?: number;
}

interface Saved {
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
      return { tallies: v.tallies ?? {} };
    }
  } catch {
    void 0;
  }
  return { tallies: {} };
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

/** The account's tallies, fetched once a visit, in place of this device's. */
let synced = false;
function sync() {
  if (synced) return;
  synced = true;
  void loadHistory().then((h) => {
    if (h) write({ ...state, tallies: { ...h.tallies } });
  });
}

export const usePinyinMemory = () => {
  sync();
  return useSyncExternalStore(subscribe, () => state);
};

// The voice to hear moved beside the player, which every speaker button uses.
export { preferredVoice, saveVoice } from '../../platform/audio/voicePreference';

/**
 * A try in a drill: counted here at once, and kept in the account with the
 * word said and the service's answer, so every device counts the same.
 */
export function record(key: string, right: boolean, said?: { text: string; result?: EvalResult }) {
  const t = state.tallies[key] ?? { tries: 0, right: 0, recent: [] };
  const next: Tally = {
    tries: t.tries + 1,
    right: t.right + (right ? 1 : 0),
    recent: [...t.recent, right ? 1 : 0].slice(-RECENT),
    last: Date.now(),
  };
  write({ ...state, tallies: { ...state.tallies, [key]: next } });
  keepTry({ id: attemptId(), at: next.last!, kind: 'drill', text: said?.text ?? '', tally: key, good: right, ...(said?.result ? { result: said.result } : {}) });
  logSpoken();
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
