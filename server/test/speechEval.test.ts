import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AttemptOut, EvalResult, SpeechHistory, SpeechSuperKeys } from '../../shared/speechEval';
import type { Evaluator } from '../src/application/speech-eval-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { EvaluatorRefused } from '../src/infrastructure/evaluator-refused';
import { parseAnswer, requestOf, wav } from '../src/infrastructure/speechsuper';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

// An answer as SpeechSuper gives one for sent.eval.promax.cn (cut down), for 他们一起走了… said without 一起,
// and 卡 read for qia3 and said as ka3 — its initial sounding like k.
const ANSWER = {
  tokenId: 't1',
  result: {
    overall: 74, pronunciation: 100, tone: 98, fluency: 100, integrity: 80, rhythm: 56, speed: 319, rear_tone: 'fall',
    words: [
      { word: '他', rawpinyin: 'ta1', readType: 0, scores: { overall: 100, tone: 86 }, tone_sound_like: 'tone2', pause: { type: 1 }, span: { start: 0, end: 23 },
        phonemes: [{ phone: 't', sound_like: 't', pronunciation: 100, category: 0 }, { phone: 'a', sound_like: 'a', pronunciation: 100, category: 1 }],
        normalized_syllables: [{ tone: 'tone1', tone_sandhi: 'tone1', pinyin: 'ta', syllables: '他', phoneme_span: [0, 1] }] },
      { word: '们', rawpinyin: 'men5', readType: 1, scores: { overall: 80, tone: 100 }, tone_sound_like: 'tone5', pause: { type: 1 }, span: { start: 23, end: 32 },
        phonemes: [{ phone: 'm', sound_like: 'm', pronunciation: 100, category: 0 }, { phone: 'en', sound_like: 'en', pronunciation: 60, category: 1 }],
        normalized_syllables: [{ tone: 'tone5', tone_sandhi: 'tone5', pinyin: 'men', syllables: '们', phoneme_span: [0, 1] }] },
      { word: '一', rawpinyin: 'yi1', readType: 2, scores: { overall: 0, tone: 0 }, tone_sound_like: '-', pause: { type: 0 }, span: { start: 32, end: 38 },
        phonemes: [{ phone: 'y', sound_like: '-', pronunciation: 0, category: 0 }, { phone: 'i', sound_like: '-', pronunciation: 0, category: 1 }],
        normalized_syllables: [{ tone: 'tone1', tone_sandhi: 'tone4', pinyin: 'yi', syllables: '一', phoneme_span: [0, 1] }] },
      { word: '卡', rawpinyin: 'qia3', readType: 0, scores: { overall: 3, tone: 3 }, tone_sound_like: 'tone3', pause: { type: 0 }, span: { start: 115, end: 138 },
        phonemes: [{ phone: 'q', sound_like: 'k', pronunciation: 0, category: 0 }, { phone: 'ia', sound_like: 'a', pronunciation: 6, category: 1 }],
        normalized_syllables: [{ tone: 'tone3', tone_sandhi: 'tone3', pinyin: 'qia', syllables: '卡', phoneme_span: [0, 1] }] },
    ],
  },
};

describe('SpeechSuper’s answer', () => {
  it('reads the whole, and per syllable the scores, faults, the tone heard, sandhi and what a sound was like', () => {
    const r = parseAnswer(ANSWER, 'common');
    assert.deepEqual([r.by, r.total, r.tone, r.sounds, r.fluency, r.completeness, r.rejected, r.rhythm, r.speed, r.ending], ['speechsuper', 74, 98, 100, 100, 80, false, 56, 319, 'fall']);
    assert.deepEqual(
      r.syllables.map((s) => [s.char, s.symbol, s.said, s.initial, s.final, s.tone]),
      [
        ['他', 'ta1', 'ok', false, false, false],
        ['们', 'men5', 'ok', false, false, false],
        ['一', 'yi1', 'missed', false, false, false],
        ['卡', 'qia3', 'ok', true, true, true],
      ],
    );
    const [ta, , yi, ka] = r.syllables;
    assert.deepEqual([ta!.pause, ta!.from, ta!.to, ta!.heardTone], [true, 0, 230, 2]);
    assert.deepEqual([yi!.sandhi, yi!.heardTone], [4, undefined]);
    // 们 had something said before it; its "pause" is only the gap where 一 was not heard.
    assert.deepEqual([r.syllables[1]!.extraBefore, r.syllables[1]!.pause], [true, undefined]);
    assert.deepEqual([ka!.initialLike, ka!.finalLike, ka!.initialScore, ka!.finalScore, ka!.score], ['k', 'a', 0, 6, 3]);
    // Hard asks more of 们's final than Common does.
    assert.equal(parseAnswer(ANSWER, 'hard').syllables[1]!.final, true);
  });

  it('tells keys it does not accept from other refusals', () => {
    assert.throws(() => parseAnswer({ errId: 41030, error: 'connect with invalid sig' }, 'common'), (e: EvaluatorRefused) => e.reason === 'keys');
    assert.throws(() => parseAnswer({ errId: 41030, error: 'invalid coreType' }, 'common'), (e: EvaluatorRefused) => e.reason === 'failed');
    assert.throws(() => parseAnswer({ errId: 41030, error: 'invalid expired' }, 'common'), (e: EvaluatorRefused) => e.reason === 'keys' && /have expired/.test(e.message) && /Settings/.test(e.message));
  });

  it('signs the request and gives each character its reading', () => {
    const keys: SpeechSuperKeys = { provider: 'speechsuper', appKey: 'app1', secretKey: 'sec1' };
    const q = requestOf(keys, { text: '皮卡丘', pinyin: ['pi2', 'ka3', 'qiu1'], strictness: 'easy' }, 1000);
    assert.equal(q.connect.param.app.sig, createHash('sha1').update('app11000sec1').digest('hex'));
    assert.match(q.start.param.app.sig, /^[0-9a-f]{40}$/);
    assert.deepEqual([q.start.param.request.refPinyin, q.start.param.request.slack], ['pi2 ka3 qiu1', 1]);
    assert.deepEqual([...wav(new Uint8Array(4)).subarray(0, 4)], [...Buffer.from('RIFF')]);
  });
});

