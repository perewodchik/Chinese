import type { Library } from '../data/types';
import { withoutTone } from './drill';
import { clampBand, isHanzi, type GeneratedText, type TextLine } from './text';

/**
 * Reading a passage as prose rather than as a list.
 *
 * A passage comes back one sentence per entry because that is what can be
 * checked, paired with a translation and read aloud. It is read as
 * paragraphs, because that is what it was written as. Everything here is the
 * work of turning the first shape into the second without losing what the
 * first was good for: the reading of each character, the words it sits in,
 * and how far each word is from where the reader is.
 */

/* ------------------------------------------------------------ paragraphs */

/**
 * The passage's sentences grouped into paragraphs, by index.
 *
 * The writer marks the first sentence of each paragraph. Passages written
 * before it was asked to have no marks at all: a dialogue is then one turn to
 * a paragraph, and anything else one paragraph — which is what most of them
 * were.
 */
export function paragraphs(text: Pick<GeneratedText, 'lines' | 'genre'>): number[][] {
  const marked = text.lines.some((l, i) => i > 0 && l.p);
  if (!marked) {
    return text.genre === 'dialogue' ? text.lines.map((_, i) => [i]) : [text.lines.map((_, i) => i)];
  }
  const out: number[][] = [];
  text.lines.forEach((l, i) => {
    if (i === 0 || l.p) out.push([i]);
    else out[out.length - 1].push(i);
  });
  return out;
}

/* --------------------------------------------------------------- pinyin */

/** A run of pinyin letters, tone marks included; apostrophes and hyphens split. */
const PINYIN_WORD = /[\p{L}\u0300-\u036f]+/gu;

/** Lower case, NFC, the tone marks gone — the same length as the input, letter for letter. */
const flat = (py: string) => withoutTone(py.normalize('NFC').toLowerCase()).replace(/v/g, 'ü');

/**
 * The sentence's pinyin laid over its characters, one syllable each.
 *
 * The writer is asked for pinyin grouped by word — `huǒchē zhàn zài nàr` —
 * because that is how pinyin is read, so a word has to be cut back into
 * syllables before it can sit over its characters. The cut follows the
 * library's readings of those characters, compared without tones: 火车 is
 * huo + che, so `huǒchē` splits as huǒ | chē. What goes over each character
 * is still the writer's own spelling, so 了 is le where the writer said le,
 * the neutral 来 of 下来 stays toneless, and an erhua 儿 gets the r it was
 * folded into (nà | r).
 *
 * A word that cannot be cut along any reading the library knows is not
 * allowed to drag the rest of the line with it: only the characters it
 * covers fall back to their commonest reading. Without a library to cut by,
 * the writer's syllables are used when there is one per character.
 */
export function alignPinyin(line: Pick<TextLine, 'zh' | 'py'>, lib?: Library): string[] {
  const chars = [...line.zh].filter(isHanzi);
  const words = (line.py.normalize('NFC').match(PINYIN_WORD) ?? []).map((w) => w.toLowerCase());
  if (!lib) return words.length === chars.length ? words : chars.map(() => '');
  return alignWords(chars, words, lib);
}

/** The readings a character may take, toneless. 儿 may also be the r of an erhua. */
function readingsOf(ch: string, lib: Library): string[] {
  const own = (lib.byChar.get(ch)?.py ?? []).map(flat);
  return ch === '儿' ? [...own, 'r'] : own;
}

/**
 * One pinyin word cut into exactly `k` syllables for the characters from `at`,
 * each piece one of its character's readings; null when no cut fits.
 */
function cutWord(word: string, chars: string[], at: number, k: number, lib: Library): string[] | null {
  const bare = flat(word);
  if (bare.length !== word.length) return null;
  const go = (pos: number, i: number): string[] | null => {
    if (i === k) return pos === bare.length ? [] : null;
    for (const r of readingsOf(chars[at + i]!, lib)) {
      if (!r || !bare.startsWith(r, pos)) continue;
      const rest = go(pos + r.length, i + 1);
      if (rest) return [word.slice(pos, pos + r.length), ...rest];
    }
    return null;
  };
  return go(0, 0);
}

/** Longest word worth trying to lay over characters: 4 covers 成语 and most names. */
const MAX_SPAN = 4;

/**
 * The cheapest way to lay every word over the characters.
 *
 * A small alignment over (words used, characters covered): a word that cuts
 * cleanly over the next one to four characters is free; anything else — a
 * word the library cannot cut, a character nobody wrote a syllable for, a
 * stray word — costs, and those characters take the library's reading. So one
 * surprise costs one word's worth of characters, not the whole sentence.
 */
