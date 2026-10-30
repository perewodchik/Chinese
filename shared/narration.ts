/**
 * Texts read aloud by a voice service (MiniMax) with the learner's own key:
 * what the page and the server agree on.
 *
 *   GET    /api/narration                 is a key kept, and its last characters
 *   PUT    /api/narration/key  { key }    keep this key (it is tried first)
 *   DELETE /api/narration/key             forget it
 *   GET    /api/narration/voices          the service's Mandarin voices
 *   POST   /api/narration/line { voice, text, slow }  read one sentence and keep the recording
 */

export interface NarrationStatus {
  key: { set: boolean; hint: string | null };
}

export interface NarratorVoice {
  /** the service's id: "Chinese (Mandarin)_News_Anchor" */
  id: string;
  /** its display name: "News Anchor (Female)" */
  name: string;
  description: string;
  gender: 'female' | 'male';
}

export interface NarrateLineRequest {
  voice: string;
  text: string;
  /** read a little slower, for a learner */
  slow?: boolean;
}

export interface NarrateLineResponse {
  /** the voice the recording is kept under, as Listen offers it */
  recordedAs: string;
}

/** The voice a text is read in when nobody has chosen: clear, calm, Mandarin. */
export const DEFAULT_NARRATOR = 'Chinese (Mandarin)_News_Anchor';

/** A recorded voice's id in the app, from the service's: lower case, dashes. */
export const narratorRecordingId = (voice: string) =>
  `mm-${voice.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 64);

const SOUNDS: Array<[RegExp, string]> = [
  [/哈哈|大笑/, '(laughs)'],
  [/笑/, '(chuckle)'],
  [/叹气/, '(sighs)'],
  [/打喷嚏|阿嚏/, '(sneezes)'],
  [/咳/, '(coughs)'],
];

/**
 * The sound a sentence says it makes, as the service's tag, if any. A tag
 * goes only where the sentence itself says the sound happens: a sigh the
 * text does not mention is a sound the learner hears without reading.
 */
export function soundOf(zh: string): string | null {
  for (const [re, tag] of SOUNDS) if (re.test(zh)) return tag;
  return null;
}
