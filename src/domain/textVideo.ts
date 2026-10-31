import { paragraphs } from './reading';
import type { GeneratedText } from './text';

/**
 * A text as a video: its pictures one a paragraph, the narrator's reading of
 * it, the sentence being read under the picture — then, if asked, the
 * questions, each with a pause to answer aloud.
 *
 * This file is the plan only: what is on screen when, as a list of steps on
 * the video's own clock. The steps that play the reading say which stretch of
 * it they play, so the picture and the subtitles are timed by the narrator's
 * own timings, never guessed. Drawing and recording are in
 * `features/reader/video`.
 */

export type VideoLayout = 'above' | 'over' | 'side' | 'words';
export type VideoSize = 's' | 'm' | 'l' | 'xl';

export interface VideoLook {
  layout: VideoLayout;
  /** the chapter's name at the top of every scene */
  title: 'off' | 'chapter' | 'book';
  titleLook: 'band' | 'plain';
  background: 'paper' | 'night';
  type: 'kai' | 'print';
  /** how the line sits on the picture when it is drawn over it */
  overLook: 'box' | 'outline';
  progress: boolean;
  size: VideoSize;
  pinyin: boolean;
  english: boolean;
  /** a long line broken where its commas are */
  breakLines: boolean;
  /** a slow zoom on each picture */
  zoom: boolean;
  /** pictures fade into each other */
  fade: boolean;
  titleCard: boolean;
  /** the first seconds: a question the text answers, over its cover picture */
  hook: boolean;
  /** cut into parts of under a minute, at paragraphs, for Shorts */
  parts: boolean;
  /** quiet after each paragraph, ms */
  pause: 0 | 1000 | 2000;
  questions: boolean;
  /** time to answer each question, ms */
  think: 3000 | 5000 | 8000;
}

export const DEFAULT_LOOK: VideoLook = {
  layout: 'above',
  title: 'chapter',
  titleLook: 'band',
  background: 'paper',
  type: 'kai',
  overLook: 'box',
  progress: true,
  size: 'm',
  pinyin: true,
  english: false,
  breakLines: true,
  zoom: true,
  fade: true,
  titleCard: true,
  hook: true,
  parts: false,
  pause: 1000,
  questions: true,
  think: 5000,
};

/** A look as it was kept, with anything missing or no longer known put back to the default. */
export function lookOf(raw: unknown): VideoLook {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_LOOK } as Record<string, unknown>;
  const allowed: Record<string, readonly unknown[]> = {
    layout: ['above', 'over', 'side', 'words'],
    title: ['off', 'chapter', 'book'],
    titleLook: ['band', 'plain'],
    background: ['paper', 'night'],
    type: ['kai', 'print'],
    overLook: ['box', 'outline'],
    size: ['s', 'm', 'l', 'xl'],
    pause: [0, 1000, 2000],
    think: [3000, 5000, 8000],
  };
  for (const [k, v] of Object.entries(DEFAULT_LOOK)) {
    const got = o[k];
    if (allowed[k] ? allowed[k]!.includes(got) : typeof got === typeof v) out[k] = got;
  }
  return out as unknown as VideoLook;
}

export type VideoStep =
  | { kind: 'hook'; at: number; dur: number }
  | { kind: 'title'; at: number; dur: number }
  /** a paragraph read: the reading from `from` to `to` (ms in the reading) */
  | { kind: 'para'; at: number; dur: number; para: number; from: number; to: number }
  /** quiet after a paragraph, its last line still up */
  | { kind: 'pause'; at: number; dur: number; para: number }
  | { kind: 'question'; at: number; dur: number; q: number }
  | { kind: 'answer'; at: number; dur: number; q: number };

/** A step before it is put on the clock. */
type StepWithoutTime = VideoStep extends infer S ? (S extends unknown ? Omit<S, 'at'> : never) : never;

export interface VideoPlan {
  steps: VideoStep[];
  /** the lines of each paragraph */
  paras: number[][];
  /** the picture shown with each paragraph: its own, or the last one before it */
  pictureOf: Array<string | null>;
  /** the picture of the opening and the title card */
  cover: string | null;
  /** the opening question, when there is one */
  hook: string | null;
  /** the parts it is cut into, on the whole video's clock; one when it is not cut */
  parts: Array<{ at: number; dur: number }>;
  duration: number;
}

/** Shorts are a minute at most; a second kept in hand. */
export const PART_MS = 59_000;

const TITLE_MS = 2500;
const HOOK_MS = 2200;
const ASK_MS = 2500;
const ANSWER_MS = 3000;

