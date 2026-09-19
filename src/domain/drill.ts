import type { Library } from '../data/types';
import type { Collection } from './collection';
import { charId, idValue, isCharId, type ItemId } from './ids';
import { sortByLibrary } from './library';
import { isDue, isLearned, type RecallBook, type Skill } from './memory';
import { wordFor } from './vocab';

/**
 * What to ask, and in what order.
 *
 * The scheduler in `memory.ts` decides *when* an item is worth asking about.
 * This decides which items are even in the running, mixes the ones falling due
 * with a few that have never been asked, and knows how to build the particular
 * question each drill puts on screen.
 */

/* ------------------------------------------------------------------ tones */

const TONE_MARKS: Array<[string, number]> = [
  ['āēīōūǖ', 1],
  ['áéíóúǘ', 2],
  ['ǎěǐǒǔǚ', 3],
  ['àèìòùǜ', 4],
];

export const TONE_LABEL: Record<number, string> = {
  1: 'flat and high',
  2: 'rising',
  3: 'dipping',
  4: 'falling',
  5: 'light, unstressed',
};

export const TONE_MARK: Record<number, string> = {
  1: 'ˉ',
  2: 'ˊ',
  3: 'ˇ',
  4: 'ˋ',
  5: '·',
};

/**
 * The tone of one syllable, from its diacritic.
 *
 * Tone is the half of a reading that beginners quietly drop, and it is the
 * half that is hardest to repair later, so it is worth being able to ask about
 * on its own rather than only as part of "how is this said".
 */
export function toneOf(py: string): number {
  const flat = py.normalize('NFD');
  for (const [marks, tone] of TONE_MARKS) {
    for (const m of marks.normalize('NFD')) {
      // The two dots of ü are a combining mark too, and they are in every
      // tone's ǖ ǘ ǚ ǜ — counted as a tone, every ü read as a first.
      if (m.charCodeAt(0) > 0x2ff && m !== '̈' && flat.includes(m)) return tone;
    }
  }
  return 5;
}

/** The reading without its tone mark — the question, when the tone is the answer. */
export const withoutTone = (py: string) =>
  py
    .normalize('NFD')
    .replace(/[̀-̏]/g, '')
    .normalize('NFC');

/* ---------------------------------------------------------------- the pool */

/**
 * Everything the app may ask you about.
 *
 * Not the whole syllabus: being asked about 2,700 characters you have never
 * chosen to study is how a review queue becomes something you stop opening.
 * The pool is what you have put in a collection — the app's existing word for
 * "what I am working on" — plus anything that has ever been asked about, so
 * deleting a collection does not quietly drop its characters out of rotation.
 */
export function reviewPool(
  lib: Library,
  collections: Collection[],
  book: RecallBook,
): ItemId[] {
  const ids = new Set<ItemId>();
  for (const c of collections) for (const i of c.items) ids.add(i);
  for (const id in book) ids.add(id);
  // A document written before radicals had a place of their own can still be
  // carrying `r61` ids; they are not characters and there is nothing to ask.
  const chars = [...ids].filter((id) => isCharId(id) && lib.byChar.has(idValue(id)));
  return sortByLibrary(lib, chars);
}

export interface DrillPools {
  /** everything in rotation */
  all: ItemId[];
  /** of those, the ones whose look-alikes the data knows */
  confusable: ItemId[];
  /** of those, the ones found in a word whose other characters are already known */
  inWords: ItemId[];
  /** the characters counted as readable when choosing those words */
  known: ReadonlySet<string>;
}

/**
 * The pools the drills draw from.
 *
 * Reading a character inside a word needs a word whose other characters you
 * already have. Plenty of characters have none yet, and they are not questions
 * — so they are kept out of that pool rather than skipped halfway through a
 * sitting.
 */
export function drillPools(
  lib: Library,
  collections: Collection[],
  book: RecallBook,
  learned: ReadonlySet<ItemId>,
): DrillPools {
  const all = reviewPool(lib, collections, book);
  const known = new Set(all.filter((id) => learned.has(id)).map(idValue));
  return {
    all,
    confusable: confusablePool(lib, all),
    inWords: all.filter((id) => Boolean(wordFor(lib, idValue(id), known))),
    known,
  };
}

/* --------------------------------------------------------------- the queue */

export interface DrillOptions {
  skill: Skill;
  pool: ItemId[];
  now: number;
  /** how many questions this sitting may hold */
  max: number;
  /** how many of those may be items never asked for this skill */
  fresh: number;
}

export interface DrillQueue {
  ids: ItemId[];
  due: number;
  fresh: number;
  /** due items that did not fit in this sitting */
  waiting: number;
}

/**
 * Which items have never been asked for this skill and are ready to be.
 *
 * "Ready" does real work here. Asking you to *write* a character you cannot
 * yet recognise is a question with nothing behind it, so for every skill but
 * recognition the candidates are drawn from what recognition has already
 * established. That ordering — know it, then say it, then produce it — is the
 * one the app is built around, and it falls out of this one filter.
 */
