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
 *
 * The writer knows its words better than any dictionary does, and says so in
 * the pinyin, which it writes a word at a time: `wǒ de péngyou zài shíjiē`.
 * `writerWords` reads those groups back onto the characters, and the ones no
 * dictionary has — names, 广州, and the passage's own coinages, 食街 — join
 * the passage's vocabulary for that sentence.
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

/* ---------------------------------------------------------- the writer's */

/** Toneless, lower case, ü as v — so a reading and a spelling compare letter for letter. */
const bare = (py: string) =>
  py
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ü|u:/g, 'v');

/** One whole pinyin syllable, toneless: an initial, if any, and a final. */
const SYLLABLE =
  /^(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|iao|ian|uai|uan|van|ang|eng|ing|ong|ai|ei|ao|ou|an|en|in|un|vn|ia|ie|iu|ua|uo|ui|ve|er|a|o|e|i|u|v)$/;

/**
 * What a character may be read as, at this point of a pinyin word. A
 * character the library does not have — 圳 of 深圳 — may be any one
 * syllable: a name should not stop the rest of the sentence being read.
 */
function readingsOf(ch: string, lib: Library, word: string, at: number): string[] {
  const entry = lib.byChar.get(ch);
  if (!entry) {
    const out: string[] = [];
    for (let n = 1; n <= 6 && at + n <= word.length; n++) {
      const piece = word.slice(at, at + n);
      if (SYLLABLE.test(piece)) out.push(piece);
    }
    return out;
  }
  const own = entry.py.map(bare);
  // 儿 folded into the syllable before it: nàr is 那儿.
  return ch === '儿' ? [...own, 'r'] : own;
}

/** Whether `word` is the readings of `chars`, one after another, exactly. */
function spells(word: string, chars: string[], lib: Library): boolean {
  const go = (at: number, i: number): boolean => {
    if (i === chars.length) return at === word.length;
    return readingsOf(chars[i]!, lib, word, at).some(
      (r) => r && word.startsWith(r, at) && go(at + r.length, i + 1),
    );
  };
  return go(0, 0);
}

/**
 * The words of more than one character the writer grouped in a sentence's
 * pinyin, as they sit in the characters: `péngyou` over 朋友 gives 朋友.
 *
 * Read left to right, each pinyin word taking the fewest characters whose
 * readings spell it. Where one cannot be placed — a number written out, a
 * reading no dictionary lists — the rest of the sentence is left to the
 * dictionary rather than guessed at.
 */
export function writerWords(zh: string, py: string, lib: Library): string[] {
  const chars = [...zh].filter(isHanzi);
  const words = (py.match(/[\p{L}\u0300-\u036f]+/gu) ?? []).map(bare);
  const out: string[] = [];
  let j = 0;
  for (const w of words) {
    let placed = 0;
    for (let k = 1; k <= MAX_WORD && j + k <= chars.length; k++) {
      if (spells(w, chars.slice(j, j + k), lib)) {
        placed = k;
        break;
      }
    }
    if (!placed) break;
    if (placed > 1) out.push(chars.slice(j, j + placed).join(''));
    j += placed;
  }
  return out;
}

/**
 * The writer's groups worth cutting by: the dictionary's own words, and those
 * with a character that is not an everyday word by itself — 广州, 食街,
 * 深圳. A group made only of everyday words (HSK 1–3) is left to the
 * dictionary: pinyin often runs 很多 or 玩了 together, and neither is one
 * word to learn.
 */
export function writerHints(zh: string, py: string, lib: Library): string[] {
  const d = dictionaryOf(lib);
  const everyday = (ch: string) => (lib.byWord.get(ch)?.hsk ?? 99) <= 3;
  return writerWords(zh, py, lib).filter(
    (w) => d.bands.has(w) || d.listed.has(w) || [...w].some((ch) => !everyday(ch)),
  );
}
