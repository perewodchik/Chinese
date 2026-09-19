import { judge, rangeOf, toChao, type Judged, type VoiceRange } from './contour';
import type { Spoken } from './sandhi';
import { alignSyllables, type Frame, type Span } from './segment';

/**
 * One attempt at a word, taken apart and marked.
 *
 * Everything the screen needs to draw the attempt and say what to change:
 * where each syllable was heard, the voice as a line on the speaker's scale,
 * and a verdict per syllable against the tone that should have been said.
 */
export interface Attempt {
  /** the recording's duration, seconds */
  duration: number;
  /** the whole voice line, Chao scale, NaN where unvoiced — one per frame */
  line: Array<{ t: number; chao: number }>;
  /** one per expected syllable, or empty when the syllables could not be found */
  syllables: Array<{ from: number; to: number; judged: Judged }>;
  /** the range the voice was measured against */
  range: VoiceRange;
  /** true when the range came from this recording rather than calibration */
  selfScaled: boolean;
  /** why nothing could be judged, when that is the case */
  problem?: 'silent' | 'count';
}

export function analyse(frames: Frame[], expected: Spoken[], calibrated: VoiceRange | null): Attempt {
  const duration = frames.length ? frames[frames.length - 1]!.t : 0;
  const voiced = frames.map((f) => f.hz);
  const range = calibrated ?? rangeOf(voiced);
  const line = frames.map((f) => ({ t: f.t, chao: f.hz > 0 ? toChao(f.hz, range) : NaN }));

  const spans: Span[] | null = alignSyllables(frames, expected.length);
  if (!spans) {
    const anyVoice = frames.some((f) => f.hz > 0);
    return { duration, line, syllables: [], range, selfScaled: !calibrated, problem: anyVoice ? 'count' : 'silent' };
  }

  const syllables = spans.map((s, i) => {
    const chao = line.slice(s.from, s.to).map((p) => p.chao);
    return {
      from: frames[s.from]!.t,
      to: frames[Math.max(s.from, s.to - 1)]!.t,
      judged: judge(chao, expected[i]!.surface),
    };
  });
  return { duration, line, syllables, range, selfScaled: !calibrated };
}

/**
 * A voice range from a calibration: the learner says mā má mǎ mà.
 *
 * The bottom of their third tone is the bottom of the range and the top of
 * their first and fourth is the top — which is exactly what the scale means,
 * so it is measured rather than guessed. The 5th and 95th percentiles rather
 * than the extremes, so one creak or squeak does not stretch it.
 */
export function calibrate(frames: Frame[]): VoiceRange | null {
  const hz = frames.filter((f) => f.hz > 0).map((f) => f.hz).sort((a, b) => a - b);
  if (hz.length < 30) return null;
  const q = (p: number) => hz[Math.floor(p * (hz.length - 1))]!;
  const floorHz = q(0.05);
  const ceilHz = q(0.95);
  // Less than half an octave between mā and mǎ is not a voice range; it is a
  // calibration that did not work.
  if (12 * Math.log2(ceilHz / floorHz) < 5) return null;
  return { floorHz, ceilHz };
}
