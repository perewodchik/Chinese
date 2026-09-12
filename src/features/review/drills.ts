import { planDrill, type DrillPools, type DrillQueue } from '../../domain/drill';
import type { RecallBook, Skill } from '../../domain/memory';
import type { DrillId } from '../../navigation/paths';

export interface DrillInfo {
  id: DrillId;
  skill: Skill;
  name: string;
  blurb: string;
  mark: string;
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
  },
  {
    id: 'confuse',
    skill: 'recognise',
    name: 'Look-alikes',
    blurb: 'Pick it out from the ones it gets mistaken for.',
    mark: '辨',
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