function alignWords(chars: string[], words: string[], lib: Library): string[] {
  const n = chars.length;
  const m = words.length;
  const fallback = (j: number) => lib.byChar.get(chars[j]!)?.py[0] ?? '';
  type Step = { cost: number; prev: [number, number]; out: string[] } | undefined;
  // best[i][j]: the cheapest alignment of the first i words over the first j characters
  const best: Step[][] = Array.from({ length: m + 1 }, () => new Array<Step>(n + 1));
  best[0]![0] = { cost: 0, prev: [0, 0], out: [] };

  const offer = (i: number, j: number, cost: number, prev: [number, number], out: string[]) => {
    const had = best[i]![j];
    if (!had || cost < had.cost) best[i]![j] = { cost, prev, out };
  };

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const here = best[i]![j];
      if (!here) continue;
      // A character with no syllable of its own.
      if (j < n) offer(i, j + 1, here.cost + 3, [i, j], [fallback(j)]);
      if (i === m) continue;
      // A word that belongs to no character (a stray, or a numeral written out).
      offer(i + 1, j, here.cost + 3, [i, j], []);
      for (let k = 1; k <= MAX_SPAN && j + k <= n; k++) {
        const cut = cutWord(words[i]!, chars, j, k, lib);
        if (cut) offer(i + 1, j + k, here.cost, [i, j], cut);
        // One syllable over one character is trusted even when the library
        // does not list that reading; a longer word it cannot cut is not.
        else if (k === 1) offer(i + 1, j + 1, here.cost + 1, [i, j], [words[i]!]);
        else offer(i + 1, j + k, here.cost + 2 * k - 1, [i, j], chars.slice(j, j + k).map((_, x) => fallback(j + x)));
      }
    }
  }

  const out: string[][] = [];
  let at: [number, number] = [m, n];
  while (at[0] || at[1]) {
    const step = best[at[0]]![at[1]]!;
    out.push(step.out);
    at = step.prev;
  }
  return out.reverse().flat();
}

/* ---------------------------------------------------------------- words */

/** Every word the library knows, with the lowest band it appears in. */
export function wordBands(lib: Library): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of lib.characters) {
    for (const w of c.words) {
      if ([...w.w].length < 2) continue;
      const band = w.hsk ? clampBand(w.hsk) : 0;
      const had = out.get(w.w);
      if (had === undefined || (band && (!had || band < had))) out.set(w.w, band);
    }
  }
  return out;
}

export interface Token {
  /** the characters, as written */
  text: string;
  /** index of its first character within the sentence */
  at: number;
  /** a run of hanzi the reader should see as one word */
  word: boolean;
  /**
   * The band it belongs to: the word's own when the library lists it, or
   * the highest of its characters' otherwise. 0 when nobody knows.
   */
  band: number;
}

const MAX_WORD = 4;

/**
 * A sentence cut into words, longest match first.
 *
 * Greedy forward matching is not what a real segmenter does, and on a
 * sentence built for a learner it hardly needs to be: the passages are short,
 * the vocabulary is common, and the words the writer listed are passed in so
 * the passage's own vocabulary always wins. A wrong cut costs an underline in
 * the wrong place, never a wrong character.
 */
export function tokenize(
  zh: string,
  lib: Library,
  bands: ReadonlyMap<string, number>,
  extra: ReadonlySet<string> = new Set(),
): Token[] {
  const chars = [...zh];
  const out: Token[] = [];
  const charBand = (c: string) => {
    const e = lib.byChar.get(c);
    return e ? clampBand(e.hsk) : 0;
  };

  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i])) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j])) j++;
      out.push({ text: chars.slice(i, j).join(''), at: i, word: false, band: 0 });
      i = j;
      continue;
    }
    let taken = 1;
    for (let n = Math.min(MAX_WORD, chars.length - i); n >= 2; n--) {
      const piece = chars.slice(i, i + n);
      if (!piece.every(isHanzi)) continue;
      const w = piece.join('');
      if (extra.has(w) || bands.has(w)) {
        taken = n;
        break;
      }
    }
    const text = chars.slice(i, i + taken).join('');
    const listed = taken > 1 ? bands.get(text) : undefined;
    const band = listed ? listed : Math.max(...[...text].map(charBand));
    out.push({ text, at: i, word: true, band });
    i += taken;
  }
  return out;
}

/**
 * How far above the reader a word is: 0 at or below their band, then 1, 2, 3,
 * and 4 for four or more — which is also where a word no band lists goes.
 * Each step has its own colour, so the eye can tell a stretch from a wall.
 */
export const stepsAbove = (t: Pick<Token, 'word' | 'band'>, target: number): number =>
  !t.word ? 0 : t.band === 0 ? 4 : Math.min(4, Math.max(0, t.band - target));

/* ------------------------------------------------------ the band spread */

/**
 * How many distinct characters of the passage come from each band — the
 * shape of the text, counted here rather than taken from the writer.
 * Band 0 is everything outside the syllabus.
 */
export function bandSpread(text: Pick<GeneratedText, 'lines'>, lib: Library): Map<number, number> {
  const seen = new Set<string>();
  for (const l of text.lines) for (const c of l.zh) if (isHanzi(c)) seen.add(c);
  const out = new Map<number, number>();
  for (const c of seen) {
    const e = lib.byChar.get(c);
    const band = e ? clampBand(e.hsk) : 0;
    out.set(band, (out.get(band) ?? 0) + 1);
  }
  return out;
}
