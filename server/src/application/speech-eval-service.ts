import {
  EVAL_MAX_BYTES,
  EVAL_MAX_CHARS,
  PINYIN_SYLLABLE,
  PROVIDER_NAME,
  STRICTNESS,
  ATTEMPTS_LISTED,
  ATTEMPTS_PER_CALL,
  type AttemptOut,
  type AttemptIn,
  type EvalKeys,
  type EvalResult,
  type EvalStatus,
  type SpeechHistory,
  type Strictness,
} from '../../../shared/speechEval';
import { AppError, NotFoundError, ValidationError } from '../domain/errors';
import { EvaluatorRefused } from '../infrastructure/iflytek';
import type { Clock, SecretRepository, SpeechAttemptRepository } from './ports';

const NAME = 'speech-eval';

/** Scores a recording of a text: SpeechSuper or iFlytek, by whose keys they are, or a stand-in in the tests. */
export interface Evaluator {
  evaluate(keys: EvalKeys, o: { text: string; pinyin?: string[]; pcm: Uint8Array; strictness: Strictness }): Promise<EvalResult>;
}

type Kept = EvalKeys & { strictness: Strictness };

const HAN = /\p{Script=Han}/u;

/** Keys trimmed and checked for their shape, or a message saying what they should be. */
function clean(raw: EvalKeys): EvalKeys {
  if (raw.provider === 'speechsuper') {
    const keys = { provider: raw.provider, appKey: raw.appKey.trim(), secretKey: raw.secretKey.trim() };
    if (!/^\w{6,60}$/.test(keys.appKey) || !/^\w{16,80}$/.test(keys.secretKey)) {
      throw new ValidationError('Those do not look like SpeechSuper keys: the appKey and the secretKey from the console.');
    }
    return keys;
  }
  const keys = { provider: raw.provider, appId: raw.appId.trim(), apiKey: raw.apiKey.trim(), apiSecret: raw.apiSecret.trim() };
  if (!/^\w{4,40}$/.test(keys.appId) || !/^\w{8,80}$/.test(keys.apiKey) || !/^[\w=+/-]{8,120}$/.test(keys.apiSecret)) {
    throw new ValidationError('Those do not look like iFlytek keys: the APPID, the APIKey and the APISecret from the console.');
  }
  return keys;
}

/**
 * Phrases said aloud and scored with the learner's own keys — SpeechSuper's
 * or iFlytek's, whichever were saved last.
 *
 * The keys are the learner's and cost them money: kept on the server, tried
 * before they are kept, never sent back to a page — only the end of the app
 * key, so they can tell which it is. How strict the scoring is goes with them.
 */
export class SpeechEvalService {
  constructor(private readonly deps: { secrets: SecretRepository; attempts: SpeechAttemptRepository; evaluator: Evaluator | null; clock: Clock }) {}

  private async kept(userId: string): Promise<Kept | null> {
    const raw = await this.deps.secrets.get(userId, NAME);
    if (!raw) return null;
    try {
      const k = JSON.parse(raw) as Partial<Kept> & Record<string, string>;
      const strictness = STRICTNESS.includes(k.strictness as Strictness) ? (k.strictness as Strictness) : 'common';
      if (k.provider === 'speechsuper' && k.appKey && k.secretKey) return { provider: 'speechsuper', appKey: k.appKey, secretKey: k.secretKey, strictness };
      if (k.provider === 'iflytek' && k.appId && k.apiKey && k.apiSecret) return { provider: 'iflytek', appId: k.appId, apiKey: k.apiKey, apiSecret: k.apiSecret, strictness };
      return null;
    } catch {
      return null;
    }
  }

  private keep(userId: string, k: Kept) {
    return this.deps.secrets.set(userId, NAME, JSON.stringify(k), this.deps.clock.now());
  }

  async status(userId: string): Promise<EvalStatus> {
    const k = await this.kept(userId);
    const hint = k ? `…${(k.provider === 'speechsuper' ? k.appKey : k.apiKey).slice(-4)}` : null;
    return { key: { set: Boolean(k), hint, provider: k?.provider ?? null }, strictness: k?.strictness ?? 'common' };
  }

  /** Kept once the service has let them in: a quarter second of quiet is scored, which needs keys that work. */
  async setKeys(userId: string, raw: EvalKeys): Promise<EvalStatus> {
    const keys = clean(raw);
    const strictness = (await this.kept(userId))?.strictness ?? 'common';
    try {
      await this.evaluator().evaluate(keys, { text: '你好', pcm: new Uint8Array(8000), strictness });
    } catch (err) {
      if (err instanceof EvaluatorRefused && err.reason === 'keys') throw new ValidationError(`${PROVIDER_NAME[keys.provider]} did not accept them. ${err.message}`);
      // Anything else — the quiet itself refused — means the keys were let in.
    }
    await this.keep(userId, { ...keys, strictness });
    return this.status(userId);
  }

