import type { ItemId } from './ids';

/**
 * What the app remembers about your memory.
 *
 * The thing this replaced was a checkbox. `learned` was one flag per item, set
 * by hand, at the moment of maximum confidence — right after you had just read
 * the character in a sentence — and never questioned again. It could not tell
 * a character you can write from one you can only just about recognise, it had
 * no way to record a failure, and nothing it held ever came back. Copying a
 * character out of a grid with the model printed at the top of the block is
 * not recall; it is tracing. So the app knew what had been *printed*, which is
 * a different question from what you still know.
 *
 * What replaces it is one record per item *per skill*, carrying how long the
 * memory is expected to hold and when to ask again. Two findings do all the
 * work here and neither is controversial: you remember what you were made to
 * retrieve, not what you were shown again, and you remember it longer when the
 * retrieval was spaced out to the edge of forgetting.
 *
 * Nothing in this file knows about React, the DOM or the store. It is a pure
 * function of (what happened, when) → (what to do next).
 */

/* ------------------------------------------------------------- the skills */

/**
 * Four abilities, tracked apart, because they are learned apart and forgotten
 * apart. Recognising 好 on a page, saying it with the right tone, producing it
 * on blank paper from the meaning alone, and reading it inside 好看 come apart
 * by months in that order — writing lags recognition badly, and it is exactly
 * the gap a single flag hides.
 */
export type Skill = 'recognise' | 'sound' | 'write' | 'use';

export const SKILLS: Skill[] = ['recognise', 'sound', 'write', 'use'];

export const SKILL_META: Record<
  Skill,
  { label: string; blurb: string; prompt: string }
> = {
  recognise: {
    label: 'Recognise',
    blurb: 'See it, know what it means',
    prompt: 'the character, asking for its meaning',
  },
  sound: {
    label: 'Say',
    blurb: 'See it, know how it sounds — tone included',
    prompt: 'the character, asking for its reading',
  },
  write: {
    label: 'Write',
    blurb: 'Produce it from the meaning, on blank paper',
    prompt: 'the meaning and the reading, asking for the character',
  },
  use: {
    label: 'Use',
    blurb: 'Read it inside a word',
    prompt: 'a word it belongs to',
  },
};

/**
 * How much one success buys, by skill.
 *
 * Recognition is the cheap one and sets the scale. Production decays fastest,
 * so a success at writing is worth less time than a success at recognising the
 * same character — which is the arithmetic reason the app will keep putting
 * characters you "know" back on paper.
 */
const SKILL_GAIN: Record<Skill, number> = {
  recognise: 1,
  sound: 0.95,
  write: 0.8,
  use: 0.9,
};

/* ------------------------------------------------------------- the record */

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy'];

export const RATING_META: Record<Rating, { label: string; hint: string }> = {
  again: { label: 'Again', hint: 'No idea, or wrong' },
  hard: { label: 'Hard', hint: 'Got there, but it took a while' },
  good: { label: 'Good', hint: 'Knew it' },
  easy: { label: 'Easy', hint: 'Instant — ask me much later' },
};

export interface Recall {
  /** stability, in days: how long until this memory decays to `RETENTION` */
  s: number;
  /** difficulty, 1 to 10: how little each success buys for this item */
  d: number;
  /** epoch ms when it next falls due */
  due: number;
  /** epoch ms it was last graded */
  last: number;
  /**
   * Epoch ms this skill entered the picture — the day you ticked the box, or
   * the day the first question about it was answered. `last` moves with every
   * grade, so it cannot answer "when did I learn this", which is the one date
   * a person actually wants to see next to a character.
   */
  since: number;
  reps: number;
  lapses: number;
  /**
   * Set on a record that is only a claim — ticked "learned" by hand, never yet
   * answered for. Grading replaces the record, so the first real answer
   * clears it. It is what lets unticking take back a claim without taking
   * back anything that was earned.
   */
  claim?: true;
}

