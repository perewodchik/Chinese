import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseSyllable } from '../../src/domain/pinyin/syllable';

/**
 * A native speaker saying every syllable in every tone.
 *
 * The public-domain set at github.com/davinfifield/mp3-chinese-pinyin-sound
 * (Unlicense): 1,632 recordings, one speaker, one syllable each. Against it
 * the app's tone check agrees with the speaker 98.7% of the time
 * (scripts/voices/evaluate.ts), which makes it the reference for everything
 * that is a single syllable — the four tones one at a time, and every minimal
 * pair in the sound lessons (七 against 吃 is two syllables said alone).
 *
 * It is no use for words: joining two recorded syllables loses the sandhi and
 * the way one tone runs into the next, which is the thing being taught.
 */

export const NATIVE_DIR = '.cache/pinyin-sound/mp3';
export const NATIVE_REPO = 'https://github.com/davinfifield/mp3-chinese-pinyin-sound';

/** The recording of a one-syllable reading ("nǚ" → nuu3.mp3), or null when the set has none. */
export function nativeFile(root: string, reading: string): string | null {
  const parts = reading.trim().split(/\s+/);
  if (parts.length !== 1) return null;
  const s = parseSyllable(parts[0]!);
  if (s.tone < 1 || s.tone > 4) return null;
  // The set spells ü as "uu", and only where pinyin writes the dots (lü, nü);
  // after j, q, x and y it is a plain u, as pinyin spells it.
  const file = join(root, NATIVE_DIR, `${s.bare.replace(/ü/g, 'uu')}${s.tone}.mp3`);
  return existsSync(file) ? file : null;
}
