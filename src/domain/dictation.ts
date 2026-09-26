import { parseSyllable, withTone, type Syllable } from './pinyin/syllable';
import { spokenTones, type SandhiRule } from './pinyin/sandhi';
import {
  OVERALL,
  hanOf,
  syllablesOf,
  type DictationCheck,
  type LineMark,
  type SylMark,
  type VideoLine,
} from './video';

/**
 * What a notebook check says: the pinyin written by hand, set against the
 * pinyin of the video, one syllable at a time.
 *
 * The learner does the comparing — they have the notebook, the app does not —
 * by tapping what they got wrong and typing what they wrote there. This file
 * turns those marks into the kinds of mistake, because "83% right" is a
 * score, but "zh heard as j, three times" is something to go and practise.
 *
 * Tone changes are not mistakes. The pinyin shown is the dictionary's, and
 * what is *said* differs: 你好 is written nǐ hǎo and said ní hǎo. Somebody who
 * writes the tone they heard wrote it right, and is told why it looks wrong.
 */

export type MistakeKind = 'tone' | 'initial' | 'final' | 'missed' | 'extra' | 'unknown';

export const KIND_LABEL: Record<MistakeKind, string> = {
  tone: 'tone',
  initial: 'start of the syllable',
  final: 'end of the syllable',
  missed: 'not written',
  extra: 'extra, not in the video',
  unknown: 'marked wrong',
};

export interface Verdict {
  /** what was wrong with it; empty when it turned out right */
  kinds: MistakeKind[];
  /** heard right: the tone written is the tone said, and only the dictionary's differs */
  sandhi?: SandhiRule;
  /** the syllable wanted, and what was written, taken apart */
  want?: Syllable;
  wrote?: Syllable;
}

/**
 * A syllable as typed from the notebook: `zhi4`, `zhì`, `zhi`, `lv3`, `nü`.
 * A tone number at the end becomes the mark; no number and no mark is no tone
 * written (null), which is not the same as the neutral tone.
 */
