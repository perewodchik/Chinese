/**
 * A face for each voice.
 *
 * Talking to a voice that has no face is talking to a loudspeaker: you wait
 * for it, you do not answer it. A face fixes the half-second before the
 * sound — you can see it listening, thinking, and starting to speak — and
 * that is what turns a turn-taking exercise into a conversation. The whole
 * point of the section is saying things out loud to somebody.
 *
 * The faces are drawn, not photographed, and drawn in the app's own ink:
 * a portrait built from a dozen numbers in `Portrait.tsx` rather than an
 * image file. That is deliberate and it is the same rule the voices
 * themselves are made under — Chen is a kind of voice, not a copy of
 * anyone's — so his face is a kind of face, not a likeness of anyone. It
 * also means a face costs nothing to ship, follows the theme into the dark,
 * and stays sharp at any size.
 *
 * Everything here is data and arithmetic: no React, no DOM, so the curves
 * the mouth is driven by can be tested on their own.
 */

/** How the hair is worn. Each one is a different pair of paths in `Portrait.tsx`. */
export type Hair = 'long' | 'bob' | 'wave' | 'bun' | 'crop' | 'part' | 'fringe';

/** What one voice looks like. The colours are indices, so the tokens stay in the stylesheet. */
export interface Look {
  hair: Hair;
  /** which of the three face tokens */
  skin: 1 | 2 | 3;
  /** which of the five collar tokens */
  cloth: 1 | 2 | 3 | 4 | 5;
  glasses: boolean;
  earrings: boolean;
  /**
   * Drawn soft: a rounder face, eyes twice the size with the light caught in
   * them, a flick of colour on the cheeks and a strand of hair that will not
   * lie down. It is the look Chinese comics give a boy you are meant to like,
   * and it is reserved for the voice you actually talk to — the others are
   * people in a list, and a list of wide-eyed faces is a cartoon, not a menu.
   */
  cute: boolean;
  /**
   * Seconds this face is out of step with the others by. Two faces on one
   * screen blinking together look like one puppet worked by one string.
   */
  beat: number;
}

/**
 * The voices the pack ships with, each given a look of their own, told apart
 * by hair, collar and the rest rather than by a label — the point of a face
 * is that you know who it is before you have read anything. There are two of
 * them and a machine; a voice added later is drawn from its id.
 */
const KNOWN: Readonly<Record<string, Look>> = {
  // The designed voice: the one you talk to, and the one that reads a word
  // through when you ask for it slowly. It is also the only face drawn soft —
  // the one that leans in, nods along and goes pink while it is the one
  // talking.
  chen: { hair: 'fringe', skin: 1, cloth: 3, glasses: true, earrings: false, cute: true, beat: 0 },
  // The syllable recordings are a real person's, so this one is the plainest
  // face of the set rather than a character.
  native: { hair: 'bun', skin: 3, cloth: 5, glasses: false, earrings: true, cute: false, beat: 5.3 },
};

/** The system voice is not a person and is not drawn as one. */
export const SYSTEM_FACE = 'system';

// Chen's fringe is drawn for Chen and is not in either pool: a face worked
// out from an id is a stranger in a list, and should not turn up wearing the
// hair of the one you have been talking to.
const FEMALE: Hair[] = ['long', 'bob', 'wave', 'bun'];
const MALE: Hair[] = ['crop', 'part'];

/** Small, stable, and enough to spread a handful of ids over a handful of looks. */
function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * The face for a voice: the one it was drawn with if it is one of the pack's,
 * and otherwise one worked out from its id — so a voice added to the pack
 * later still arrives with a face, and keeps the same one every time.
 */
export function lookFor(voice: string, gender?: 'female' | 'male'): Look {
  const known = KNOWN[voice];
  if (known) return known;
  const n = hash(voice);
  const hairs = gender === 'male' ? MALE : gender === 'female' ? FEMALE : [...FEMALE, ...MALE];
  return {
    hair: hairs[n % hairs.length]!,
    skin: ((n >> 3) % 3) + 1 as 1 | 2 | 3,
    cloth: ((n >> 5) % 5) + 1 as 1 | 2 | 3 | 4 | 5,
    glasses: ((n >> 8) & 1) === 1,
    earrings: gender !== 'male' && ((n >> 9) & 1) === 1,
    cute: false,
    beat: ((n >> 11) % 60) / 10,
  };
}

/** Under this much sound there is nothing being said, only the room. */
export const SILENT = 0.0015;

const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * How far the mouth is open for a loudness, 0 shut to 1 wide.
 *
 * Loudness is roughly logarithmic to the ear, and a mouth that follows the
 * raw amplitude barely moves on ordinary speech and then slams open on a
 * vowel. The same curve the record button's ring swells on, so the two agree
 * about what loud means.
 */
export function mouthOpen(level: number): number {
  return clamp((Math.log10(level + 1e-4) + 3.2) / 2.4);
}

/**
 * A mouth for a voice the page cannot hear.
 *
 * The system voice speaks through the operating system and never passes
 * through the page, so there is no waveform to follow — but a face that
 * holds still while its words come out is worse than one making plausible
 * shapes. Three waves that do not divide into each other, so the mouth never
 * falls into a visible loop, and dips below shut often enough to look like
 * speech rather than chewing.
 */
export function chatter(ms: number): number {
  const t = ms / 1000;
  const wave = Math.sin(t * 13.1) * 0.5 + Math.sin(t * 7.3 + 1.1) * 0.3 + Math.sin(t * 3.1 + 2.2) * 0.2;
  return clamp(0.42 + wave * 0.58);
}
