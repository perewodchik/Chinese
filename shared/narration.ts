/**
 * Texts read aloud by a voice service (MiniMax) with the learner's own key:
 * what the page and the server agree on.
 *
 *   GET    /api/narration                     is a key kept, and its last characters
 *   PUT    /api/narration/key  { key }        keep this key (it is tried first)
 *   DELETE /api/narration/key                 forget it
 *   GET    /api/narration/voices              the service's own Mandarin voices
 *   GET    /api/narration/narrators           the learner's narrators
 *   POST   /api/narration/narrators/design    { name, prompt, previewText } → a narrator with a new voice, and its first words
 *   POST   /api/narration/narrators           { name, voice } → a narrator with one of the service's voices
 *   PATCH  /api/narration/narrators/:id       { name?, speed?, pitch?, emotion? }
 *   DELETE /api/narration/narrators/:id
 *   POST   /api/narration/narrators/:id/preview { text } → MP3, nothing kept
 *   POST   /api/narration/line               { narrator, text, again? } → one sentence read and kept
 */

export interface NarrationStatus {
  key: { set: boolean; hint: string | null };
}

/** One of the service's own voices. */
export interface NarratorVoice {
  /** the service's id: "Chinese (Mandarin)_News_Anchor" */
  id: string;
  /** its display name: "News Anchor (Female)" */
  name: string;
  description: string;
  gender: 'female' | 'male';
}

/** The emotions the service can read in; null lets it follow the text. */
export const EMOTIONS = ['calm', 'happy', 'sad', 'surprised', 'angry', 'fearful'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** A narrator the learner made: who reads their texts aloud, and how. */
export interface NarratorDto {
  id: string;
  name: string;
  kind: 'designed' | 'system';
  /** the service's voice */
  voiceId: string;
  /** what a designed voice was made from */
  prompt: string;
  previewText: string;
  speed: number;
  pitch: number;
  emotion: Emotion | null;
  /** the id its recordings are kept under, as Listen offers them */
  recordingId: string;
  createdAt: number;
}

export interface DesignNarratorRequest {
  name: string;
  prompt: string;
  previewText: string;
}

export interface DesignNarratorResponse {
  narrator: NarratorDto;
  /** the preview sentence read in the new voice, MP3 in base64 */
  trial: string;
}

export interface NarratorChange {
  name?: string;
  speed?: number;
  pitch?: number;
  emotion?: Emotion | null;
}

export interface NarrateLineRequest {
  narrator: string;
  text: string;
  /** read it again even if it was read before (after the narrator changed) */
  again?: boolean;
}

export interface NarrateLineResponse {
  /** the voice the recording is kept under, as Listen offers it */
  recordedAs: string;
}

export const SPEED_RANGE = [0.5, 2] as const;
export const PITCH_RANGE = [-12, 12] as const;

/** A recorded voice's id in the app, from a narrator's: lower case, dashes. */
export const narratorRecordingId = (narrator: string) =>
  `mm-${narrator.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.slice(0, 64);

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