export function freshCandidates(
  book: RecallBook,
  pool: ItemId[],
  skill: Skill,
): ItemId[] {
  return pool.filter((id) => {
    if (book[id]?.[skill]) return false;
    return skill === 'recognise' ? true : isLearned(book[id]);
  });
}

export function dueNow(book: RecallBook, pool: ItemId[], skill: Skill, now: number) {
  return pool
    .filter((id) => {
      const r = book[id]?.[skill];
      return Boolean(r && isDue(r, now));
    })
    .sort((a, b) => book[a][skill]!.due - book[b][skill]!.due);
}

/**
 * A sitting: everything overdue that fits, with a few new ones folded in.
 *
 * New items go *among* the reviews rather than in a block at the front or the
 * back. A run of twelve unfamiliar characters is where a session stops being
 * recall and starts being reading a list, and the effect on what you remember
 * afterwards is the difference the whole feature exists for.
 */
export function planDrill(book: RecallBook, opts: DrillOptions): DrillQueue {
  const { skill, pool, now, max } = opts;
  const due = dueNow(book, pool, skill, now);
  const freshWanted = Math.max(0, Math.min(opts.fresh, max - Math.min(due.length, max)));
  const fresh = freshCandidates(book, pool, skill).slice(
    0,
    // Leave room for the reviews: they are the ones with a deadline.
    freshWanted || (due.length ? 0 : Math.min(opts.fresh, max)),
  );

  const reviews = due.slice(0, Math.max(0, max - fresh.length));
  const ids: ItemId[] = [];
  let f = 0;
  let r = 0;
  while (f < fresh.length || r < reviews.length) {
    // Two reviews, then something new, for as long as both last.
    const takeFresh = f < fresh.length && (r >= reviews.length || (ids.length + 1) % 3 === 0);
    ids.push(takeFresh ? fresh[f++] : reviews[r++]);
  }

  return {
    ids,
    due: reviews.length,
    fresh: fresh.length,
    waiting: Math.max(0, due.length - reviews.length),
  };
}

export interface SkillSummary {
  due: number;
  fresh: number;
  seen: number;
  /** failed more than once, and so worth putting on paper */
  shaky: number;
}

/** What the review tab shows before you have chosen anything. */
export function summarise(
  book: RecallBook,
  pool: ItemId[],
  skills: Skill[],
  now: number,
): Record<string, SkillSummary> {
  const out: Record<string, SkillSummary> = {};
  for (const skill of skills) {
    let due = 0;
    let seen = 0;
    let shaky = 0;
    for (const id of pool) {
      const r = book[id]?.[skill];
      if (!r) continue;
      seen++;
      if (isDue(r, now)) due++;
      if (r.lapses > 1) shaky++;
    }
    out[skill] = {
      due,
      seen,
      shaky,
      fresh: freshCandidates(book, pool, skill).length,
    };
  }
  return out;
}

/* ------------------------------------------------------------- the choices */

/** A small deterministic shuffle, so a question does not reshuffle on render. */
export function shuffled<T>(items: T[], seed: number): T[] {
  let s = seed >>> 0 || 1;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The answers to choose between when the question is "which one is it".
 *
 * The distractors are the character's own look-alikes, which is the whole
 * point: 己 is not learned by being told it resembles 已, it is learned by
 * having to pick between them with nothing else to go on. Where the data has
 * no look-alikes, the nearest neighbours in the teaching order stand in — they
 * are at least characters met around the same time.
 */
export function confusionChoices(
  lib: Library,
  char: string,
  count: number,
  seed: number,
): string[] {
  const e = lib.byChar.get(char);
  if (!e) return [char];
  const pool = e.conf.filter((c) => c !== char && lib.byChar.has(c));

  if (pool.length < count - 1) {
    const near = lib.characters
      .filter((c) => c.c !== char && !pool.includes(c.c) && Math.abs(c.i - e.i) < 60)
      .sort((a, b) => Math.abs(a.i - e.i) - Math.abs(b.i - e.i))
      .map((c) => c.c);
    pool.push(...near);
  }

  return shuffled([char, ...pool.slice(0, count - 1)], seed);
}

/** Items whose look-alikes the data actually knows about — the drill's pool. */
export const confusablePool = (lib: Library, pool: ItemId[]) =>
  pool.filter((id) => (lib.byChar.get(id.slice(1))?.conf.length ?? 0) > 0);

/** Everything a drill needs to put one question on screen. */
export interface Question {
  id: ItemId;
  char: string;
  py: string;
  gloss: string;
  tone: number;
  strokes: number;
}

export function questionFor(lib: Library, id: ItemId): Question | null {
  const e = lib.byChar.get(id.slice(1));
  if (!e) return null;
  const py = e.py[0] ?? '';
  return {
    id: charId(e.c),
    char: e.c,
    py,
    gloss: e.def,
    tone: toneOf(py),
    strokes: e.sc ?? 0,
  };
}
