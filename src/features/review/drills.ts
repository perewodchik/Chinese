import type { Library } from '../../data/types';
import type { Collection } from '../../domain/collection';
import { drillPools, planDrill, summarise, type DrillPools, type DrillQueue } from '../../domain/drill';
import type { ItemId } from '../../domain/ids';
import { summariseWords } from '../../domain/wordReview';
import type { RecallBook, Skill } from '../../domain/memory';
import type { DrillId } from '../../navigation/paths';

export interface DrillInfo {
  id: DrillId;
  skill: Skill;
  name: string;
  blurb: string;
  mark: string;
  /**
   * The drill whose schedule this one works through. Tones asks for the same
   * `sound` records as Say it, and Look-alikes for the same `recognise` ones
   * as Recognise, so their due counts are the same items counted again.
   */
  shares?: DrillId;
}

export const DRILLS: DrillInfo[] = [
  {
    id: 'recognise',
    skill: 'recognise',
    name: 'Recognise',
    blurb: 'See it, say what it means. The plain one.',
    mark: '认',
  },
  {
    id: 'sound',
    skill: 'sound',
    name: 'Say it',
    blurb: 'See it, produce the reading out loud.',
    mark: '读',
  },
  {
    id: 'tone',
    skill: 'sound',
    name: 'Tones',
    blurb: 'The syllable is given. Which of the five?',
    mark: '声',
    shares: 'sound',
  },
  {
    id: 'confuse',
    skill: 'recognise',
    name: 'Look-alikes',
    blurb: 'Pick it out from the ones it gets mistaken for.',
    mark: '辨',
    shares: 'recognise',
  },
  {
    id: 'word',
    skill: 'use',
    name: 'In a word',
    blurb: 'The same character, read inside a word you can already reach.',
    mark: '词',
  },
  {
    id: 'write',
    skill: 'write',
    name: 'Write it',
    blurb: 'From memory, on an empty square, checked stroke by stroke.',
    mark: '写',
  },
];

export const drillById = (id: string | undefined) => DRILLS.find((d) => d.id === id) ?? null;

/** Questions per sitting. */
export const SITTING_SIZES = [15, 30, 60];
export const DEFAULT_SITTING = 30;

/** The sitting size an address asks for, or the usual one when it asks for anything else. */
export function sittingSize(raw: string | null): number {
  const n = Number(raw);
  return SITTING_SIZES.includes(n) ? n : DEFAULT_SITTING;
}

/** The questions for one sitting of one drill. */
export function planSitting(
  drill: DrillInfo,
  pools: DrillPools,
  book: RecallBook,
  size: number,
  now: number,
): DrillQueue {
  const pool = drill.id === 'confuse' ? pools.confusable : drill.id === 'word' ? pools.inWords : pools.all;
  return planDrill(book, {
    skill: drill.skill,
    pool,
    now,
    max: size,
    // A third of a sitting can be new material before the sitting stops being
    // a review and becomes a lesson.
    fresh: Math.ceil(size / 3),
  });
}

export interface NextSitting {
  /** a drill by id, or the words sitting */
  id: DrillId | 'words';
  name: string;
  due: number;
}

/**
 * The sitting to go on to: the first drill, in the order a character is
 * learned — recognise, say, read in a word, write — that has something due,
 * then words. Tones and look-alikes are left out, since they work through
 * the same cards as Say it and Recognise. `after` is the sitting just done,
 * which is not offered again.
 */
export function nextSitting(
  lib: Library,
  book: RecallBook,
  learned: ReadonlySet<ItemId>,
  collections: Collection[],
  perDay: number,
  now: number,
  after?: string,
): NextSitting | null {
  const pools = drillPools(lib, book, learned);
  for (const d of DRILLS) {
    if (d.shares || d.id === after) continue;
    if (after && drillById(after)?.shares === d.id) continue;
    const pool = d.id === 'word' ? pools.inWords : pools.all;
    const due = summarise(book, pool, [d.skill], now)[d.skill]!.due;
    if (due > 0) return { id: d.id, name: d.name, due };
  }
  if (after !== 'words') {
    const words = summariseWords(book, collections, perDay, now);
    if (words.due > 0) return { id: 'words', name: 'Words', due: words.due };
  }
  return null;
}
