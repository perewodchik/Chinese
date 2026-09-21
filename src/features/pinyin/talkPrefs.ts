import { DEFAULT_OPTIONS, type TalkLength, type TalkLevel, type TalkOptions, type TalkVoice } from '../../../shared/talk';
import { preferredVoice } from './voice';

/**
 * What the setup page starts from next time.
 *
 * These are defaults for a *new* conversation, not the settings of any
 * conversation in particular: once one is started it carries its own options,
 * kept with its turns, so opening a conversation from last week does not
 * quietly re-level it to whatever the last one used.
 */
export interface TalkPrefs extends TalkOptions {
  /** a local voice by id, or 'system' */
  voice: string | null;
  pinyin: boolean;
  english: boolean;
}

export const SYSTEM = 'system';

const PREFS_KEY = 'hanzi.talk.v1';

export const FALLBACK_PREFS: TalkPrefs = { ...DEFAULT_OPTIONS, voice: null, pinyin: true, english: false };

export function readPrefs(): TalkPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...FALLBACK_PREFS, ...(JSON.parse(raw) as Partial<TalkPrefs>) } : FALLBACK_PREFS;
  } catch {
    return FALLBACK_PREFS;
  }
}

export function writePrefs(p: TalkPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private browsing: remembered for this visit only.
  }
}

export const optionsOf = ({ level, length, explain, words, hints, topic }: TalkPrefs): TalkOptions => ({
  level,
  length,
  explain,
  words,
  hints,
  topic,
});

export const LEVELS: ReadonlyArray<{ id: TalkLevel; label: string }> = [
  { id: 'hsk1', label: 'HSK 1' },
  { id: 'hsk2', label: 'HSK 2' },
  { id: 'hsk3', label: 'HSK 3' },
];

export const LENGTHS: ReadonlyArray<{ id: TalkLength; label: string; title: string }> = [
  { id: 'short', label: 'Short', title: 'One sentence a turn' },
  { id: 'normal', label: 'Normal', title: 'One or two sentences a turn' },
  { id: 'long', label: 'Long', title: 'Three or four short sentences a turn' },
];

/** The voice to use: the one chosen here, then the section's, then Chen, then any. */
export function pickVoice(chosen: string | null, voices: TalkVoice[]): string {
  const ids = voices.map((v) => v.id);
  for (const id of [chosen, preferredVoice(), 'chen']) if (id && (id === SYSTEM || ids.includes(id))) return id;
  return ids[0] ?? SYSTEM;
}
