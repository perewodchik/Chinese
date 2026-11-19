import { BrokenKeys } from './broken-keys';
import {
  EVAL_MAX_BYTES,
  EVAL_MAX_CHARS,
  PINYIN_SYLLABLE,
  PROVIDER_NAME,
  STRICTNESS,
  ATTEMPTS_LISTED,
  ATTEMPTS_PER_CALL,
  type AttemptKind,
  type AttemptOut,
  type AttemptIn,
  type EvalKeys,
  type EvalResult,
  type EvalStatus,
  type SpeechHistory,
  type Strictness,
} from '../../../shared/speechEval';
import { AppError, NotFoundError, ValidationError } from '../domain/errors';
import { EvaluatorRefused } from '../infrastructure/evaluator-refused';
import type { Clock, SecretRepository, SpeechAttemptRepository } from './ports';
import type { StorageQuota } from './storage-quota';
import type { UsageMeter } from './usage-service';

const NAME = 'speech-eval';

/** Scores a recording of a text: SpeechSuper, or a stand-in in the tests. */
export interface Evaluator {
  evaluate(keys: EvalKeys, o: { text: string; pinyin?: string[]; pcm: Uint8Array; strictness: Strictness }): Promise<EvalResult>;
}

type Kept = EvalKeys & { strictness: Strictness };

const HAN = /\p{Script=Han}/u;

/** Keys trimmed and checked for their shape, or a message saying what they should be. */
function clean(raw: EvalKeys): EvalKeys {
  const keys: EvalKeys = { provider: 'speechsuper', appKey: raw.appKey.trim(), secretKey: raw.secretKey.trim() };
  if (!/^\w{6,60}$/.test(keys.appKey) || !/^\w{16,80}$/.test(keys.secretKey)) {
    throw new ValidationError('Those do not look like SpeechSuper keys: the appKey and the secretKey from the console.');
  }
  return keys;
}

/**
 * Phrases said aloud and scored with the learner's own SpeechSuper keys.
 * Keys of another service saved before (iFlytek, gone) read as none.
 *
 * The keys are the learner's and cost them money: kept on the server, tried
 * before they are kept, never sent back to a page — only the end of the app
 * key, so they can tell which it is. How strict the scoring is goes with them.
 */
export class SpeechEvalService {
  constructor(private readonly deps: { secrets: SecretRepository; attempts: SpeechAttemptRepository; evaluator: Evaluator | null; clock: Clock; meter?: UsageMeter; quota?: StorageQuota }) {}

  private async kept(userId: string): Promise<Kept | null> {
    const raw = await this.deps.secrets.get(userId, NAME);
    if (!raw) return null;
    try {
      const k = JSON.parse(raw) as Partial<Kept> & Record<string, string>;
      const strictness = STRICTNESS.includes(k.strictness as Strictness) ? (k.strictness as Strictness) : 'common';
      if (k.provider === 'speechsuper' && k.appKey && k.secretKey) return { provider: 'speechsuper', appKey: k.appKey, secretKey: k.secretKey, strictness };
      return null;
    } catch {
      return null;
    }
  }

  private keep(userId: string, k: Kept) {
    return this.deps.secrets.set(userId, NAME, JSON.stringify(k), this.deps.clock.now());
  }

  private get broken() {
    return new BrokenKeys(this.deps);
  }

  async status(userId: string): Promise<EvalStatus> {
    const k = await this.kept(userId);
    const hint = k ? `…${k.appKey.slice(-4)}` : null;
    const broken = k ? await this.broken.get(userId, NAME) : null;
    return { key: { set: Boolean(k), hint, provider: k?.provider ?? null, ...(broken ? { broken } : {}) }, strictness: k?.strictness ?? 'common' };
  }

  /** "Try again" on keys the service turned away: the next phrase goes to it, and is marked again if it fails the same way. */
  async retryKeys(userId: string): Promise<EvalStatus> {
    await this.broken.clear(userId, NAME);
    return this.status(userId);
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
    // Trying the keys is a call too: a quarter of a second of quiet.
    await this.deps.meter?.record(userId, keys.provider, 0.25);
    await this.keep(userId, { ...keys, strictness });
    await this.broken.clear(userId, NAME);
    return this.status(userId);
  }

  async deleteKeys(userId: string): Promise<EvalStatus> {
    await this.deps.secrets.delete(userId, NAME);
    await this.broken.clear(userId, NAME);
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
    await this.broken.guard(userId, NAME);
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
      const result = await this.evaluator().evaluate(keys as EvalKeys, { text, pinyin, pcm, strictness });
      // A unit is a second of speech: 16 kHz, 16-bit, one channel.
      await this.deps.meter?.record(userId, k.provider, pcm.length / 32_000);
      return result;
    } catch (err) {
      if (err instanceof EvaluatorRefused) {
        // The keys themselves turned away: marked, so the next phrases are not sent (K18).
        if (err.reason === 'keys') await this.broken.mark(userId, NAME, 'key', `${PROVIDER_NAME[k.provider]} turned the keys away (${err.message}).`);
        throw new AppError('unavailable', err.message);
      }
      throw new AppError('unavailable', `${PROVIDER_NAME[k.provider]} did not answer. Try again in a minute.`);
    }
  }

  /** Tries kept for every device; one kept already (by its id) is left as it is. */
  /** `result` is kept as the JSON it came as: the page's own record of the service's answer (R16: no cast at the route). */
  async keepAttempts(userId: string, items: Array<Omit<AttemptIn, 'result'> & { result?: unknown }>): Promise<{ kept: number }> {
    if (items.length > ATTEMPTS_PER_CALL) throw new ValidationError('Too many tries at once.');
    await this.deps.quota?.check(userId, items.reduce((n, a) => n + JSON.stringify(a).length, 0));
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
  async attempts(userId: string, kind?: AttemptKind): Promise<AttemptOut[]> {
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

  /** A try taken back: gone from every device's history. */
  async deleteAttempt(userId: string, id: string): Promise<{ deleted: boolean }> {
    return { deleted: await this.deps.attempts.delete(userId, `${userId}:${id}`) };
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
      } else if (a.kind === 'drill' && a.tally) {
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
