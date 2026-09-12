import type { Library, Word } from '../data/types';

/**
 * Words, which are what Chinese is actually read in.
 *
 * The app has always been a syllabus of characters, and a character is the
 * right unit to *write*. It is the wrong unit to read: three quarters of
 * running text is two-character words, and knowing 好 and 看 is not knowing
 * 好看 — the meaning of the pair is not the sum, the tone sandhi is not the
 * sum, and the reflex that lets you take 好看 in as one thing is not built by
 * meeting its halves separately.
 *
 * Everything here comes out of data the app already ships: every character
 * entry carries the common words it appears in, which between them come to
 * about 5,800 distinct words with readings, glosses and HSK bands. Nothing
 * new is downloaded; it was simply never indexed the other way round.
 */

export interface WordEntry extends Word {
  /** the characters it is made of, in order */
  chars: string[];
}

const CJK = /[一-鿿]/;

const cache = new WeakMap<Library, Map<string, WordEntry>>();

/** Every distinct word the library knows, indexed by the word itself. */
export function wordIndex(lib: Library): Map<string, WordEntry> {
  let m = cache.get(lib);
  if (m) return m;
  m = new Map();
  for (const c of lib.characters) {
    for (const w of c.words) {
      if (m.has(w.w)) continue;
      m.set(w.w, { ...w, chars: [...w.w].filter((ch) => CJK.test(ch)) });
    }
  }
  cache.set(lib, m);
  return m;
}

/** True when every character of the word is one you already have. */
export const readable = (w: WordEntry, known: ReadonlySet<string>) =>
  w.chars.every((c) => known.has(c));

/**
 * The best word to meet a character inside.
 *
 * "Best" means: it contains the character, everything *else* in it is already
 * known, and of those it is the most elementary. That constraint is what makes
 * the question answerable — a word where two characters are new teaches
 * neither, it just looks like noise.
 */
export function wordFor(
  lib: Library,
  char: string,
  known: ReadonlySet<string>,
  exclude: ReadonlySet<string> = new Set(),
): WordEntry | null {
  const e = lib.byChar.get(char);
  if (!e) return null;
  const index = wordIndex(lib);
  const candidates = e.words
    .map((w) => index.get(w.w))
    .filter((w): w is WordEntry => Boolean(w))
    .filter(
      (w) =>
        w.chars.length > 1 &&
        w.chars.includes(char) &&
        !exclude.has(w.w) &&
        w.chars.every((c) => c === char || known.has(c)),
    );
  if (!candidates.length) return null;
  return candidates.sort(
    (a, b) => (a.hsk ?? 9) - (b.hsk ?? 9) || a.chars.length - b.chars.length,
  )[0];
}

/**
 * Everything you could read today, most elementary first.
 *
 * Handed to the writing prompt alongside the characters, because "these are
 * the characters he knows" and "these are the words he can read" are different
 * briefs, and the second one is the one that stops a passage coming back full
 * of technically-legal compounds nobody would write.
 */
export function readableWords(lib: Library, known: ReadonlySet<string>): WordEntry[] {
  const out: WordEntry[] = [];
  for (const w of wordIndex(lib).values()) {
    if (w.chars.length > 1 && readable(w, known)) out.push(w);
  }
  return out.sort((a, b) => (a.hsk ?? 9) - (b.hsk ?? 9) || a.w.length - b.w.length);
}

/**
 * How many words one more character would unlock.
 *
 * The cheapest possible measure of what a character is worth to you, and a
 * surprisingly different ordering from raw frequency: a middling character
 * that completes nine words you already half-know beats a common one that
 * completes none.
 */
export function unlockCount(
  lib: Library,
  char: string,
  known: ReadonlySet<string>,
): number {
  const e = lib.byChar.get(char);
  if (!e) return 0;
  const index = wordIndex(lib);
  let n = 0;
  for (const w of e.words) {
    const entry = index.get(w.w);
    if (!entry || entry.chars.length < 2) continue;
    if (entry.chars.every((c) => c === char || known.has(c))) n++;
  }
  return n;
}
