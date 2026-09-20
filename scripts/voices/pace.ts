/**
 * How fast a voice is allowed to be talking.
 *
 * A generated voice does not read at a steady pace. Asked for the same
 * sixteen characters twice it will spend twelve seconds on one and seven
 * tenths of a second on the other, and both come back looking like audio: a
 * file with sound in it, the right length to be a sentence if you do not
 * check. Nothing in the pack checked. Of the three hundred sentences Chen
 * shipped, thirty-seven were faster than ten characters a second — not fast
 * speech, a blur with no syllables in it — and forty-four were slower than
 * one, which is a drawl a learner cannot follow either. The middle was fine.
 * It is the spread that makes a voice hard to listen to: you cannot settle
 * into somebody whose next sentence might be twice the speed of this one.
 *
 * So a clip is measured against how long its characters should take, and one
 * that is outside that is said again rather than shipped. The bands are per
 * manner, not per voice: the same person reads a conversation at one pace and
 * teaches at another, and both are right.
 *
 * `speak.py` keeps the same numbers for the voice it makes live, where there
 * is no second chance to ship a better one — it is written out again there
 * rather than imported, the way the model names are.
 */

/** What a voice is doing: talking with somebody, or showing them how a word goes. */
export type Pace = 'talking' | 'teaching';

/**
 * Seconds one Chinese character should take.
 *
 * Talking is 1.8 to 4 characters a second. Native conversation runs nearer
 * five, but this is somebody you are learning from: past four a learner hears
 * a shape rather than words. Teaching is 0.9 to 3.3 — slow enough to hear
 * every tone land, and not so slow that the sentence has fallen apart by the
 * end of it.
 */
export const SECONDS_PER_CHAR: Record<Pace, { least: number; most: number }> = {
  talking: { least: 0.25, most: 0.55 },
  teaching: { least: 0.3, most: 1.1 },
};

/** The breath at either end, and whatever the punctuation is worth: not charged per character. */
const ENDS = 0.35;

const HAN = /[㐀-鿿]/;

/** The characters actually said — punctuation is a pause, not a syllable. */
export const spokenLength = (text: string): number => [...text].filter((c) => HAN.test(c)).length;

/**
 * Whether a clip of this length is somebody talking at that pace, or a blur
 * or a drawl to be said again. A text with no Chinese in it is nobody's
 * business here, so it passes.
 */
export function paced(seconds: number, text: string, pace: Pace): boolean {
  const chars = spokenLength(text);
  if (!chars) return true;
  const { least, most } = SECONDS_PER_CHAR[pace];
  return seconds >= least * chars && seconds <= most * chars + ENDS;
}

/** What to print about a clip that was turned down: the pace it came out at. */
export const charsPerSecond = (seconds: number, text: string): number =>
  seconds > 0 ? spokenLength(text) / seconds : 0;
