import { judge, rangeOf, toChao, type Judged, type VoiceRange } from './contour';
import type { Spoken } from './sandhi';
import { alignSyllables, voicedMask, type Frame, type Span } from './segment';

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
  // Only frames loud enough to be voice. A pitch tracker will find a "pitch"
  // in the hiss of a quiet room, and one stray 400 Hz in the silence after a
  // word stretches the range until the word itself looks flat.
  const mask = voicedMask(frames);
  const range = calibrated ?? rangeOf(frames.filter((_, i) => mask[i]).map((f) => f.hz));
  const line = frames.map((f, i) => ({ t: f.t, chao: mask[i] ? toChao(f.hz, range) : NaN }));

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
 * The melody of a whole phrase: its voiced frames on the speaker's scale,
 * without trying to find the syllables in it. For sentences, where the shape
 * is worth comparing and the syllable boundaries are not worth guessing at.
 */
export function melody(frames: Frame[], calibrated: VoiceRange | null): Array<{ t: number; chao: number }> {
  const hz = cleanPitch(frames);
  const range = calibrated ?? rangeOf(hz.filter((f) => f > 0));
  return frames.map((f, i) => ({ t: f.t, chao: hz[i]! > 0 ? toChao(hz[i]!, range) : NaN }));
}

/** Frames either side a frame is checked against: a tenth of a second. */
const NEIGHBOURS = 10;
/** Further than this from the frames around it, in semitones, is the tracker and not the voice. */
const JUMP = 5;
/** A step bigger than this between the last two frames of a run, in semitones, is the edge catching something else. */
const EDGE = 3;
/** A run of voice shorter than this, in frames, is a click or a breath. */
const SHORTEST = 4;

/**
 * The pitch of a whole sentence as a listener hears it: the voiced frames,
 * with what the tracker got wrong taken out, and 0 where there is no voice.
 *
 * Over a sentence the tracker makes two kinds of mistake, and both look like
 * tones. It locks on to an overtone for a few frames — 不好意思's 意 read at
 * 405 Hz between 171 and 235 — which draws a block at the top of the staff;
 * and it catches the burst of a consonant or the voice trailing away as a
 * spike at either end of a run. Neither can be averaged away without
 * flattening the real tones along with them. What gives them away is that a
 * voice cannot do it: even a fourth tone falling as fast as it can stays
 * within two or three semitones of the tenth of a second around it. So each
 * frame is held against the median of its neighbours and left out when it
 * is more than five semitones off; what is left is run through a
 * three-frame median, which takes out jitter and keeps a slope a slope.
 */
export function cleanPitch(frames: Frame[]): number[] {
  const mask = voicedMask(frames);
  const st = frames.map((f, i) => (mask[i] && f.hz > 0 ? 12 * Math.log2(f.hz) : NaN));
  const median = (xs: number[]) => {
    const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)]! : NaN;
  };

  // Out of line with the voice around it — twice. A block of overtone frames
  // pulls the median of a short window up with it, and then the real frames
  // beside it look like the outliers; so the gross mistakes go first,
  // against a wider window, and the finer check runs on what is left.
  const outOfLine = (xs: number[], reach: number, limit: number) =>
    xs.map((x, i) => {
      if (!Number.isFinite(x)) return NaN;
      const around = median(xs.slice(Math.max(0, i - reach), i + reach + 1));
      return Math.abs(x - around) > limit ? NaN : x;
    });
  const kept = outOfLine(outOfLine(st, NEIGHBOURS * 2.5, JUMP + 2), NEIGHBOURS, JUMP);

  // Jitter, without rounding off the shape.
  const smooth = kept.map((x, i) =>
    Number.isFinite(x) ? median([kept[i - 1] ?? NaN, x, kept[i + 1] ?? NaN].map((v) => (Number.isFinite(v) ? v : x))) : NaN,
  );

  // The ends of each run, where the tracker catches the consonant going in
  // and the voice going out: a first or last frame that leaps away from the
  // one beside it is not part of the syllable. Taken off until the edge sits
  // in line.
  for (let i = 0; i < smooth.length; i++) {
    if (!Number.isFinite(smooth[i]!)) continue;
    let a = i;
    let b = i;
    while (b + 1 < smooth.length && Number.isFinite(smooth[b + 1]!)) b++;
    while (a < b && Math.abs(smooth[a]! - smooth[a + 1]!) > EDGE) smooth[a++] = NaN;
    while (b > a && Math.abs(smooth[b]! - smooth[b - 1]!) > EDGE) smooth[b--] = NaN;
    i = b;
  }

  // Whatever is left too short to be a syllable's worth of voice.
  const out = smooth.map((x) => (Number.isFinite(x) ? 2 ** (x / 12) : 0));
  for (let i = 0; i < out.length; ) {
    if (!out[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j]) j++;
    if (j - i < SHORTEST) out.fill(0, i, j);
    i = j;
  }
  return out;
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
  const mask = voicedMask(frames);
  const hz = frames
    .filter((f, i) => mask[i] && f.hz > 0)
    .map((f) => f.hz)
    .sort((a, b) => a - b);
  if (hz.length < 30) return null;
  const q = (p: number) => hz[Math.floor(p * (hz.length - 1))]!;
  const floorHz = q(0.05);
  const ceilHz = q(0.95);
  // Less than half an octave between mā and mǎ is not a voice range; it is a
  // calibration that did not work.
  if (12 * Math.log2(ceilHz / floorHz) < 5) return null;
  return { floorHz, ceilHz };
}