const GOOD: SpeechSuperKeys = { provider: 'speechsuper', appKey: 'app12345', secretKey: 'secret0123456789' };
const SCORED = () => parseAnswer(ANSWER, 'common');

function stub() {
  const seen: Array<{ text: string; bytes: number; strictness: string; pinyin?: string[] }> = [];
  const evaluator: Evaluator = {
    async evaluate(keys, o) {
      if (keys.secretKey !== GOOD.secretKey) throw new EvaluatorRefused('SpeechSuper: connect with invalid sig (41030)', 'keys');
      seen.push({ text: o.text, bytes: o.pcm.length, strictness: o.strictness, ...(o.pinyin ? { pinyin: o.pinyin } : {}) });
      return SCORED() satisfies EvalResult;
    },
  };
  return { evaluator, seen };
}

function appWith(evaluator: Evaluator) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), evaluator, narrator: null });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

describe('phrases scored with the learner’s own keys', () => {
  it('keeps keys only once SpeechSuper lets them in, never sends them back, and scores at the strictness chosen', async () => {
    const { evaluator, seen } = stub();
    const app = appWith(evaluator);
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } }));
    assert.deepEqual(await (await call(app, 'GET', '/api/eval', { cookie })).json(), { key: { set: false, hint: null, provider: null }, strictness: 'common' });

    const audio = Buffer.alloc(16_000).toString('base64');
    assert.equal((await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } })).status, 404);
    assert.equal((await call(app, 'PUT', '/api/eval/key', { cookie, body: { ...GOOD, secretKey: 'wrongsecret01234567' } })).status, 400);
    const kept = await call(app, 'PUT', '/api/eval/key', { cookie, body: GOOD });
    assert.deepEqual(await kept.json(), { key: { set: true, hint: '…2345', provider: 'speechsuper' }, strictness: 'common' });

    const res = await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } });
    const { result } = (await res.json()) as { result: EvalResult };
    assert.equal(result.total, 74);
    assert.deepEqual(seen.at(-1), { text: '小智饿了', bytes: 16_000, strictness: 'common' });

    await call(app, 'PATCH', '/api/eval/settings', { cookie, body: { strictness: 'hard' } });
    await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } });
    assert.equal(seen.at(-1)!.strictness, 'hard');
    // A reading for every character goes along; one short, and none does.
    await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', pinyin: ['xiao3', 'zhi4', 'e4', 'le5'], audio } });
    assert.deepEqual(seen.at(-1)!.pinyin, ['xiao3', 'zhi4', 'e4', 'le5']);
    await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', pinyin: ['xiao3', 'zhi4'], audio } });
    assert.equal(seen.at(-1)!.pinyin, undefined);
    assert.equal((await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio: Buffer.alloc(100).toString('base64') } })).status, 400);

    const other = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' } }));
    assert.equal((await call(app, 'POST', '/api/eval', { cookie: other, body: { text: '小智饿了', audio } })).status, 404);
  });
});