export function videoPlan(
  text: Pick<GeneratedText, 'lines' | 'genre' | 'questions' | 'pictures'>,
  reading: { timings: Array<[number, number]>; durationMs: number },
  look: VideoLook,
  /** the opening question as the learner wrote it, and the paragraph whose picture is the cover */
  own: { hook?: string; cover?: number } = {},
): VideoPlan {
  const paras = paragraphs(text);
  const hook = look.hook ? own.hook?.trim() || null : null;
  const steps: VideoStep[] = [];
  let at = 0;
  const push = (s: StepWithoutTime) => {
    steps.push({ ...s, at } as VideoStep);
    at += s.dur;
  };
  if (hook) push({ kind: 'hook', dur: HOOK_MS });
  if (look.titleCard) push({ kind: 'title', dur: TITLE_MS });
  // Between two paragraphs the reading is cut in the middle of the quiet
  // between them — never where the next one starts, where a syllable's onset
  // or the last one's tail can still be sounding, and a cut there clicks.
  const cut = (p: number) => {
    const end = reading.timings[paras[p]!.at(-1)!]?.[1];
    const start = reading.timings[paras[p + 1]![0]!]?.[0];
    if (start === undefined) return reading.durationMs;
    return end !== undefined && start > end ? Math.round((end + start) / 2) : start;
  };
  paras.forEach((_, p) => {
    const next = paras[p + 1];
    const from = p === 0 ? 0 : cut(p - 1);
    const to = next ? cut(p) : reading.durationMs;
    push({ kind: 'para', dur: Math.max(0, to - from), para: p, from, to });
    if (look.pause && next) push({ kind: 'pause', dur: look.pause, para: p });
  });
  if (look.questions) {
    text.questions.forEach((_, q) => {
      push({ kind: 'question', dur: ASK_MS + look.think, q });
      push({ kind: 'answer', dur: ANSWER_MS, q });
    });
  }
  let last: string | null = null;
  const first = (text.pictures ?? []).filter((p) => p.key).sort((a, b) => a.para - b.para)[0]?.key ?? null;
  const pictureOf = paras.map((_, p) => {
    const own = text.pictures?.find((x) => x.para === p && x.key)?.key;
    last = own ?? last ?? first;
    return last;
  });
  const cover = pictureOf[own.cover ?? 0] ?? first;
  return { steps, paras, pictureOf, cover, hook, parts: look.parts ? partsOf(steps) : [{ at: 0, dur: at }], duration: at };
}

/**
 * Where the video is cut into parts of under a minute: only before a
 * paragraph (its pause goes with it) or before a question (its answer goes
 * with it), so nothing is cut mid-sentence. A paragraph longer than a part on
 * its own is a part on its own.
 */
function partsOf(steps: VideoStep[]): Array<{ at: number; dur: number }> {
  const parts: Array<{ at: number; dur: number }> = [];
  let start = 0;
  let i = 0;
  while (i < steps.length) {
    // The unit: a paragraph and its pause, a question and its answer, or one step.
    let j = i + 1;
    if (steps[i]!.kind === 'para' && steps[j]?.kind === 'pause') j++;
    if (steps[i]!.kind === 'question' && steps[j]?.kind === 'answer') j++;
    const unitEnd = steps[j - 1]!.at + steps[j - 1]!.dur;
    const startsUnit = steps[i]!.kind === 'para' || steps[i]!.kind === 'question';
    if (startsUnit && steps[i]!.at > start && unitEnd - start > PART_MS) {
      parts.push({ at: start, dur: steps[i]!.at - start });
      start = steps[i]!.at;
    }
    i = j;
  }
  const end = steps.length ? steps[steps.length - 1]!.at + steps[steps.length - 1]!.dur : 0;
  parts.push({ at: start, dur: end - start });
  return parts;
}

/** Which part a moment of the video is in. */
export const partAt = (plan: VideoPlan, t: number) => {
  let n = 0;
  plan.parts.forEach((p, i) => {
    if (t >= p.at) n = i;
  });
  return n;
};

/** What is on screen at a moment of the video. */
export interface VideoMoment {
  step: VideoStep;
  /** ms into the step */
  into: number;
  /** the line being read, in a paragraph or its pause */
  line: number | null;
  /** progress through the part it is in (the whole video when it is not cut), 0–1 */
  progress: number;
  /** which part, from 0, of how many */
  part: number;
  of: number;
}

export function momentAt(plan: VideoPlan, t: number, timings: Array<[number, number]>): VideoMoment {
  const time = Math.max(0, Math.min(t, plan.duration - 1));
  const step = plan.steps.find((s) => time >= s.at && time < s.at + s.dur) ?? plan.steps[plan.steps.length - 1]!;
  const into = Math.max(0, time - step.at);
  let line: number | null = null;
  if (step.kind === 'para') {
    const lines = plan.paras[step.para]!;
    const ms = step.from + into;
    // The line being read is the last that has started.
    line = lines[0]!;
    for (const i of lines) if ((timings[i]?.[0] ?? Infinity) <= ms) line = i;
  } else if (step.kind === 'pause') {
    line = plan.paras[step.para]!.at(-1)!;
  }
  const part = partAt(plan, time);
  const span = plan.parts[part]!;
  return { step, into, line, progress: span.dur ? (time - span.at) / span.dur : 0, part, of: plan.parts.length };
}

/** A line cut where its commas are, each piece keeping its comma. */
export function breakAtCommas(zh: string): string[] {
  const out = zh.match(/[^，、；：,;:]+[，、；：,;:]*/g) ?? [zh];
  // A piece of one or two characters is not a line (好吧，): it goes with its
  // neighbour, the one before it, or the one after when it comes first.
  const short = (piece: string) => [...piece.replace(/[^\p{Script=Han}]/gu, '')].length <= 2;
  const joined: string[] = [];
  let carry = '';
  for (const piece of out) {
    if (short(piece) && joined.length) joined[joined.length - 1] += piece;
    else if (short(piece)) carry += piece;
    else {
      joined.push(carry + piece);
      carry = '';
    }
  }
  if (carry && joined.length) joined[joined.length - 1] += carry;
  else if (carry) joined.push(carry);
  return joined;
}

export const mmss = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
