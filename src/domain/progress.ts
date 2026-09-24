import type { Library } from '../data/types';
import { charId, isCharId, isWordId, type ItemId } from './ids';
import {
  DAY,
  isClaimOnly,
  isDue,
  isLearned,
  masteryOf,
  pendingSheets,
  SKILLS,
  type MasteryBand,
  type PrintedSheet,
  type RecallBook,
  type Skill,
} from './memory';

/**
 * Where the learner is, in numbers a person can read at a glance.
 *
 * The header can only afford one line — the band in progress and how far
 * into it. This is the rest of that answer, for the panel the header opens:
 * every band, how much of what is ticked a review has actually confirmed,
 * how the characters in rotation are holding, what each skill has waiting,
 * and what happened this week. Pure: the same record and clock give the same
 * numbers, so the panel and a test agree.
 */

/** The bands in the order they are climbed; 7 stands for 7–9, which the syllabus treats as one. */
export const PROGRESS_BANDS = [1, 2, 3, 4, 5, 6, 7];

export const bandName = (band: number) => (band === 7 ? 'HSK 7–9' : `HSK ${band}`);

export interface BandProgress {
  band: number;
  size: number;
  /** counted as learned: ticked, or recognised in review */
  done: number;
  /** of those, recognised in a review at least once — not only ticked */
  proven: number;
}

export interface SkillProgress {
  skill: Skill;
  /** characters asked about for this skill at least once */
  seen: number;
  due: number;
  /** failed more than once */
  shaky: number;
  /** would still hold a month from now */
  firm: number;
}

export interface Progress {
  bands: BandProgress[];
  /** the lowest band with something left in it; null once every band is done */
  current: BandProgress | null;
  learned: number;
  proven: number;
  /** characters with any record at all — what Review draws from */
  inRotation: number;
  /** due across every skill, the number on the Review tab */
  due: number;
  /** characters in rotation, by how firmly they are held over the four skills */
  holding: Record<Exclude<MasteryBand, 'unseen'>, number>;
  skills: SkillProgress[];
  week: {
    /** characters answered for in a review in the last seven days */
    answered: number;
    /** characters that entered the picture in the last seven days */
    started: number;
  };
  words: { learned: number; inRotation: number };
  /** recall sheets printed and waiting to be marked */
  sheetsWaiting: number;
}

/** A skill held for this long counts as firm: past the point the bar stops moving. */
const FIRM_DAYS = 30;

export function progressOf(
  lib: Library,
  recall: RecallBook,
  learned: ReadonlySet<ItemId>,
  sheets: PrintedSheet[],
  now: number,
): Progress {
  const bands: BandProgress[] = PROGRESS_BANDS.map((band) => ({ band, size: 0, done: 0, proven: 0 }));
  let total = 0;
  let proven = 0;
  for (const c of lib.characters) {
    const b = bands[Math.min(c.hsk, 7) - 1];
    if (!b) continue;
    b.size++;
    const id = charId(c.c);
    if (!learned.has(id)) continue;
    b.done++;
    total++;
    if (!isClaimOnly(recall[id]?.recognise)) {
      b.proven++;
      proven++;
    }
  }

  const holding = { new: 0, shaky: 0, holding: 0, solid: 0 };
  const skills: SkillProgress[] = SKILLS.map((skill) => ({ skill, seen: 0, due: 0, shaky: 0, firm: 0 }));
  const weekAgo = now - 7 * DAY;
  let inRotation = 0;
  let answered = 0;
  let started = 0;
  const words = { learned: 0, inRotation: 0 };

  for (const id in recall) {
    const book = recall[id];
    const records = SKILLS.map((s) => book[s]).filter(Boolean);
    if (!records.length) continue;
    if (isWordId(id)) {
      words.inRotation++;
      if (isLearned(book)) words.learned++;
      continue;
    }
    // Radicals and anything else the library does not know are not characters to count.
    if (!isCharId(id) || !lib.byChar.has(id.slice(1))) continue;

    inRotation++;
    const band = masteryOf(book, now).band;
    if (band !== 'unseen') holding[band]++;

    let answeredHere = false;
    let since = Infinity;
    SKILLS.forEach((skill, i) => {
      const r = book[skill];
      if (!r) return;
      const row = skills[i]!;
      row.seen++;
      if (isDue(r, now)) row.due++;
      if (r.lapses > 1) row.shaky++;
      if (r.s >= FIRM_DAYS) row.firm++;
      since = Math.min(since, r.since ?? r.last);
      if (r.last >= weekAgo && !(skill === 'recognise' && isClaimOnly(r))) answeredHere = true;
    });
    if (answeredHere) answered++;
    if (since >= weekAgo) started++;
  }

  return {
    bands,
    current: bands.find((b) => b.size && b.done < b.size) ?? null,
    learned: total,
    proven,
    inRotation,
    due: skills.reduce((n, s) => n + s.due, 0),
    holding,
    skills,
    week: { answered, started },
    words,
    sheetsWaiting: pendingSheets(sheets).length,
  };
}
