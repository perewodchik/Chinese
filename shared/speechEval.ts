/**
 * A phrase said aloud and scored by a speech evaluation service — SpeechSuper
 * or iFlytek — with the learner's own keys: what the page and the server agree on.
 *
 *   GET    /api/eval              are keys kept, whose, their hint, how strict
 *   PUT    /api/eval/key          EvalKeys → tried, then kept (in place of any kept before)
 *   DELETE /api/eval/key          forget them
 *   PATCH  /api/eval/settings     { strictness }
 *   POST   /api/eval/attempts     { items: AttemptIn[] } → kept (an id kept already is left as it is)
 *   GET    /api/eval/history      SpeechHistory: every device's tries, as Phrases and the drills need them
 *   GET    /api/eval/attempts     { attempts: AttemptOut[] } newest first: the tries to look back over
 *   GET    /api/eval/attempts/:id { result } the service's whole answer for one try
 *   DELETE /api/eval/attempts/:id { deleted } a try taken back
 *   POST   /api/eval              { text, pinyin?, audio } → the phrase scored (audio: 16 kHz 16-bit mono PCM, base64;
 *                                  pinyin: a numbered syllable per character, ka3, so 卡 in 皮卡丘 is not taken for qia3)
 */

export const STRICTNESS = ['easy', 'common', 'hard'] as const;
export type Strictness = (typeof STRICTNESS)[number];

export const EVAL_PROVIDERS = ['speechsuper', 'iflytek'] as const;
export type EvalProvider = (typeof EVAL_PROVIDERS)[number];
export const PROVIDER_NAME: Record<EvalProvider, string> = { speechsuper: 'SpeechSuper', iflytek: 'iFlytek' };

export interface EvalStatus {
  key: { set: boolean; hint: string | null; provider: EvalProvider | null };
  strictness: Strictness;
}

export interface SpeechSuperKeys {
  provider: 'speechsuper';
  appKey: string;
  secretKey: string;
}

export interface IflytekKeys {
  provider: 'iflytek';
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export type EvalKeys = SpeechSuperKeys | IflytekKeys;

/** How a syllable was said, as the service heard it. The optional parts only SpeechSuper tells. */
export interface SyllableEval {
  /** the character */
  char: string;
  /** its reading: pinyin with the tone as a digit, 5 for neutral (xiao3) */
  symbol: string;
  /** said, or left out, said twice, said over, or something else said in its place */
  said: 'ok' | 'missed' | 'added' | 'repeated' | 'replaced';
  /** the initial (zh, q…) was wrong */
  initial: boolean;
  /** the final (iao, ing…) was wrong */
  final: boolean;
  /** the tone was wrong */
  tone: boolean;
  /** where it was in the recording, ms */
  from: number;
  to: number;
  /** 0–100: the syllable as a whole, its tone, its initial and its final */
  score?: number;
  toneScore?: number;
  initialScore?: number;
  finalScore?: number;
  /** the tone it sounded like (1–4, 5 neutral) */
  heardTone?: number;
  /** the tone it takes here when that is not its own: 不 before a fourth tone, a third before a third */
  sandhi?: number;
  /** what the initial and the final sounded like, when not what they should */
  initialLike?: string;
  finalLike?: string;
  /** a pause came after it, before the next syllable said */
  pause?: boolean;
  /** something not in the text was said just before it */
  extraBefore?: boolean;
}

export interface EvalResult {
  by: EvalProvider;
  /** 0–100 */
  total: number;
  tone: number;
  /** initials and finals */
  sounds: number;
  fluency: number;
  /** how much of the phrase was said */
  completeness: number;
  /** iFlytek judged the recording was not the phrase at all: its scores mean nothing */
  rejected: boolean;
  syllables: SyllableEval[];
  /** SpeechSuper only: the rhythm 0–100, syllables a minute, whether the voice rose or fell at the end */
  rhythm?: number;
  speed?: number;
  ending?: 'rise' | 'fall';
  /** SpeechSuper only: the recording was very quiet */
  quiet?: boolean;
}

/** One character's numbered pinyin, a syllable: ka3, nü3, er5. */
export const PINYIN_SYLLABLE = /^[a-zü]{1,6}[1-5]$/;

/** Most of a phrase; longer than any line of a passage. */
export const EVAL_MAX_CHARS = 100;
/** Twenty seconds of 16 kHz 16-bit audio. */
export const EVAL_MAX_BYTES = 20 * 16_000 * 2;

/**
 * What a try is: a line the learner said in Phrases, a word in a drill, or a
 * narrator's reading of a line scored the same way (its narrator in `tally`),
 * to compare the learner's numbers with.
 */
export type AttemptKind = 'phrase' | 'drill' | 'voice';

/** A try to keep: a line in Phrases or a word in a drill, scored. Its id is the page's, so sending it twice keeps it once. */
export interface AttemptIn {
  id: string;
  at: number;
  kind: AttemptKind;
  sourceId?: string | null;
  text: string;
  /** a drill's tally ("pair:3-3", "tone:2", "say:q"); for a voice, its narrator's id */
  tally?: string | null;
  good: boolean;
  /** the page's short account of the try: its scores and faults */
  summary?: unknown;
  /** the service's whole answer */
  result?: EvalResult;
}

export interface SpeechHistory {
  /** each line's last tries, oldest first: the summaries the page kept */
  phrases: Record<string, Array<{ at: number; summary: unknown }>>;
  /** each drill tally: all tries, how many good, the last ten (1 good), the latest */
  tallies: Record<string, { tries: number; right: number; recent: number[]; last: number }>;
}

export const ATTEMPTS_PER_CALL = 500;

/** A try as it is looked back on: what the page kept of it, without the service's answer. */
export interface AttemptOut {
  id: string;
  at: number;
  kind: AttemptKind;
  sourceId: string | null;
  text: string;
  tally: string | null;
  good: boolean;
  summary: unknown;
  /** whether the service's whole answer is kept for it */
  full: boolean;
}

/** The most tries a look back returns. */
export const ATTEMPTS_LISTED = 2000;
