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
  duration: number;
}

const TITLE_MS = 2500;
const ASK_MS = 2500;
const ANSWER_MS = 3000;

export function videoPlan(
  text: Pick<GeneratedText, 'lines' | 'genre' | 'questions' | 'pictures'>,
  reading: { timings: Array<[number, number]>; durationMs: number },
  look: VideoLook,
): VideoPlan {
  const paras = paragraphs(text);
  const steps: VideoStep[] = [];
  let at = 0;
  const push = (s: StepWithoutTime) => {
    steps.push({ ...s, at } as VideoStep);
    at += s.dur;
  };
  if (look.titleCard) push({ kind: 'title', dur: TITLE_MS });
  paras.forEach((lines, p) => {
    // From where the paragraph's first line starts (the very start for the
    // first) to where the next paragraph's starts, so nothing said is cut.
    const from = p === 0 ? 0 : (reading.timings[lines[0]!]?.[0] ?? 0);
    const next = paras[p + 1];
    const to = next ? (reading.timings[next[0]!]?.[0] ?? reading.durationMs) : reading.durationMs;
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
  return { steps, paras, pictureOf, duration: at };
}

/** What is on screen at a moment of the video. */
export interface VideoMoment {
  step: VideoStep;
  /** ms into the step */
  into: number;
  /** the line being read, in a paragraph or its pause */
  line: number | null;
  /** the whole video's progress, 0–1 */
  progress: number;
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
  return { step, into, line, progress: plan.duration ? time / plan.duration : 0 };
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
