/**
 * Cutting a recording into its syllables.
 *
 * The number of syllables is known — it is the word on the screen — so this
 * is not recognition, only alignment: find the voiced stretches, and make
 * there be exactly as many as there should be. Mandarin makes that easier
 * than most languages would: every syllable carries its tone on a voiced
 * vowel, and many initials (b, d, g, j, z, zh, and all the unvoiced ones) put
 * a short gap in the voicing between syllables.
 *
 * Where the voice runs straight through (妈妈, 一样), a stretch is split at
 * its quietest point, which is where one syllable hands over to the next.
 */

export interface Frame {
  t: number;
  hz: number;
  rms: number;
}

export interface Span {
  /** frame indices, inclusive start, exclusive end */
  from: number;
  to: number;
}

/** Shorter than this is a click or a breath, not a syllable. */
const MIN_FRAMES = 6;
/** A gap this short inside a syllable is a glitch, not a boundary. */
const MAX_GAP = 3;

/** The frames that are voice rather than room noise. */
export function voicedMask(frames: Frame[]): boolean[] {
  const loud = Math.max(0, ...frames.map((f) => f.rms));
  const gate = Math.max(loud * 0.08, 0.004);
  return frames.map((f) => f.hz > 0 && f.rms >= gate);
}

export function voicedSpans(frames: Frame[]): Span[] {
  const mask = voicedMask(frames);
  const spans: Span[] = [];
  let start = -1;
  for (let i = 0; i <= mask.length; i++) {
    if (i < mask.length && mask[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      spans.push({ from: start, to: i });
      start = -1;
    }
  }
  // Close glitches, then drop what is too short to be a syllable.
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.from - last.to <= MAX_GAP) last.to = s.to;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.to - s.from >= MIN_FRAMES);
}

/**
 * Exactly `n` spans, or null when the recording plainly is not `n` syllables
 * (nothing voiced at all).
 *
 * Too many: the two separated by the shortest gap are joined, repeatedly —
 * a vowel broken by a creaky third tone is the usual cause. Too few: the
 * longest is split at its quietest frame, repeatedly.
 */
export function alignSyllables(frames: Frame[], n: number): Span[] | null {
  let spans = voicedSpans(frames);
  if (!spans.length || n < 1) return null;

  while (spans.length > n) {
    let best = 0;
    for (let i = 1; i < spans.length - 1; i++) {
      if (spans[i + 1]!.from - spans[i]!.to < spans[best + 1]!.from - spans[best]!.to) best = i;
    }
    spans = [
      ...spans.slice(0, best),
      { from: spans[best]!.from, to: spans[best + 1]!.to },
      ...spans.slice(best + 2),
    ];
  }

  while (spans.length < n) {
    let longest = 0;
    spans.forEach((s, i) => {
      if (s.to - s.from > spans[longest]!.to - spans[longest]!.from) longest = i;
    });
    const s = spans[longest]!;
    if (s.to - s.from < MIN_FRAMES * 2) break;
    // Look for the dip in the middle 60%, so a split never leaves a sliver.
    const lo = s.from + Math.floor((s.to - s.from) * 0.2);
    const hi = s.to - Math.floor((s.to - s.from) * 0.2);
    let cut = lo;
    for (let i = lo; i < hi; i++) if (frames[i]!.rms < frames[cut]!.rms) cut = i;
    spans = [...spans.slice(0, longest), { from: s.from, to: cut }, { from: cut, to: s.to }, ...spans.slice(longest + 1)];
  }
  return spans.length === n ? spans : null;
}
