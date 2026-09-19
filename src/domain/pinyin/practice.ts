import type { Library } from '../../data/types';
import { wordIndex, type WordEntry } from '../vocab';
import { spokenTones, type Spoken } from './sandhi';
import { syllables, type Syllable } from './syllable';

/**
 * What there is to say out loud, drawn from words the app already ships.
 *
 * Tone pairs are the backbone. A tone on its own is easy to hit and rarely
 * heard; the tones that go wrong are the ones next to another tone, where the
 * second has to start from wherever the first left the voice. Twenty pairs —
 * four tones, then any of the four or a neutral — cover every junction two
 * syllables can have, and two-syllable words are three quarters of what is
 * actually said. So the practice is organised around them, and each pair is
 * filled with the most elementary real words that have it.
 */

export interface PracticeWord {
  word: string;
  reading: string;
  gloss: string;
  hsk: number | null;
  syllables: Syllable[];
  spoken: Spoken[];
}

export interface TonePair {
  /** "3-3" */
  id: string;
  first: number;
  second: number;
  words: PracticeWord[];
}

export const PAIR_IDS: string[] = [1, 2, 3, 4].flatMap((a) => [1, 2, 3, 4, 5].map((b) => `${a}-${b}`));

function practiceWord(w: WordEntry): PracticeWord | null {
  const syl = syllables(w.p);
  // Erhua and the odd multi-reading entry do not line up character for
  // syllable; they are not what a pair drill is for.
  if (syl.length !== w.chars.length || syl.some((s) => !s.bare || !s.final)) return null;
  return {
    word: w.w,
    reading: w.p,
    gloss: w.d.split(';')[0]!.trim(),
    hsk: w.hsk,
    syllables: syl,
    spoken: spokenTones(
      syl.map((s) => s.tone),
      w.chars,
    ),
  };
}

const byLevel = (a: PracticeWord, b: PracticeWord) => (a.hsk ?? 99) - (b.hsk ?? 99) || a.word.length - b.word.length;

const cache = new WeakMap<Library, TonePair[]>();

/**
 * The twenty pairs, each with its words, easiest first.
 *
 * Grouped by the tones as *written*, because that is what the learner sees
 * and has to turn into speech: 3-3 is its own pair, and practising it is
 * practising the sandhi.
 */
export function tonePairs(lib: Library, perPair = 12): TonePair[] {
  const hit = cache.get(lib);
  if (hit) return hit;
  const groups = new Map<string, PracticeWord[]>(PAIR_IDS.map((id) => [id, []]));
  for (const w of wordIndex(lib).values()) {
    if (w.chars.length !== 2) continue;
    const p = practiceWord(w);
    // 一起 is written 1-3 and said 4-3: filed under either pair it teaches the
    // wrong junction. 一 and 不 get practised as rules of their own.
    if (!p || p.spoken.some((s) => s.rule === 'yi' || s.rule === 'bu')) continue;
    const id = `${p.syllables[0]!.tone}-${p.syllables[1]!.tone}`;
    groups.get(id)?.push(p);
  }
  const pairs = PAIR_IDS.map((id) => {
    const [first, second] = id.split('-').map(Number) as [number, number];
    return { id, first, second, words: groups.get(id)!.sort(byLevel).slice(0, perPair) };
  });
  cache.set(lib, pairs);
  return pairs;
}

/**
 * Single syllables, for the four tones one at a time: the commonest
 * characters with one reading, sorted into their tones.
 */
export function singleTones(lib: Library, perTone = 12): Record<number, PracticeWord[]> {
  const out: Record<number, PracticeWord[]> = { 1: [], 2: [], 3: [], 4: [] };
  const chars = [...lib.characters].filter((c) => c.py.length === 1).sort((a, b) => a.freq - b.freq);
  for (const c of chars) {
    const syl = syllables(c.py[0]!);
    const tone = syl[0]?.tone ?? 5;
    if (!out[tone] || out[tone]!.length >= perTone) continue;
    out[tone]!.push({
      word: c.c,
      reading: c.py[0]!,
      gloss: c.def.split(/[;,]/)[0]!.trim(),
      hsk: c.hsk,
      syllables: syl,
      spoken: spokenTones([tone], [c.c]),
    });
  }
  return out;
}

/** The calibration phrase: one syllable, four tones, the classic 妈麻马骂. */
export const CALIBRATION: PracticeWord = (() => {
  const reading = 'mā má mǎ mà';
  const syl = syllables(reading);
  return {
    word: '妈麻马骂',
    reading,
    gloss: 'mother, hemp, horse, scold',
    hsk: null,
    syllables: syl,
    spoken: syl.map((s) => ({ char: '', citation: s.tone, surface: s.tone, halfThird: false, approximate: false })),
  };
})();
