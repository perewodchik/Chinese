/**
 * A phrase said aloud and scored by iFlytek's speech evaluation, with the
 * learner's own iFlytek keys: what the page and the server agree on.
 *
 *   GET    /api/eval              are keys kept, their hint, how strict
 *   PUT    /api/eval/key          { appId, apiKey, apiSecret } → tried, then kept
 *   DELETE /api/eval/key          forget them
 *   PATCH  /api/eval/settings     { strictness }
 *   POST   /api/eval              { text, audio } → the phrase scored (audio: 16 kHz 16-bit mono PCM, base64)
 */

export const STRICTNESS = ['easy', 'common', 'hard'] as const;
export type Strictness = (typeof STRICTNESS)[number];

export interface EvalStatus {
  key: { set: boolean; hint: string | null };
  strictness: Strictness;
}

export interface EvalKeys {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

/** How a syllable was said, as iFlytek heard it. */
export interface SyllableEval {
  /** the character */
  char: string;
  /** iFlytek's reading of it: pinyin with the tone as a digit, 5 for neutral (xiao3) */
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
}

export interface EvalResult {
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
}

/** Most of a phrase; longer than any line of a passage. */
export const EVAL_MAX_CHARS = 100;
/** Twenty seconds of 16 kHz 16-bit audio. */
export const EVAL_MAX_BYTES = 20 * 16_000 * 2;
