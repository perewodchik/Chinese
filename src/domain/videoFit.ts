import type { Library } from '../data/types';
import { segment } from './segment';
import { isHanzi } from './text';
import { wordIndex } from './vocab';
import type { VideoLine } from './video';
import type { WordKnowledge } from './words';

/**
 * How well a video fits the learner today.
 *
 * The number that predicts understanding is *coverage*: of the words that go
 * by, how many are ones you know. Around 95% is comfortable listening, 90% is
 * work, and below 80% most of the time goes on looking things up. So the
 * transcript is cut into words the way the reader cuts a passage, each is
 * looked up in what review knows about you, and the share is counted over the
 * words as they are said — 的 said forty times counts forty times, because it
 * is heard forty times.
 *
 * Names and noises (佩奇, 哈哈哈) are left out of the count: nobody needs to
 * have studied a pig's name to follow the story, and the laughter is not
 * Chinese to be learned.
 */

export type FitVerdict = 'easy' | 'stretch' | 'hard' | 'too-hard';

export const FIT_LABEL: Record<FitVerdict, string> = {
  easy: 'Easy',
  stretch: 'Good stretch',
  hard: 'Hard',
  'too-hard': 'Too hard for now',
};

export type Speed = 'slow' | 'natural' | 'fast';

export interface NewWord {
  w: string;
  /** band on the 2026 lists, or 0 off them */
  band: number;
  /** times it is said */
  count: number;
}

export interface VideoFit {
  verdict: FitVerdict;
  /** share of running words known or being learned, 0–1 */
  coverage: number;
  /** running words counted */
  words: number;
  /** unknown words in the learner's band or the next — worth learning — most said first */
  newInBand: NewWord[];
  /** unknown words above that, or on no list: the story's own words */
  newAbove: NewWord[];
  /** characters not yet learned, most said first */
  newChars: string[];
  /** Han characters a second while someone is speaking */
  perSecond: number | null;
  speed: Speed | null;
}

/** Laughter, surprise, hesitation: sounds, not vocabulary. */
const NOISES = new Set([...'哈嘿呵嘻哇哦噢嗯呃啊呀哎唉喂嗨咦哼吧']);

/** Laughter and the like: not words to learn. */
export const isNoise = (w: string) => [...w].every((c) => NOISES.has(c)) || (w.length > 1 && new Set(w).size === 1 && NOISES.has(w[0]!));

export function verdictOf(coverage: number): FitVerdict {
  if (coverage >= 0.95) return 'easy';
  if (coverage >= 0.88) return 'stretch';
  if (coverage >= 0.75) return 'hard';
  return 'too-hard';
}

export function speedOf(perSecond: number): Speed {
  if (perSecond < 3) return 'slow';
  if (perSecond <= 5) return 'natural';
  return 'fast';
}

export interface FitOptions {
  /** words to cut out whole: the transcript's names (`transcriptWords`) */
  names?: ReadonlySet<string>;
  /** the learner's HSK band */
  target: number;
  /** characters learned */
  knownChars: ReadonlySet<string>;
  /** words not to count at all — names and noises Claude marked "skip" */
  ignore?: ReadonlySet<string>;
}

export function videoFit(
  lines: ReadonlyArray<Pick<VideoLine, 'zh' | 'at' | 'end'>>,
  lib: Library,
  knowledge: WordKnowledge,
  { target, knownChars, ignore = new Set(), names = new Set() }: FitOptions,
): VideoFit {
  const index = wordIndex(lib);
  let counted = 0;
  let covered = 0;
  const unknown = new Map<string, NewWord>();
  const chars = new Map<string, number>();
  const whole = new Set([...ignore, ...names]);

  for (const line of lines) {
    // The words to ignore are cut out whole, so a name is one piece and not two characters.
    for (const t of segment(line.zh, lib, whole)) {
      if (!t.word || !isHanzi([...t.text][0]!)) continue;
      if (isNoise(t.text) || ignore.has(t.text) || names.has(t.text)) continue;
      for (const c of t.text) if (isHanzi(c) && !knownChars.has(c)) chars.set(c, (chars.get(c) ?? 0) + 1);
      // A name: a run no dictionary has, of characters that are not words on their own.
      const listed = lib.byWord.get(t.text);
      if (!listed && !index.has(t.text) && [...t.text].length > 1) continue;
      counted++;
      if (isKnown(t.text, knowledge, knownChars)) {
        covered++;
        continue;
      }
      const had = unknown.get(t.text);
      if (had) had.count++;
      else unknown.set(t.text, { w: t.text, band: listed?.hsk ?? 0, count: 1 });
    }
  }

  const coverage = counted ? covered / counted : 0;
  const all = [...unknown.values()].sort((a, b) => b.count - a.count || (a.band || 99) - (b.band || 99));
  const spoken = lines.reduce((s, l) => s + Math.max(0, l.end - l.at), 0);
  const han = lines.reduce((n, l) => n + [...l.zh].filter(isHanzi).length, 0);
  const perSecond = spoken > 5 ? Math.round((han / spoken) * 10) / 10 : null;

  return {
    verdict: verdictOf(coverage),
    coverage,
    words: counted,
    newInBand: all.filter((w) => w.band > 0 && w.band <= target + 1),
    newAbove: all.filter((w) => !(w.band > 0 && w.band <= target + 1)),
    newChars: [...chars.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c),
    perSecond,
    speed: perSecond === null ? null : speedOf(perSecond),
  };
}

/**
 * Known enough to follow: known or being learned. Before the words have ever
 * been sorted, a word counts when all its characters are learned — rough,
 * since 东 and 西 are not 东西, but better than calling every video too hard
 * to somebody who has simply not done the sweep.
 */
function isKnown(w: string, knowledge: WordKnowledge, knownChars: ReadonlySet<string>): boolean {
  const status = knowledge.status(w);
  if (status !== 'new') return true;
  return !knowledge.any && [...w].every((c) => knownChars.has(c));
}