describe('keys the service turned away (K18)', () => {
  it('marks them at the first refusal, sends nothing more until Try again or new keys, and only for their owner', async () => {
    let refusing = false;
    let calls = 0;
    const evaluator: Evaluator = {
      async evaluate(keys, o) {
        calls++;
        if (refusing || keys.secretKey !== GOOD.secretKey) throw new EvaluatorRefused('SpeechSuper: connect with invalid sig (41030)', 'keys');
        void o;
        return SCORED();
      },
    };
    const app = appWith(evaluator);
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } }));
    const other = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' } }));
    await call(app, 'PUT', '/api/eval/key', { cookie, body: GOOD });
    await call(app, 'PUT', '/api/eval/key', { cookie: other, body: GOOD });
    const audio = Buffer.alloc(16_000).toString('base64');
    const say = (c: string) => call(app, 'POST', '/api/eval', { cookie: c, body: { text: '小智饿了', audio } });

    refusing = true;
    assert.equal((await say(cookie)).status, 503);
    const status = (await (await call(app, 'GET', '/api/eval', { cookie })).json()) as { key: { broken?: { reason: string } } };
    assert.equal(status.key.broken?.reason, 'key');
    const before = calls;
    refusing = false;
    // Marked: refused here, without a call to the service.
    assert.equal((await say(cookie)).status, 503);
    assert.equal(calls, before);
    // Another learner's keys are their own: not marked, and their Try again clears nothing of this one's.
    assert.equal((await say(other)).status, 200);
    await call(app, 'POST', '/api/eval/key/retry', { cookie: other });
    assert.equal((await say(cookie)).status, 503);
    // Nobody signed in may clear anything.
    assert.equal((await call(app, 'POST', '/api/eval/key/retry')).status, 401);

    const retried = (await (await call(app, 'POST', '/api/eval/key/retry', { cookie })).json()) as { key: { broken?: unknown } };
    assert.equal(retried.key.broken, undefined);
    assert.equal((await say(cookie)).status, 200);

    // Saved again, the mark goes too.
    refusing = true;
    await say(cookie);
    refusing = false;
    await call(app, 'PUT', '/api/eval/key', { cookie, body: GOOD });
    assert.equal((await say(cookie)).status, 200);
  });
});

describe('tries kept for every device', () => {
  it('keeps each try once, gives each line its last five and each drill its count, and only to its owner', async () => {
    const { evaluator } = stub();
    const app = appWith(evaluator);
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'kirill', password: 'correct horse' } }));
    const line = (i: number) => ({ id: `p${i}`, at: 1000 + i, kind: 'phrase', sourceId: 't1', text: '小智饿了', good: i % 2 === 0, summary: { total: 60 + i }, result: SCORED() });
    const drill = (i: number, good: boolean) => ({ id: `d${i}`, at: 2000 + i, kind: 'drill', text: '马', tally: 'tone:3', good });
    const items = [...[0, 1, 2, 3, 4, 5, 6].map(line), drill(0, true), drill(1, false), drill(2, true)];
    assert.equal((await call(app, 'POST', '/api/eval/attempts', { cookie, body: { items } })).status, 200);
    // Sent again — a page retrying, or a second device importing — nothing doubles.
    await call(app, 'POST', '/api/eval/attempts', { cookie, body: { items } });
    const h = (await (await call(app, 'GET', '/api/eval/history', { cookie })).json()) as SpeechHistory;
    assert.deepEqual(h.phrases['小智饿了']!.map((a) => (a.summary as { total: number }).total), [62, 63, 64, 65, 66]);
    assert.deepEqual(h.tallies['tone:3'], { tries: 3, right: 2, recent: [1, 0, 1], last: 2002 });

    // Looking back: newest first, the page's own ids, which have the service's answer kept.
    const { attempts } = (await (await call(app, 'GET', '/api/eval/attempts?kind=phrase', { cookie })).json()) as { attempts: AttemptOut[] };
    assert.deepEqual(attempts.map((a) => a.id), ['p6', 'p5', 'p4', 'p3', 'p2', 'p1', 'p0']);
    assert.deepEqual([attempts[0]!.full, (attempts[0]!.summary as { total: number }).total], [true, 66]);
    const one = (await (await call(app, 'GET', '/api/eval/attempts/p6', { cookie })).json()) as { result: EvalResult };
    assert.equal(one.result.total, 74);

    const other = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' } }));
    assert.deepEqual(await (await call(app, 'GET', '/api/eval/history', { cookie: other })).json(), { phrases: {}, tallies: {} });
    assert.equal((await call(app, 'GET', '/api/eval/attempts/p6', { cookie: other })).status, 404);
    // Taken back: only by its owner, and gone from the list and the history.
    assert.deepEqual(await (await call(app, 'DELETE', '/api/eval/attempts/p6', { cookie: other })).json(), { deleted: false });
    assert.deepEqual(await (await call(app, 'DELETE', '/api/eval/attempts/p6', { cookie })).json(), { deleted: true });
    const after = (await (await call(app, 'GET', '/api/eval/attempts?kind=phrase', { cookie })).json()) as { attempts: AttemptOut[] };
    assert.deepEqual(after.attempts.map((a) => a.id), ['p5', 'p4', 'p3', 'p2', 'p1', 'p0']);
    assert.equal((await call(app, 'GET', '/api/eval/history')).status, 401);
  });
});