export function readWritten(raw: string): { py: string; tone: number | null } | null {
  let s = raw.trim().toLowerCase().normalize('NFC').replace(/u:|v/g, 'ü');
  if (!s) return null;
  s = s.replace(/[^a-zü1-5āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, '');
  const digit = s.match(/[1-5]$/);
  if (digit) {
    const bare = s.slice(0, -1).replace(/[1-5]/g, '');
    const tone = Number(digit[0]);
    return { py: tone === 5 ? bare : withTone(bare, tone), tone };
  }
  s = s.replace(/[1-5]/g, '');
  if (!s) return null;
  const marked = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(s);
  return { py: s, tone: marked ? parseSyllable(s).tone : null };
}

/**
 * One marked syllable judged: `want` as shown, `wrote` as typed (empty for a
 * gap, undefined when only tapped), and the tone the syllable is said with.
 */
export function judge(want: string, wrote: string | undefined, surface: number, rule?: SandhiRule): Verdict {
  const w = parseSyllable(want);
  if (wrote === undefined) return { kinds: ['unknown'], want: w };
  const typed = readWritten(wrote);
  if (!typed) return { kinds: ['missed'], want: w };
  const got = parseSyllable(typed.py);
  const kinds: MistakeKind[] = [];
  if (got.initial !== w.initial) kinds.push('initial');
  if (got.final !== w.final) kinds.push('final');
  let sandhi: SandhiRule | undefined;
  // A neutral tone has no mark, so writing none is writing it right.
  if (typed.tone === null) {
    if (w.tone !== 5) kinds.push('tone');
  } else if (typed.tone !== w.tone) {
    if (rule && typed.tone === surface) sandhi = rule;
    else kinds.push('tone');
  }
  return { kinds, sandhi, want: w, wrote: got };
}

/** The tones a line is said with, and the rule that changed each, by syllable. */
export function spokenOf(line: Pick<VideoLine, 'zh' | 'py'>) {
  const syl = syllablesOf(line);
  const tones = syl.map((s) => parseSyllable(s).tone);
  return spokenTones(tones, hanOf(line.zh));
}

/* ------------------------------------------------------------ confusions */

/**
 * Which sound lesson a mix-up belongs to — the one that teaches the sound
 * that was *meant*, since that is the one not yet heard.
 */
export function lessonFor(part: 'initial' | 'final', want: Syllable, got: Syllable): string | null {
  if (part === 'initial') {
    const i = want.initial;
    if (['zh', 'ch', 'sh', 'r'].includes(i)) return 'zh';
    if (['j', 'q', 'x'].includes(i)) return 'jqx';
    if (['z', 'c', 's'].includes(i)) return 'zcs';
    if (['b', 'p', 'd', 't', 'g', 'k'].includes(i)) return 'puff';
    // Nothing at the front that should be there, or something that should not.
    if (['j', 'q', 'x'].includes(got.initial)) return 'jqx';
    return null;
  }
  const a = want.final;
  const b = got.final;
  if (a.replace(/ng$/, 'n') === b.replace(/ng$/, 'n') && a !== b) return 'nasal';
  if (a.includes('ü') !== b.includes('ü')) return 'u';
  if (['iou', 'uei', 'uen'].includes(a) || ['iou', 'uei', 'uen'].includes(b)) return 'glide';
  return null;
}

export interface Confusion {
  /** "zh → j", "-ng → -n", "3rd → 2nd tone" */
  key: string;
  label: string;
  lesson: string | null;
  count: number;
}

const ORD = ['', '1st', '2nd', '3rd', '4th', 'neutral'];

/* --------------------------------------------------------------- summary */

export interface CheckSummary {
  total: number;
  right: number;
  /** share right, 0–1 */
  score: number;
  /** right apart from the tone */
  soundsRight: number;
  counts: Record<MistakeKind, number>;
  /** tones written as heard, where the dictionary differs */
  sandhi: number;
  confusions: Confusion[];
  /** each marked syllable's verdict, by "line:syl" (extras by "line:syl+") */
  verdicts: Map<string, Verdict>;
}

export const markKey = (m: Pick<SylMark, 'line' | 'syl' | 'extra'>) => `${m.line}:${m.syl}${m.extra ? '+' : ''}`;

/**
 * Everything a set of marks says about one part.
 *
 * `lines` are the part's lines; a mark's `line` is its index within them.
 * Extras count against the score (something was written that was not said)
 * but not in the total, which stays the number of syllables in the video.
 */
export function summarise(lines: ReadonlyArray<Pick<VideoLine, 'zh' | 'py'>>, marks: readonly SylMark[]): CheckSummary {
  const counts: Record<MistakeKind, number> = { tone: 0, initial: 0, final: 0, missed: 0, extra: 0, unknown: 0 };
  const verdicts = new Map<string, Verdict>();
  const confusions = new Map<string, Confusion>();
  const bump = (key: string, label: string, lesson: string | null) => {
    const had = confusions.get(key);
    if (had) had.count++;
    else confusions.set(key, { key, label, lesson, count: 1 });
  };

  const total = lines.reduce((n, l) => n + syllablesOf(l).length, 0);
  let wrong = 0;
  let toneOnly = 0;
  let sandhi = 0;
  const whole = new Set(marks.filter((m) => m.whole).map((m) => m.line));
  const spoken = lines.map(spokenOf);

  for (const line of whole) {
    const n = lines[line] ? syllablesOf(lines[line]!).length : 0;
    wrong += n;
    counts.missed += n;
  }

  for (const m of marks) {
    if (m.whole || whole.has(m.line)) continue;
    const line = lines[m.line];
    if (!line) continue;
    if (m.extra) {
      counts.extra++;
      verdicts.set(markKey(m), { kinds: ['extra'] });
      continue;
    }
    const want = syllablesOf(line)[m.syl];
    if (!want) continue;
    const said = spoken[m.line]![m.syl];
    const v = judge(want, m.wrote, said?.surface ?? 0, said?.rule);
    verdicts.set(markKey(m), v);
    if (!v.kinds.length) {
      if (v.sandhi) sandhi++;
      continue;
    }
    wrong++;
    for (const k of v.kinds) counts[k]++;
    if (v.kinds.length === 1 && v.kinds[0] === 'tone') toneOnly++;
    if (v.want && v.wrote) {
      if (v.kinds.includes('initial')) {
        const a = v.want.initial || '(none)';
        const b = v.wrote.initial || '(none)';
        bump(`i:${a}>${b}`, `${a} written as ${b}`, lessonFor('initial', v.want, v.wrote));
      }
      if (v.kinds.includes('final')) {
        const a = v.want.final;
        const b = v.wrote.final;
        bump(`f:${a}>${b}`, `-${a} written as -${b}`, lessonFor('final', v.want, v.wrote));
      }
      if (v.kinds.includes('tone') && v.wrote && readWritten(m.wrote ?? '')?.tone !== null) {
        bump(`t:${v.want.tone}>${v.wrote.tone}`, `${ORD[v.want.tone]} tone written as ${ORD[v.wrote.tone]}`, null);
      }
    }
  }

  const right = Math.max(0, total - wrong - counts.extra);
  return {
    total,
    right,
    score: total ? right / total : 0,
    soundsRight: Math.max(0, total - (wrong - toneOnly)),
    counts,
    sandhi,
    confusions: [...confusions.values()].sort((a, b) => b.count - a.count),
    verdicts,
  };
}

/** Line by line: right counts whole, nearly half, wrong nothing. */
export function scoreLines(lines: ReadonlyArray<Pick<VideoLine, 'py'>>, marks: Record<number, LineMark>) {
  let total = 0;
  let right = 0;
  lines.forEach((l, i) => {
    const n = syllablesOf(l).length;
    total += n;
    const m = marks[i];
    if (m === 'right') right += n;
    else if (m === 'close') right += n / 2;
  });
  return { total, right: Math.round(right) };
}

export const scoreOverall = (total: number, answer: number) =>
  Math.round(total * (OVERALL.find((o) => o.id === answer)?.share ?? 0));

/** A check's share right, whichever way it was marked. */
export const checkScore = (c: Pick<DictationCheck, 'right' | 'total'>) => (c.total ? c.right / c.total : 0);

/* --------------------------------------------------------- over time */

/**
 * The sound mix-ups the notebook keeps showing, by lesson, over every check
 * since `since` — for the weak spots. Only detailed checks say what was
 * written, so only they can say what was confused with what.
 */
export function notebookConfusions(
  videos: ReadonlyArray<{ lines: VideoLine[]; parts: Array<{ from: number; to: number }>; checks: DictationCheck[] }>,
  since: number,
): Array<{ lesson: string; count: number; examples: string[] }> {
  const by = new Map<string, { count: number; examples: Set<string> }>();
  for (const v of videos) {
    for (const c of v.checks) {
      if (c.at < since || c.way !== 'detailed' || !c.marks?.length) continue;
      const p = v.parts[c.part];
      if (!p) continue;
      const s = summarise(v.lines.slice(p.from, p.to), c.marks);
      for (const x of s.confusions) {
        if (!x.lesson) continue;
        const had = by.get(x.lesson) ?? { count: 0, examples: new Set<string>() };
        had.count += x.count;
        had.examples.add(x.label);
        by.set(x.lesson, had);
      }
    }
  }
  return [...by.entries()]
    .map(([lesson, x]) => ({ lesson, count: x.count, examples: [...x.examples].slice(0, 3) }))
    .sort((a, b) => b.count - a.count);
}
