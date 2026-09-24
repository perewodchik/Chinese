import type { Library } from '../data/types';
import { wordBands, type Token } from './reading';
import { clampBand, isHanzi } from './text';

/**
 * A sentence cut into words, the way a reader takes them in.
 *
 * The cut that was here took the longest word it knew at each point, from
 * the five thousand words the characters' entries mention. Two things were
 * wrong with that. The words were the wrong ones — 不好意思, 一点儿 and 机场
 * were not among them, so they fell apart into characters. And longest-first
 * cannot back out of a bad start: 他在家里 became 在家 | 里, because 在家 was
 * the longer word at 在, when the sentence is 在 | 家里.
 *
 * So the dictionary is the ten thousand syllabus words first, the characters'
 * words after, and the passage's own vocabulary above both; and the cut is
 * the cheapest over the whole run of characters rather than the greediest at
 * each one. Fewer pieces is cheaper — a word is one thing to take in — and
 * among cuts with as many pieces, the one made of syllabus words wins over
 * one that leans on a compound off the lists, or on a lone character that is
 * no word at all.
 */

const MAX_WORD = 4;

interface Dictionary {
  /** every word that may be cut out, with its band; 0 where nobody gives one */
  bands: Map<string, number>;
  /** the ones on the 2026 lists */
  listed: ReadonlySet<string>;
}

const cache = new WeakMap<Library, Dictionary>();

function dictionaryOf(lib: Library): Dictionary {
  let d = cache.get(lib);
  if (d) return d;
  const bands = new Map(wordBands(lib));
  const listed = new Set<string>();
  for (const w of lib.words) {
    listed.add(w.w);
    if ([...w.w].length > 1) bands.set(w.w, w.hsk);
  }
  d = { bands, listed };
  cache.set(lib, d);
  return d;
}

/** Ten to a piece, so no amount of preference outweighs one piece fewer. */
const PIECE = 10;

function costOf(piece: string, d: Dictionary, extra: ReadonlySet<string>): number {
  if (extra.has(piece) || d.listed.has(piece)) return PIECE;
  // A compound only the characters' entries know, or a character no list
  // counts as a word: allowed, but a syllabus reading of the same span wins.
  return PIECE + ([...piece].length > 1 ? 2 : 1);
}

export function segment(
  zh: string,
  lib: Library,
  extra: ReadonlySet<string> = new Set(),
): Token[] {
  const d = dictionaryOf(lib);
  const chars = [...zh];
  const out: Token[] = [];
  const charBand = (c: string) => {
    const e = lib.byChar.get(c);
    return e ? clampBand(e.hsk) : 0;
  };

  let i = 0;
  while (i < chars.length) {
    if (!isHanzi(chars[i]!)) {
      let j = i;
      while (j < chars.length && !isHanzi(chars[j]!)) j++;
      out.push({ text: chars.slice(i, j).join(''), at: i, word: false, band: 0 });
      i = j;
      continue;
    }
    let end = i;
    while (end < chars.length && isHanzi(chars[end]!)) end++;
    for (const piece of cutRun(chars.slice(i, end), d, extra)) {
      const text = piece.join('');
      const listed = piece.length > 1 ? d.bands.get(text) || lib.byWord.get(text)?.hsk : lib.byWord.get(text)?.hsk;
      out.push({ text, at: i, word: true, band: listed || Math.max(...piece.map(charBand)) });
      i += piece.length;
    }
  }
  return out;
}

/** The cheapest cut of one run of hanzi, by dynamic programming from the left. */
function cutRun(run: string[], d: Dictionary, extra: ReadonlySet<string>): string[][] {
  const n = run.length;
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let k = 1; k <= Math.min(MAX_WORD, j); k++) {
      const piece = run.slice(j - k, j).join('');
      if (k > 1 && !d.bands.has(piece) && !extra.has(piece)) continue;
      const cost = best[j - k]! + costOf(piece, d, extra);
      // A tie goes to the longer last piece — reading back from the end, the
      // way backward matching does, which gets 在 | 家里 and 研究 | 生命 right
      // where forward matching gets 在家 | 里 and 研究生 | 命.
      if (cost <= best[j]!) {
        best[j] = cost;
        from[j] = j - k;
      }
    }
  }
  const pieces: string[][] = [];
  for (let j = n; j > 0; j = from[j]!) pieces.push(run.slice(from[j]!, j));
  return pieces.reverse();
}
