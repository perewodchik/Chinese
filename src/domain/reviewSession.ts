import type { Library } from '../data/types';
import { idValue, isCharId, isWordId, type ItemId } from './ids';
import { REVIEW_SKILLS } from './lesson';
import { isClaimOnly, isDue, isLearned, retrievability, type Recall, type RecallBook, type Skill } from './memory';

/**
 * The daily review: everything due, in one mixed sitting, sized in minutes.
 *
 * It replaces a run through seven separate drills. Three things change on
 * the way:
 *
 * - **One question per item per day.** An item with several skills due is
 *   asked the one it is closest to losing; the others wait until tomorrow
 *   (Anki calls this burying siblings). Asking 好 three ways in a row makes
 *   the second and third answers easy for the wrong reason.
 * - **Mixed.** Characters and words together, and a word never straight
 *   after one of its own characters, for the same reason.
 * - **A budget, not a count.** Ten minutes is a promise a learner can keep;
 *   "30 questions" is not, when some are a tap and some a written character.
 *   What does not fit stays due, and the session says so.
 *
 * When the backlog is far past what a session can hold, the order changes
 * from oldest-due-first to most-at-risk-first, and claims (ticked, never
 * answered) go last: catching up should rescue what is slipping, not what
 * was only ever believed.
 */

export interface SessionTarget {
  id: ItemId;
  skill: Skill;
  /** the record being reviewed, or null for a skill never asked before */
  record: Recall | null;
}

export interface SessionPlan {
  targets: SessionTarget[];
  /** items with something due */
  dueItems: number;
  /** of those, left for another session by the budget */
  left: number;
  /** the backlog is past what a session holds: most at risk first */
  catchUp: boolean;
}

/** About how long each kind of question takes, in seconds. */
const SECONDS: Record<Skill, number> = { recognise: 9, sound: 11, write: 30, use: 10 };

/** How many skills never asked before may join one session: a character's sound, then its writing. */
const FRESH: Partial<Record<Skill, number>> = { sound: 3, write: 2 };

export const secondsFor = (t: Pick<SessionTarget, 'skill'>) => SECONDS[t.skill];

function dueSkill(book: RecallBook, id: ItemId, now: number): SessionTarget | null {
  const sk = book[id];
  if (!sk) return null;
  const skills = isWordId(id) ? (['recognise'] as Skill[]) : REVIEW_SKILLS;
  let best: SessionTarget | null = null;
  let risk = Infinity;
  for (const s of skills) {
    const r = sk[s];
    if (!r || !isDue(r, now)) continue;
    const p = retrievability(r, now);
    if (p < risk) {
      risk = p;
      best = { id, skill: s, record: r };
    }
  }
  return best;
}

export function planReview(lib: Library, book: RecallBook, now: number, minutes: number): SessionPlan {
  const due: SessionTarget[] = [];
  for (const id in book) {
    if (isCharId(id) ? !lib.byChar.has(idValue(id)) : !isWordId(id)) continue;
    const t = dueSkill(book, id, now);
    if (t) due.push(t);
  }

  const budget = minutes * 60;
  const holds = Math.max(1, Math.floor(budget / 10));
  const catchUp = due.length > holds * 3;
  if (catchUp) {
    const claim = (t: SessionTarget) => (t.skill === 'recognise' && isClaimOnly(t.record ?? undefined) ? 1 : 0);
    due.sort((a, b) => claim(a) - claim(b) || retrievability(a.record!, now) - retrievability(b.record!, now));
  } else {
    due.sort((a, b) => a.record!.due - b.record!.due);
  }

  const out: SessionTarget[] = [];
  let spent = 0;
  for (const t of due) {
    if (spent + secondsFor(t) > budget && out.length) break;
    out.push(t);
    spent += secondsFor(t);
  }
  const left = due.length - out.length;

  // With room to spare and nothing left behind, bring in a few skills never
  // asked before: the sound, then the writing, of characters already known.
  if (!left) {
    const asked = new Set(out.map((t) => t.id));
    for (const skill of ['sound', 'write'] as Skill[]) {
      let n = 0;
      for (const id in book) {
        if (n >= (FRESH[skill] ?? 0) || spent + SECONDS[skill] > budget) break;
        if (!isCharId(id) || asked.has(id) || book[id]![skill] || !isLearned(book[id])) continue;
        if (!lib.byChar.has(idValue(id))) continue;
        out.push({ id, skill, record: null });
        asked.add(id);
        spent += SECONDS[skill];
        n++;
      }
    }
  }

  return { targets: interleave(out), dueItems: due.length, left, catchUp };
}

/**
 * Characters and words mixed, and a word never straight after one of its own
 * characters (or the other way round) — the first would give the second away.
 */
export function interleave(list: SessionTarget[]): SessionTarget[] {
  const chars = list.filter((t) => isCharId(t.id));
  const words = list.filter((t) => !isCharId(t.id));
  const out: SessionTarget[] = [];
  // Deal from both piles in proportion, so words are spread through rather than bunched.
  let c = 0;
  let w = 0;
  while (c < chars.length || w < words.length) {
    const takeWord = w < words.length && (c >= chars.length || w / Math.max(1, words.length) <= c / Math.max(1, chars.length));
    out.push(takeWord ? words[w++]! : chars[c++]!);
  }
  const related = (a: SessionTarget, b: SessionTarget) => {
    const x = idValue(a.id);
    const y = idValue(b.id);
    return x !== y && (x.includes(y) || y.includes(x));
  };
  for (let i = 1; i < out.length; i++) {
    if (!related(out[i - 1]!, out[i]!)) continue;
    // swap with the next card that is unrelated to both neighbours
    for (let j = i + 1; j < out.length; j++) {
      if (!related(out[i - 1]!, out[j]!) && !(out[i + 1] && related(out[j]!, out[i + 1]!))) {
        [out[i], out[j]] = [out[j]!, out[i]!];
        break;
      }
    }
  }
  return out;
}

/** An item missed often enough that asking it the same way again is not working. */
export const LEECH_LAPSES = 4;
export const isLeech = (r: Recall | null | undefined) => Boolean(r && r.lapses >= LEECH_LAPSES);

/** Every item with a skill past the leech line, worst first. */
export function leeches(book: RecallBook): Array<{ id: ItemId; lapses: number }> {
  const out: Array<{ id: ItemId; lapses: number }> = [];
  for (const id in book) {
    if (!isCharId(id) && !isWordId(id)) continue;
    const lapses = Math.max(0, ...REVIEW_SKILLS.map((s) => book[id]![s]?.lapses ?? 0));
    if (lapses >= LEECH_LAPSES) out.push({ id, lapses });
  }
  return out.sort((a, b) => b.lapses - a.lapses);
}
