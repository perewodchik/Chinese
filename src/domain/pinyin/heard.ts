import { parseSyllable, syllables } from './syllable';

/**
 * What speech recognition heard, set against what was meant — sound by
 * sound, not character by character.
 *
 * Recognition writes characters, and characters are the wrong thing to
 * compare: 是 and 事 are the same sound, and hearing one for the other says
 * nothing about your mouth. So both sides are turned into syllables and only
 * the initial and final are compared. Tone is left out on purpose — the
 * recogniser guesses tones from context, and the pitch check does tones
 * properly.
 */

export type SoundPart = 'initial' | 'final';

export interface HeardSyllable {
  /** the syllable that was meant */
  want: string;
  /** what was heard in its place, or null where nothing lines up */
  got: string | null;
  /** which parts came out differently */
  off: SoundPart[];
  /**
   * The word it was heard as has another tone. Not a verdict on the pitch —
   * the pitch check does that — but on what a listener took away: 买 heard
   * where 卖 was meant is a different word, whatever the chart looked like.
   */
  toneOff: boolean;
}

export interface HeardResult {
  /** the recognised text, punctuation removed */
  text: string;
  syllables: HeardSyllable[];
  /** every syllable's initial and final came out as meant */
  clean: boolean;
}

const PUNCT = /[\s，。！？、,.!?；;：:“”"'‘’…]/g;

/**
 * `readings(ch)` gives every reading of a character, most common first; a
 * heard character with several readings is taken in whichever one is
 * closest to what was meant, since recognition cannot tell 了 le from 了 liǎo
 * either.
 */
export function compareHeard(
  targetReading: string,
  heard: string,
  readings: (ch: string) => string[],
  /** the characters meant, where known: hearing the very character meant is hearing it right */
  targetText?: string,
): HeardResult {
  const text = heard.replace(PUNCT, '');
  const want = syllables(targetReading);
  const chars = [...text];
  const meant = targetText ? [...targetText.replace(PUNCT, '')] : [];
  const out = want.map((w, i): HeardSyllable => {
    const ch = chars[i];
    // The dictionary does not know every reading a word gives a character —
    // it has 便 as biàn only, and 便宜 is pián yi — so the character that was
    // meant is taken as said the way it was meant.
    if (ch && ch === meant[i]) return { want: w.py, got: w.py, off: [], toneOff: false };
    // The r of erhua (哪儿 nǎr) is the end of the syllable before it, not a
    // syllable of its own; there is nothing separate to have heard wrong.
    if (w.bare === 'r') return { want: w.py, got: ch ?? null, off: [], toneOff: false };
    const options = ch ? readings(ch) : [];
    if (!options.length) return { want: w.py, got: null, off: ['initial', 'final'], toneOff: true };
    let best: HeardSyllable | null = null;
    const cost = (h: HeardSyllable) => h.off.length * 2 + (h.toneOff ? 1 : 0);
    for (const r of options) {
      const g = parseSyllable(r);
      const off: SoundPart[] = [];
      if (g.initial !== w.initial) off.push('initial');
      if (g.final !== w.final) off.push('final');
      // A neutral tone has no tone of its own to get wrong, and a dictionary
      // reading is always a full one (便宜's 宜 is yí): any tone will do there.
      const toneOff = w.tone !== 5 && g.tone !== 5 && g.tone !== w.tone;
      const h = { want: w.py, got: r, off, toneOff };
      if (!best || cost(h) < cost(best)) best = h;
    }
    return best!;
  });
  // More characters than syllables means something extra was heard; that is
  // not a sound error, but the result is not clean either.
  const clean = out.every((s) => s.off.length === 0) && chars.length === want.length;
  return { text, syllables: out, clean };
}

/**
 * Would a listener have got it: every word heard as the word that was meant,
 * sounds and tones — or, simpler still, exactly the sentence that was meant.
 *
 * Recognition listens the way a person does, with the sentence around each
 * word, so a tone that is a little off where context makes the word obvious
 * still gets through, as it would in a conversation. One that makes it hear
 * a different word does not.
 */
export function understood(result: HeardResult | null, targetText: string): boolean {
  if (!result) return false;
  if (result.text === targetText.replace(PUNCT, '')) return true;
  return result.clean && result.syllables.every((s) => !s.toneOff);
}

/** Heard as another sound, or as the same sound with another tone: either way, not the word meant. */
export const missed = (s: HeardSyllable | undefined) => !!s && (s.off.length > 0 || s.toneOff);

/** The share of a sentence's syllables that came through as meant. */
export const heardShare = (h: HeardResult) =>
  h.syllables.length ? h.syllables.filter((s) => !missed(s)).length / h.syllables.length : 0;

/** The best of several recognition alternatives: the one closest to what was meant. */
export function bestHeard(
  targetReading: string,
  alternatives: string[],
  readings: (ch: string) => string[],
  targetText?: string,
): HeardResult | null {
  let best: HeardResult | null = null;
  const errors = (r: HeardResult) => r.syllables.reduce((n, s) => n + s.off.length * 2 + (s.toneOff ? 1 : 0), 0);
  for (const a of alternatives) {
    const r = compareHeard(targetReading, a, readings, targetText);
    if (!best || errors(r) < errors(best)) best = r;
  }
  return best;
}

/** What a miss means, in words: "q heard as ch". */
export function describeMiss(s: HeardSyllable): string {
  if (!s.got) return 'not heard';
  const w = parseSyllable(s.want);
  const g = parseSyllable(s.got);
  const parts: string[] = [];
  if (s.off.includes('initial')) parts.push(`${w.initial || '—'} heard as ${g.initial || '—'}`);
  if (s.off.includes('final')) parts.push(`${w.final} heard as ${g.final}`);
  if (!parts.length && s.toneOff) parts.push(`heard as ${s.got}, another tone`);
  return parts.join(', ');
}
