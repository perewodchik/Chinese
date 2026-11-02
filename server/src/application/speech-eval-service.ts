import { EVAL_MAX_BYTES, EVAL_MAX_CHARS, STRICTNESS, type EvalKeys, type EvalResult, type EvalStatus, type Strictness } from '../../../shared/speechEval';
import { AppError, NotFoundError, ValidationError } from '../domain/errors';
import { EvaluatorRefused } from '../infrastructure/iflytek';
import type { Clock, SecretRepository } from './ports';

const NAME = 'iflytek';

/** Scores a recording of a text: iFlytek, or a stand-in in the tests. */
export interface Evaluator {
  evaluate(keys: EvalKeys, o: { text: string; pcm: Uint8Array; strictness: Strictness }): Promise<EvalResult>;
}

interface Kept extends EvalKeys {
  strictness: Strictness;
}

/**
 * Phrases said aloud and scored by iFlytek with the learner's own keys.
 *
 * The keys are the learner's and cost them money: kept on the server, tried
 * before they are kept, never sent back to a page — only the end of the API
 * key, so they can tell which it is. How strict the scoring is goes with them.
 */
export class SpeechEvalService {
  constructor(private readonly deps: { secrets: SecretRepository; evaluator: Evaluator | null; clock: Clock }) {}

  private async kept(userId: string): Promise<Kept | null> {
    const raw = await this.deps.secrets.get(userId, NAME);
    if (!raw) return null;
    try {
      const k = JSON.parse(raw) as Partial<Kept>;
      if (!k.appId || !k.apiKey || !k.apiSecret) return null;
      return { appId: k.appId, apiKey: k.apiKey, apiSecret: k.apiSecret, strictness: STRICTNESS.includes(k.strictness as Strictness) ? k.strictness! : 'common' };
    } catch {
      return null;
    }
  }

  private keep(userId: string, k: Kept) {
    return this.deps.secrets.set(userId, NAME, JSON.stringify(k), this.deps.clock.now());
  }

  async status(userId: string): Promise<EvalStatus> {
    const k = await this.kept(userId);
    return { key: { set: Boolean(k), hint: k ? `…${k.apiKey.slice(-4)}` : null }, strictness: k?.strictness ?? 'common' };
  }

  /** Kept once iFlytek has accepted them: a quarter second of quiet is scored, which needs keys that work. */
  async setKeys(userId: string, raw: EvalKeys): Promise<EvalStatus> {
    const keys = { appId: raw.appId.trim(), apiKey: raw.apiKey.trim(), apiSecret: raw.apiSecret.trim() };
    if (!/^\w{4,40}$/.test(keys.appId) || !/^\w{8,80}$/.test(keys.apiKey) || !/^[\w=+/-]{8,120}$/.test(keys.apiSecret)) {
      throw new ValidationError('Those do not look like iFlytek keys: the APPID, the APIKey and the APISecret from the console.');
    }
    const strictness = (await this.kept(userId))?.strictness ?? 'common';
    try {
      await this.evaluator().evaluate(keys, { text: '你好', pcm: new Uint8Array(8000), strictness });
    } catch (err) {
      if (err instanceof EvaluatorRefused && err.reason === 'keys') throw new ValidationError(`iFlytek did not accept them. ${err.message}`);
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
    if (!k) throw new NotFoundError('Your iFlytek keys');
    await this.keep(userId, { ...k, strictness });
    return this.status(userId);
  }

  async evaluate(userId: string, o: { text: string; audio: string }): Promise<EvalResult> {
    const k = await this.kept(userId);
    if (!k) throw new AppError('not_found', 'Add your iFlytek keys first, in Settings.');
    const text = o.text.trim();
    if (!text || [...text].length > EVAL_MAX_CHARS) throw new ValidationError('The phrase is empty or too long to score.');
    const pcm = new Uint8Array(Buffer.from(o.audio, 'base64'));
    if (pcm.length < 3200) throw new ValidationError('Nothing was heard: say the phrase again.');
    if (pcm.length > EVAL_MAX_BYTES) throw new ValidationError('That recording is too long for one phrase.');
    try {
      return await this.evaluator().evaluate(k, { text, pcm, strictness: k.strictness });
    } catch (err) {
      if (err instanceof EvaluatorRefused) throw new AppError('unavailable', err.message);
      throw new AppError('unavailable', 'iFlytek did not answer. Try again in a minute.');
    }
  }

  private evaluator(): Evaluator {
    if (!this.deps.evaluator) throw new AppError('unavailable', 'This server cannot reach iFlytek.');
    return this.deps.evaluator;
  }
}