/** What is known about one item, across the skills it has been asked for. */
export type SkillBook = Partial<Record<Skill, Recall>>;

/** The whole memory, by item id. Items never asked about simply aren't here. */
export type RecallBook = Record<ItemId, SkillBook>;

export const DAY = 86_400_000;

/**
 * The retention this schedules for: ask again when there is a one-in-ten
 * chance you have lost it. Lower would mean less reviewing and more forgetting;
 * higher means drilling things you still know. 0.9 is the usual place to sit.
 */
export const RETENTION = 0.9;

/** Half an hour: what a failure is worth, so it comes back this session. */
const MIN_STABILITY = 0.02;
const MAX_STABILITY = 365 * 5;

/**
 * What a first answer is worth, in days, before there is any history to go on.
 * Deliberately short: the first successful recall of a character is the least
 * reliable evidence you will ever have about it.
 */
const FIRST_INTERVAL: Record<Rating, number> = {
  again: MIN_STABILITY,
  hard: 0.5,
  good: 1.5,
  easy: 4,
};

const FIRST_DIFFICULTY: Record<Rating, number> = {
  again: 7.5,
  hard: 6,
  good: 5,
  easy: 4,
};

/** How a rating moves difficulty, before it is pulled back towards the middle. */
const DIFFICULTY_STEP: Record<Rating, number> = {
  again: 1.2,
  hard: 0.4,
  good: -0.05,
  easy: -0.6,
};