  async deleteKeys(userId: string): Promise<EvalStatus> {
    await this.deps.secrets.delete(userId, NAME);
    return this.status(userId);
  }

  async setStrictness(userId: string, strictness: Strictness): Promise<EvalStatus> {
    const k = await this.kept(userId);
    if (!k) throw new NotFoundError('Your pronunciation keys');
    await this.keep(userId, { ...k, strictness });
    return this.status(userId);
  }

  async evaluate(userId: string, o: { text: string; pinyin?: string[]; audio: string }): Promise<EvalResult> {
    const k = await this.kept(userId);
    if (!k) throw new AppError('not_found', 'Add your pronunciation keys first, in Settings.');
    const text = o.text.trim();
    if (!text || [...text].length > EVAL_MAX_CHARS) throw new ValidationError('The phrase is empty or too long to score.');
    const pcm = new Uint8Array(Buffer.from(o.audio, 'base64'));
    if (pcm.length < 3200) throw new ValidationError('Nothing was heard: say the phrase again.');
    if (pcm.length > EVAL_MAX_BYTES) throw new ValidationError('That recording is too long for one phrase.');
    // A reading for every character, or none: one missing would shift the rest onto the wrong characters.
    const chars = [...text].filter((c) => HAN.test(c)).length;
    const pinyin = o.pinyin?.length === chars && o.pinyin.every((p) => PINYIN_SYLLABLE.test(p)) ? o.pinyin : undefined;
    const { strictness, ...keys } = k;
    try {
      return await this.evaluator().evaluate(keys as EvalKeys, { text, pinyin, pcm, strictness });
    } catch (err) {
      if (err instanceof EvaluatorRefused) throw new AppError('unavailable', err.message);
      throw new AppError('unavailable', `${PROVIDER_NAME[k.provider]} did not answer. Try again in a minute.`);
    }
  }

  /** Tries kept for every device; one kept already (by its id) is left as it is. */
  async keepAttempts(userId: string, items: AttemptIn[]): Promise<{ kept: number }> {
    if (items.length > ATTEMPTS_PER_CALL) throw new ValidationError('Too many tries at once.');
    await this.deps.attempts.add(
      items.map((a) => ({
        id: `${userId}:${a.id}`,
        userId,
        at: a.at,
        kind: a.kind,
        sourceId: a.sourceId ?? null,
        text: a.text,
        tally: a.tally ?? null,
        good: a.good,
        summary: a.summary === undefined ? null : JSON.stringify(a.summary),
        result: a.result === undefined ? null : JSON.stringify(a.result),
      })),
    );
    return { kept: items.length };
  }

  /** The tries to look back over, newest first, without the services' answers. */
  async attempts(userId: string, kind?: 'phrase' | 'drill'): Promise<AttemptOut[]> {
    const prefix = `${userId}:`;
    return (await this.deps.attempts.list(userId))
      .filter((a) => !kind || a.kind === kind)
      .reverse()
      .slice(0, ATTEMPTS_LISTED)
      .map((a) => {
        let summary: unknown = null;
        try {
          summary = a.summary ? JSON.parse(a.summary) : null;
        } catch {
          summary = null;
        }
        return { id: a.id.startsWith(prefix) ? a.id.slice(prefix.length) : a.id, at: a.at, kind: a.kind, sourceId: a.sourceId, text: a.text, tally: a.tally, good: a.good, summary, full: a.hasResult };
      });
  }

  /** One try's whole answer from the service, as it was kept. */
  async attemptResult(userId: string, id: string): Promise<{ result: EvalResult }> {
    const a = await this.deps.attempts.find(userId, `${userId}:${id}`);
    if (!a?.result) throw new NotFoundError('That try');
    return { result: JSON.parse(a.result) as EvalResult };
  }

  /** Each line's last five tries, and each drill tally's count, from everything kept. */
  async history(userId: string): Promise<SpeechHistory> {
    const phrases: SpeechHistory['phrases'] = {};
    const tallies: SpeechHistory['tallies'] = {};
    for (const a of await this.deps.attempts.list(userId)) {
      if (a.kind === 'phrase') {
        if (!a.summary) continue;
        let summary: unknown;
        try {
          summary = JSON.parse(a.summary);
        } catch {
          continue;
        }
        (phrases[a.text] ??= []).push({ at: a.at, summary });
        if (phrases[a.text]!.length > 5) phrases[a.text]!.shift();
      } else if (a.tally) {
        const t = (tallies[a.tally] ??= { tries: 0, right: 0, recent: [], last: 0 });
        t.tries += 1;
        if (a.good) t.right += 1;
        t.recent = [...t.recent, a.good ? 1 : 0].slice(-10);
        t.last = Math.max(t.last, a.at);
      }
    }
    return { phrases, tallies };
  }

  private evaluator(): Evaluator {
    if (!this.deps.evaluator) throw new AppError('unavailable', 'This server cannot reach the pronunciation service.');
    return this.deps.evaluator;
  }
}
