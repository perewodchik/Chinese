/**
 * Looking a character or a word up from what was typed: the character itself,
 * its pinyin without tones, or an English word.
 *
 * The answer is how good the match is, so the best comes first: someone who
 * types "hao" wants 好, not every character read shao, zhao or chao, and
 * someone who types "good" wants 好 before "goods". Pinyin is matched by the
 * syllable, never from the middle of one; English by the word.
 *
 *   0  it is exactly this: the character, a whole reading, a whole sense
 *   1  it starts like this: the word begins with it, a reading begins with it,
 *      one of the meaning's words is it
 *   2  it is in there: inside the Chinese, a later syllable of a word, the
 *      start of one of the meaning's words
 */

export type LookupRank = 0 | 1 | 2;

export interface LookupEntry {
  zh: string;
  /** each reading, with its tone marks; a word's syllables separated by spaces */
  py: string[];
  def: string;
}

const HAN = /\p{Script=Han}/u;

/** Typed on a phone: no tone marks, lower case. */
export const flat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const best = (a: LookupRank | null, b: LookupRank | null): LookupRank | null => (a === null ? b : b === null ? a : a < b ? a : b);

function byChinese(needle: string, zh: string): LookupRank | null {
  if (zh === needle) return 0;
  if (zh.startsWith(needle)) return 1;
  // A word typed finds its characters as well as the words it is in.
  if (zh.includes(needle) || ([...zh].length === 1 && needle.includes(zh))) return 2;
  return null;
}

function byPinyin(needle: string, reading: string): LookupRank | null {
  const syllables = flat(reading).split(/[\s'’-]+/).filter(Boolean);
  const typed = needle.replace(/[\s'’-]+/g, '');
  if (!typed || !syllables.length) return null;
  const whole = syllables.join('');
  if (whole === typed) return 0;
  if (whole.startsWith(typed)) return 1;
  // From a later syllable on: "you" finds péngyou, but "hao" never finds shǎo.
  for (let i = 1; i < syllables.length; i++) if (syllables.slice(i).join('').startsWith(typed)) return 2;
  return null;
}

function byMeaning(needle: string, def: string): LookupRank | null {
  const text = flat(def);
  if (!text.includes(needle)) return null;
  // A sense is what stands between the semicolons, without "to" and what is in brackets.
  const senses = text.split(/[;,]/).map((s) => s.replace(/\([^)]*\)/g, ' ').replace(/^\s*to\s+/, '').replace(/\s+/g, ' ').trim());
  if (senses.includes(needle)) return 0;
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  const typed = needle.split(/[^a-z0-9]+/).filter(Boolean);
  if (typed.length > 1) return new RegExp(`(^|[^a-z0-9])${typed.join('[^a-z0-9]+')}`).test(text) ? 1 : null;
  if (words.includes(needle)) return 1;
  if (needle.length >= 2 && words.some((w) => w.startsWith(needle))) return 2;
  return null;
}

/** How well an entry answers what was typed, or null when it does not. */
export function lookupRank(query: string, entry: LookupEntry): LookupRank | null {
  const needle = flat(query.trim());
  if (!needle) return null;
  if (HAN.test(needle)) return byChinese(needle, entry.zh);
  return best(entry.py.reduce<LookupRank | null>((r, py) => best(r, byPinyin(needle, py)), null), byMeaning(needle, entry.def));
}

/** The entries that answer it, the best first; within a rank, in the order they came. */
export function lookup<T>(query: string, entries: readonly T[], of: (e: T) => LookupEntry): Array<{ entry: T; rank: LookupRank }> {
  const out: Array<{ entry: T; rank: LookupRank }> = [];
  for (const entry of entries) {
    const rank = lookupRank(query, of(entry));
    if (rank !== null) out.push({ entry, rank });
  }
  return out.sort((a, b) => a.rank - b.rank);
}
