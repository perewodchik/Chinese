import { useSyncExternalStore } from 'react';

/**
 * Which recorded voice the learner would rather hear, when the pack has more
 * than one for a text.
 *
 * It lives beside the player (voiceOut.ts) rather than in the Speaking
 * section, because every speaker button in the app plays through that player
 * and should honour the same choice. Kept on the device, as it always was:
 * it is a taste, not progress.
 *
 * It used to be stored inside the pronunciation section's own record
 * (`hanzi.pinyin.v1`); a choice made there is read once and carried over.
 */

const KEY = 'hanzi.voice.v1';
const LEGACY = 'hanzi.pinyin.v1';

function read(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return (JSON.parse(raw) as string | null) ?? null;
    const legacy = localStorage.getItem(LEGACY);
    if (legacy) return (JSON.parse(legacy) as { voice?: string | null }).voice ?? null;
  } catch {
    void 0;
  }
  return null;
}

let voice: string | null = typeof localStorage === 'undefined' ? null : read();
const listeners = new Set<() => void>();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The chosen voice by id, or null for whichever the pack has. */
export const preferredVoice = () => voice;

export const usePreferredVoice = () => useSyncExternalStore(subscribe, preferredVoice);

export function saveVoice(next: string | null) {
  voice = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing, or storage full: it holds for this sitting anyway.
  }
  for (const l of listeners) l();
}
