/**
 * Texts read aloud by a voice service (MiniMax) with the learner's own key:
 * what the page and the server agree on.
 *
 *   GET    /api/narration                     is a key kept, and its last characters
 *   PUT    /api/narration/key  { key }        keep this key (it is tried first)
 *   DELETE /api/narration/key                 forget it
 *   GET    /api/narration/voices              the service's own Mandarin voices
 *   GET    /api/narration/narrators           the learner's narrators
 *   POST   /api/narration/narrators/try       { prompt, previewText, count? } → up to three new voices to choose among, nothing kept
 *   POST   /api/narration/narrators/keep      { name, prompt, previewText, voiceId } → the one chosen, kept as a narrator
 *   POST   /api/narration/narrators           { name, voice } → a narrator with one of the service's voices
 *   PATCH  /api/narration/narrators/:id       { name?, speed?, pitch?, emotion? }
 *   DELETE /api/narration/narrators/:id
 *   POST   /api/narration/narrators/:id/preview { text } → MP3, nothing kept
 *   POST   /api/narration/texts               { narrator, lines, generate?, again? } → the narrator's reading of the text (made when asked)
 *   POST   /api/narration/texts/of            { lines } → every narrator's reading of the text there is
 *   GET    /api/narration/texts/:key/audio    the reading itself, MP3
 *   GET    /api/narration/own                 the learner's own texts read aloud, newest first
 *   POST   /api/narration/own                 { title, narrator, lines } → read now and kept
 *   PATCH  /api/narration/own/:id             { title?, textId? } → renamed, or tied to the Read text made from it
 *   DELETE /api/narration/own/:id             forgotten (its reading stays, for a Read text made from it)
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

/** Voices just made from a description, to choose among; none kept yet. */
export interface TriedVoicesResponse {
  voices: Array<{
    /** the service's id for the new voice */
    voiceId: string;
    /** its first words read in it, MP3 in base64 */
    trial: string;
  }>;
  /** how many of those asked for did not come back */
  failed: number;
}

export interface NarratorChange {
  name?: string;
  speed?: number;
  pitch?: number;
  emotion?: Emotion | null;
}

/** A whole text read by a narrator, kept on the server. */
export interface TextNarrationDto {
  key: string;
  narratorId: string;
  durationMs: number;
  /** where each of the text's lines starts and ends, in milliseconds */
  timings: Array<[number, number]>;
  createdAt: number;
}

/** A text of the learner's own, written in Voices and read aloud there. */
export interface OwnTextDto {
  id: string;
  title: string;
  lines: string[];
  narratorId: string;
  /** null if the reading was lost */
  narration: TextNarrationDto | null;
  /** the text in Read made from it */
  textId: string | null;
  createdAt: number;
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
