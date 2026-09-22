import type { Library } from '../data/types';
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

const SYLLABLE_MARK = /[\p{L}̀-ͯ]+/gu;

/**
 * The sentence's pinyin laid over its characters, one syllable each.
 *
 * The pinyin arrives grouped by word with a space between syllables, so a
 * sentence of twelve hanzi should carry twelve syllables. When it does, this
 * is exact — 了 is le where the writer said le. When it does not (a
 * run-together word, an erhua 儿 folded into the syllable before), the
 * character's commonest reading stands in, which is right far more often
 * than it is wrong and is only ever a reading aid.
 */
export function alignPinyin(line: Pick<TextLine, 'zh' | 'py'>, lib?: Library): string[] {
  const chars = [...line.zh].filter(isHanzi);
  const syllables = (line.py.normalize('NFC').match(SYLLABLE_MARK) ?? []).filter((s) => !/^\d+$/.test(s));
  if (syllables.length === chars.length) return syllables.map((s) => s.toLowerCase());
  return chars.map((c) => lib?.byChar.get(c)?.py[0] ?? '');
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
