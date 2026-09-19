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
): HeardResult {
  const text = heard.replace(PUNCT, '');
  const want = syllables(targetReading);
  const chars = [...text];
  const out = want.map((w, i): HeardSyllable => {
    const ch = chars[i];
    // The r of erhua (哪儿 nǎr) is the end of the syllable before it, not a
    // syllable of its own; there is nothing separate to have heard wrong.
    if (w.bare === 'r') return { want: w.py, got: ch ?? null, off: [] };
    const options = ch ? readings(ch) : [];
    if (!options.length) return { want: w.py, got: null, off: ['initial', 'final'] };
    let best: HeardSyllable | null = null;
    for (const r of options) {
      const g = parseSyllable(r);
      const off: SoundPart[] = [];
      if (g.initial !== w.initial) off.push('initial');
      if (g.final !== w.final) off.push('final');
      if (!best || off.length < best.off.length) best = { want: w.py, got: r, off };
    }
    return best!;
  });
  // More characters than syllables means something extra was heard; that is
  // not a sound error, but the result is not clean either.
  const clean = out.every((s) => s.off.length === 0) && chars.length === want.length;
  return { text, syllables: out, clean };
}

/** The best of several recognition alternatives: the one closest to what was meant. */
export function bestHeard(
  targetReading: string,
  alternatives: string[],
  readings: (ch: string) => string[],
): HeardResult | null {
  let best: HeardResult | null = null;
  const errors = (r: HeardResult) => r.syllables.reduce((n, s) => n + s.off.length, 0);
  for (const a of alternatives) {
    const r = compareHeard(targetReading, a, readings);
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
  return parts.join(', ');
}
