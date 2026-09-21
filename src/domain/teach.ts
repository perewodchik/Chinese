import type { Library } from '../data/types';
import { charId, type ItemId } from './ids';
import type { GeneratedText, TextSpec } from './text';

/**
 * The part of the app that behaves like a teacher.
 *
 * It answers two questions, and they are not the two you would guess. It does
 * *not* decide what you should learn next — the passage decides that, because
 * a character chosen to fit a story is worth more than one chosen off a
 * frequency table. What it does is know exactly what you can already read, and
 * be able to say, of anything that comes back, what it was: the reading, the
 * meaning, the parts, and the words it turns up in. That is what turns a
 * character you met in a sentence into a character you can practise.
 */

/* --------------------------------------------------------------- what I know */

/**
 * Every character marked learned, most common first.
 *
 * This used to offer the HSK bands as well, so that on a Tuesday in week two
 * you could borrow a syllabus you had half of rather than wait until you had
 * all of it. It was the wrong kindness: a passage written as though HSK 1 were
 * finished is a passage full of characters that have to be looked up, and the
 * one thing this feature is for is reading without a dictionary. What I know
 * is what I have marked, and nothing else counts.
 *
 * Frequency order, so trimming the list to fifty keeps the fifty that actually
 * turn up in sentences rather than the first fifty taught.
 */
export function basisPool(lib: Library, learned: ReadonlySet<ItemId>): string[] {
  const chars = lib.characters.filter((c) => learned.has(charId(c.c)));
  return [...chars].sort((a, b) => freqOf(a) - freqOf(b)).map((c) => c.c);
}

const freqOf = (c: { freq: number }) => (c.freq > 0 ? c.freq : 99999);

/* ------------------------------------------------------ what came back new */

export interface TeachWord {
  w: string;
  py: string;
  d: string;
}

/**
 * One new character, with everything needed to study it: the reading, the
 * meaning, the parts it is built from, and words that use it and are otherwise
 * made of characters already known — so the first word containing it is a word
 * that can be read.
 */
export interface TeachCard {
  c: string;
  py: string;
  def: string;
  hsk: number;
  freq: number;
  strokes: number;
  parts: string[];
  /** how many of those parts are already known */
  partsKnown: number;
  words: TeachWord[];
  /** true when the library has never heard of it and the writer's gloss is all there is */
  unlisted?: boolean;
}

const otherCharsKnown = (word: string, c: string, known: ReadonlySet<string>) =>
  [...word].every((ch) => ch === c || known.has(ch) || !/[一-鿿]/.test(ch));

/** What the writer said about a character, when it said anything. */
export type Glosses = Record<string, { py: string; d: string }>;

export function cardFor(
  lib: Library,
  c: string,
  known: ReadonlySet<string>,
  glosses: Glosses = {},
): TeachCard | null {
  const e = lib.byChar.get(c);
  if (!e) {
    // Outside the ten thousand the library knows. The passage still taught it,
    // so it is still worth a line — with the writer's own gloss.
    const g = glosses[c];
    return g ? { c, py: g.py, def: g.d, hsk: 0, freq: 99999, strokes: 0, parts: [], partsKnown: 0, words: [], unlisted: true } : null;
  }
  const words = e.words
    .filter((w) => w.w.includes(c) && otherCharsKnown(w.w, c, known))
    .sort((a, b) => (a.hsk ?? 9) - (b.hsk ?? 9) || a.w.length - b.w.length)
    .slice(0, 3)
    .map((w) => ({ w: w.w, py: w.p, d: w.d }));
  return {
    c,
    py: e.py[0] ?? glosses[c]?.py ?? '',
    def: e.def,
    hsk: e.hsk,
    freq: freqOf(e),
    strokes: e.sc ?? 0,
    parts: e.parts,
    partsKnown: e.parts.filter((p) => known.has(p)).length,
    words,
  };
}

export const cardsFor = (
  lib: Library,
  chars: string[],
  known: ReadonlySet<string>,
  glosses: Glosses = {},
) =>
  chars
    .map((c) => cardFor(lib, c, known, glosses))
    .filter((x): x is TeachCard => x !== null);

/* ------------------------------------------------------------ the session */

/** Characters some earlier text already introduced. */
export function taughtAlready(texts: GeneratedText[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts) for (const c of t.teach) out.add(c);
  return out;
}

let specSeq = 0;
export const nextSpecId = () => `t${++specSeq}`;

/** Renumbers a plan's passages so the prompt reads t1, t2, t3 in order. */
export function renumber(specs: TextSpec[]): TextSpec[] {
  return specs.map((s, i) => ({ ...s, id: `t${i + 1}` }));
}

export function emptySpec(partial: Partial<TextSpec> = {}): TextSpec {
  return {
    id: nextSpecId(),
    topic: '',
    length: 'medium',
    level: 'edge',
    genre: 'story',
    newCount: 5,
    questions: true,
    ...partial,
  };
}

/** Every new character a group of finished texts taught, in reading order. */
export function textsChars(texts: GeneratedText[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of texts) {
    for (const c of t.teach) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return out;
}

/** The glosses of a group of texts, merged, for a set's practice sheets. */
export function textsGlosses(texts: GeneratedText[]): Glosses {
  return Object.assign({}, ...texts.map((t) => t.glosses ?? {})) as Glosses;
}
