import { toneOf, withoutTone } from '../drill';

/**
 * One pinyin syllable, taken apart.
 *
 * The rest of the app treats a reading as a string to print. Practising
 * pronunciation needs its parts: the initial (the consonant at the front),
 * the final (everything after it) and the tone — because those are three
 * different muscles, and three different kinds of mistake.
 */
export interface Syllable {
  /** as written, with its tone mark: "qǐng" */
  py: string;
  /** without the mark: "qing" */
  bare: string;
  /** 1–4, or 5 for the neutral tone */
  tone: number;
  /** "q", "zh", or "" for a syllable that starts with its vowel */
  initial: string;
  /** "ing"; ü is written as ü even where pinyin spells it u (qu → üe…) */
  final: string;
}

/** Longest first, so "zh" is found before "z". */
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's'];

/**
 * y and w are spelling, not sounds: "yi" is the final i, "wu" is u, "yu" is
 * ü. Rewriting them makes "yue" and "jue" land on the same final, which is
 * what the ear hears.
 */
function spelledFinal(rest: string): string {
  if (rest.startsWith('yu')) return 'ü' + rest.slice(2);
  if (rest === 'yi' || rest === 'yin' || rest === 'ying') return rest.slice(1);
  if (rest.startsWith('y')) return 'i' + rest.slice(1);
  if (rest === 'wu') return 'u';
  if (rest.startsWith('w')) return 'u' + rest.slice(1);
  return rest;
}

export function parseSyllable(py: string): Syllable {
  const tone = toneOf(py);
  const bare = withoutTone(py).toLowerCase().replace(/v/g, 'ü');
  const initial = INITIALS.find((i) => bare.startsWith(i)) ?? '';
  let final = spelledFinal(bare.slice(initial.length));
  // After j, q and x a written u is always ü: "qu" is qü, "xue" is xüe.
  if ('jqx'.includes(initial) && initial && final.startsWith('u')) final = 'ü' + final.slice(1);
  // Pinyin abbreviates three finals after a consonant: iou → iu, uei → ui, uen → un.
  if (initial) {
    if (final === 'iu') final = 'iou';
    else if (final === 'ui') final = 'uei';
    else if (final === 'un') final = 'uen';
  }
  return { py, bare, tone, initial, final };
}

/** A space-separated reading, as the data spells words: "nǐ hǎo". */
export const syllables = (reading: string): Syllable[] =>
  reading
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseSyllable);

/** A diacritic for a tone number, placed where pinyin puts it. */
const MARKS: Record<string, string[]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/**
 * Writes a toneless syllable with a given tone: ("hao", 2) → "háo".
 *
 * The mark goes on a or e if there is one, on the o of "ou", and otherwise
 * on the last vowel — the rule every textbook states and every learner forgets.
 */
export function withTone(bare: string, tone: number): string {
  if (tone < 1 || tone > 4) return bare;
  const at = (i: number) => {
    const v = bare[i]!;
    return bare.slice(0, i) + MARKS[v]![tone] + bare.slice(i + 1);
  };
  for (const v of ['a', 'e']) {
    const i = bare.indexOf(v);
    if (i >= 0) return at(i);
  }
  const ou = bare.indexOf('ou');
  if (ou >= 0) return at(ou);
  for (let i = bare.length - 1; i >= 0; i--) if (MARKS[bare[i]!]) return at(i);
  return bare;
}