/** How much a success multiplies stability by, before the other factors. */
const EASE: Record<Exclude<Rating, 'again'>, number> = {
  hard: 1.15,
  good: 1.9,
  easy: 2.7,
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/* ---------------------------------------------------------- the forgetting */

/**
 * The chance you still have it, `t` days after the last success.
 *
 * A power curve rather than the exponential the textbooks draw: memories decay
 * quickly at first and then very slowly, which an exponential gets wrong at
 * both ends. At `t = s` this returns exactly `RETENTION`, which is what makes
 * "stability" mean something you can read off a screen — it is the number of
 * days until this is a coin-flip-ish nine-in-ten.
 */
export function retrievability(r: Recall, now: number): number {
  const t = Math.max(0, (now - r.last) / DAY);
  return 1 / (1 + t / (9 * Math.max(r.s, MIN_STABILITY)));
}

/** How many days a given stability buys, at a target retention. */
export const intervalFor = (s: number, retention = RETENTION) =>
  9 * s * (1 / clamp(retention, 0.5, 0.99) - 1);

/**
 * A few percent either side of the due date, so that four hundred characters
 * marked in one afternoon do not all come back on the same afternoon. Derived
 * from the timestamp rather than `Math.random`, so grading the same card twice
 * with the same clock gives the same answer.
 */
function fuzz(days: number, now: number): number {
  if (days < 3) return days;
  const n = Math.sin(now % 100_000) * 10_000;
  const spread = (n - Math.floor(n)) * 0.1 - 0.05;
  return days * (1 + spread);
}

/* ------------------------------------------------------------- the grading */

/**
 * One answer, folded into what was already known about the item.
 *
 * The three things that decide the next interval: how well you did, how hard
 * this particular item has proved to be, and — the part worth keeping — *how
 * close to forgetting it you were when you got it right*. Recalling something
 * you had nearly lost is worth far more than recalling something you saw
 * yesterday, which is the whole argument for spacing, so it is paid for here
 * rather than assumed.
 */
export function grade(
  prev: Recall | undefined,
  rating: Rating,
  now: number,
  skill: Skill = 'recognise',
  /**
   * How much of a success this answer proves, 0 to 1. A pick out of five
   * shown on screen is weaker evidence than producing the answer from
   * nothing, so the multiple-choice drills pass less than 1 and buy a
   * correspondingly smaller step. A failure is a failure either way.
   */
  weight = 1,
): Recall {
  const w = clamp(weight, 0.1, 1);
  if (!prev || prev.reps === 0) {
    const s =
      rating === 'again'
        ? FIRST_INTERVAL.again
        : Math.max(MIN_STABILITY, FIRST_INTERVAL[rating] * SKILL_GAIN[skill] * w);
    return {
      s,
      d: FIRST_DIFFICULTY[rating],
      last: now,
      since: prev?.since ?? now,
      due: now + intervalFor(s) * DAY,
      reps: 1,
      lapses: rating === 'again' ? 1 : 0,
    };
  }

  // Difficulty drifts with how it went, then leans a little back towards the
  // middle, so one bad morning does not condemn an item forever.
  const stepped = clamp(prev.d + DIFFICULTY_STEP[rating], 1, 10);
  const d = clamp(stepped + (5 - stepped) * 0.05, 1, 10);

  let s: number;
  if (rating === 'again') {
    // A lapse does not send it back to zero — you have met it before and that
    // still counts for something — but it does cost most of the interval, and
    // costs more on an item that was already difficult.
    s = clamp(prev.s * 0.35 * (1 - (d - 1) / 25), MIN_STABILITY, MAX_STABILITY);
  } else {
    const r = retrievability(prev, now);
    const difficulty = clamp((11 - d) / 7.5, 0.45, 1.35);
    const lateness = 1 + 0.6 * (1 - r);
    const gain = (EASE[rating] - 1) * difficulty * lateness * SKILL_GAIN[skill] * w;
    s = clamp(prev.s * (1 + gain), MIN_STABILITY, MAX_STABILITY);
  }

  return {
    s,
    d,
    last: now,
    since: prev.since ?? now,
    due: now + fuzz(intervalFor(s), now) * DAY,
    reps: prev.reps + 1,
    lapses: prev.lapses + (rating === 'again' ? 1 : 0),
  };
}

/* -------------------------------------------------------------- reading it */

export const isDue = (r: Recall, now: number) => r.due <= now;

/**
 * A card that has never been asked about is not "due" — it is unseen, which is
 * a different queue and a different feeling. Keeping them apart is what stops
 * the review count from reading 2,700 on day one.
 */
export function dueIds(
  book: RecallBook,
  skill: Skill,
  now: number,
  ids?: Iterable<ItemId>,
): ItemId[] {
  const out: ItemId[] = [];
  const keys = ids ?? Object.keys(book);
  for (const id of keys) {
    const r = book[id]?.[skill];
    if (r && isDue(r, now)) out.push(id);
  }
  // Longest overdue first: those are the ones actually slipping.
  return out.sort((a, b) => (book[a][skill]!.due ?? 0) - (book[b][skill]!.due ?? 0));
}

export interface SkillCount {
  /** asked about at least once */
  seen: number;
  /** of those, due now */
  due: number;
  /** of those, failed more than once */
  shaky: number;
}

export function countSkill(book: RecallBook, skill: Skill, now: number): SkillCount {
  let seen = 0;
  let due = 0;
  let shaky = 0;
  for (const id in book) {
    const r = book[id][skill];
    if (!r) continue;
    seen++;
    if (isDue(r, now)) due++;
    if (r.lapses > 1) shaky++;
  }
  return { seen, due, shaky };
}

/**
 * How firmly one item is held, 0 to 1, across every skill it has a record for.
 * Used for "what is slipping" rather than for scheduling — the scheduler works
 * on one skill at a time, but a person wants one number per character.
 */
export function strengthOf(sk: SkillBook | undefined, now: number): number {
  if (!sk) return 0;
  const rs = SKILLS.map((s) => sk[s]).filter((r): r is Recall => Boolean(r));
  if (!rs.length) return 0;
  return rs.reduce((a, r) => a + retrievability(r, now), 0) / rs.length;
}

/**
 * How far one character has got, as one number and one word.
 *
 * The scheduler thinks in four separate records; a person looking at a
 * character wants a single answer to "where am I with this". Mastery is the
 * mean over all four skills of *how firmly that skill is held right now* —
 * a skill with no record at all counts as zero, which is the honest reading:
 * a character you can recognise and not write is a quarter of the way there,
 * not finished.
 *
 * `MASTERED_STABILITY` is what counts as done for one skill: a memory that
 * would still hold a month from now. Beyond that the bar stops moving, so it
 * does not take a year of intervals to look complete.
 */
const MASTERED_STABILITY = 30;

export type MasteryBand = 'unseen' | 'new' | 'shaky' | 'holding' | 'solid';

export interface Mastery {
  /** 0 to 1 over all four skills */
  score: number;
  band: MasteryBand;
  label: string;
  /** how many of the four skills have ever been asked about */
  skills: number;
  /** epoch ms this character first entered the picture, over all skills */
  since: number | null;
  /** epoch ms of the most recent answer about it */
  last: number | null;
  /** epoch ms of the next question, over all skills */
  due: number | null;
  reps: number;
  lapses: number;
}

const BAND_LABEL: Record<MasteryBand, string> = {
  unseen: 'Not started',
  new: 'Just met',
  shaky: 'Shaky',
  holding: 'Holding',
  solid: 'Solid',
};

/** How firmly one skill is held now, 0 to 1: still recalled, and for how long. */
export const skillHold = (r: Recall | undefined, now: number): number =>
  r ? retrievability(r, now) * Math.min(1, r.s / MASTERED_STABILITY) : 0;

export function masteryOf(sk: SkillBook | undefined, now: number): Mastery {
  const rs = SKILLS.map((s) => sk?.[s]).filter((r): r is Recall => Boolean(r));
  const score = SKILLS.reduce((a, s) => a + skillHold(sk?.[s], now), 0) / SKILLS.length;
  const lapses = rs.reduce((a, r) => a + r.lapses, 0);
  const band: MasteryBand = !rs.length
    ? 'unseen'
    : lapses > 1 && score < 0.6
      ? 'shaky'
      : score < 0.15
        ? 'new'
        : score < 0.65
          ? 'holding'
          : 'solid';
  return {
    score,
    band,
    label: BAND_LABEL[band],
    skills: rs.length,
    since: rs.length ? Math.min(...rs.map((r) => r.since ?? r.last)) : null,
    last: rs.length ? Math.max(...rs.map((r) => r.last)) : null,
    due: rs.length ? Math.min(...rs.map((r) => r.due)) : null,
    reps: rs.reduce((a, r) => a + r.reps, 0),
    lapses,
  };
}

/**
 * The old flag, derived.
 *
 * An item counts as learned once it has been recognised successfully at least
 * once and holds for a day or more — which is what ticking the box used to
 * claim, only now something has to have happened to earn it. Everything that
 * used to read `learned` keeps working; it is just no longer a promise you
 * made to yourself.
 */
const LEARNED_STABILITY = 1;

export const isLearned = (sk: SkillBook | undefined): boolean =>
  Boolean(sk?.recognise && sk.recognise.reps > 0 && sk.recognise.s >= LEARNED_STABILITY);

export function learnedFrom(book: RecallBook): Set<ItemId> {
  const out = new Set<ItemId>();
  for (const id in book) if (isLearned(book[id])) out.add(id);
  return out;
}

/* ------------------------------------------------------------- seeding it */

/**
 * A record for something asserted rather than tested — the old checkbox, and
 * the "mark all learned" button that still exists.
 *
 * It is given a real but short stability: believed, not verified. Nine days
 * puts it in front of you soon enough to find out whether the belief was true,
 * without pretending a claim is evidence.
 */
export function asserted(now: number, dueIn = 9, since = now): Recall {
  return {
    s: dueIn,
    d: 5,
    last: now,
    since,
    due: now + dueIn * DAY,
    reps: 1,
    lapses: 0,
    claim: true,
  };
}

/**
 * Whether a record is a claim and nothing more.
 *
 * Records written before claims were marked have no `claim` flag, so for
 * those the shape gives it away: one rep, no lapses, the claim's difficulty,
 * and a stability no first answer produces (a first "good" is exactly 1.5
 * days times the skill's gain; a claim is a whole number of days or a spread
 * from 1). Claims are only ever made about recognition, so callers looking at
 * other skills should not ask.
 */
export function isClaimOnly(r: Recall | undefined): boolean {
  if (!r) return false;
  if (r.claim) return true;
  if (r.reps !== 1 || r.lapses !== 0 || r.d !== 5 || r.s < 1) return false;
  // A first "good" is FIRST_INTERVAL.good times the skill's gain; anything
  // else of this shape was written by `asserted`.
  return !SKILLS.some((skill) => r.s === FIRST_INTERVAL.good * SKILL_GAIN[skill]);
}

/**
 * Stability below which an item no longer counts as learned: what unticking
 * leaves a record with that has real answers behind it.
 */
const UNLEARNED_STABILITY = 0.5;

/**
 * Taking a claim back, or saying "I do not know this after all".
 *
 * A record that was only ever a claim goes altogether. One with answers
 * behind it keeps them — the reps, the lapses, the difficulty and the date it
 * was first met are evidence, and a mistaken tap must not wipe them — but it
 * stops counting as learned and falls due now, so the next sitting asks.
 */
export function unclaimed(r: Recall | undefined, now: number): Recall | null {
  if (!r || isClaimOnly(r)) return null;
  return {
    s: Math.min(r.s, UNLEARNED_STABILITY),
    d: r.d,
    last: now,
    since: r.since,
    due: now,
    reps: r.reps,
    lapses: r.lapses,
  };
}

/**
 * Ticking "learned" on an item that is not counted as learned.
 *
 * No record, or only a claim: a fresh claim. A record with answers behind it
 * — something failed back below the line, say — is renewed rather than
 * replaced: the stability and due date are the claim's, the history stays.
 */
export function reclaimed(r: Recall | undefined, now: number, dueIn: number): Recall {
  const since = r?.since ?? now;
  if (!r || isClaimOnly(r)) return asserted(now, dueIn, since);
  return { ...r, s: Math.max(r.s, dueIn), last: now, due: now + dueIn * DAY };
}

/**
 * Spreads a batch of asserted items across the next few weeks.
 *
 * Three hundred characters ticked off over three months would otherwise all
 * fall due on the same day, and a review queue of three hundred is a review
 * queue nobody opens. Earlier entries come back sooner on purpose: in a list
 * kept in the order it was added, the things at the front were marked longest
 * ago and are the likeliest to have gone.
 */
export function spreadAsserted(
  ids: ItemId[],
  now: number,
  overDays = 21,
): Record<ItemId, Recall> {
  const out: Record<ItemId, Recall> = {};
  const n = Math.max(1, ids.length);
  ids.forEach((id, i) => {
    const dueIn = 1 + (i / n) * overDays;
    out[id] = asserted(now, dueIn);
  });
  return out;
}

/* ------------------------------------------------------------ on paper */

/**
 * A recall sheet that has been printed and not yet marked.
 *
 * Writing happens away from the screen, which is the one place the scheduler
 * cannot see. So the app remembers what it put on paper and waits: until the
 * sheet is marked, nothing about those characters has been learned, and the
 * moment it is marked, a dozen honest results arrive at once. It is the only
 * way the `write` skill ever gets evidence that is not a mouse drawing.
 */
export interface PrintedSheet {
  id: string;
  name: string;
  /** what was on it, in the order it was printed — the key's numbering */
  items: ItemId[];
  printedAt: number;
  /** null until it has been marked */
  gradedAt: number | null;
}

/** Sheets still waiting to be marked, oldest first. */
export const pendingSheets = (sheets: PrintedSheet[]) =>
  sheets.filter((s) => s.gradedAt === null).sort((a, b) => a.printedAt - b.printedAt);
