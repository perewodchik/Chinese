import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvalResult, IflytekKeys, SpeechSuperKeys } from '../../shared/speechEval';
import type { Evaluator } from '../src/application/speech-eval-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { EvaluatorRefused, parseReport, signedUrl } from '../src/infrastructure/iflytek';
import { parseAnswer, requestOf, wav } from '../src/infrastructure/speechsuper';
import { openDatabase } from '../src/infrastructure/sqlite/database';
import { sqliteStores } from '../src/infrastructure/sqlite/stores';
import { call, cheapHasher, sessionCookie, TestClock } from './support';

// A report as iFlytek writes one for a read_sentence: the scored sentence under
// rec_paper, silences around it, and per phone the kind (is_yun) and the fault.
const REPORT = `<?xml version="1.0" ?>
<xml_result><read_sentence lan="cn" type="study" version="7,0,0,1024"><rec_paper>
<read_sentence beg_pos="0" content="小智饿了" end_pos="220" except_info="0" fluency_score="80.5" integrity_score="100" is_rejected="false" phone_score="85.2" time_len="220" tone_score="60" total_score="78.3">
<sentence beg_pos="0" content="小智饿了" end_pos="220" fluency_score="80.5" integrity_score="100" phone_score="85.2" time_len="220" tone_score="60" total_score="78.3">
<word beg_pos="0" content="sil" end_pos="10"><syll beg_pos="0" content="sil" end_pos="10" rec_node_type="sil" symbol="sil"/></word>
<word beg_pos="10" content="小" end_pos="40" symbol="xiao3"><syll beg_pos="10" content="小" dp_message="0" end_pos="40" rec_node_type="paper" symbol="xiao3">
<phone beg_pos="10" content="x" dp_message="0" end_pos="20" is_yun="0" perr_msg="0" rec_node_type="paper"/>
<phone beg_pos="20" content="iao" dp_message="0" end_pos="40" is_yun="1" mono_tone="TONE3" perr_msg="0" rec_node_type="paper"/></syll></word>
<word beg_pos="40" content="智" end_pos="80" symbol="zhi4"><syll beg_pos="40" content="智" dp_message="0" end_pos="80" rec_node_type="paper" symbol="zhi4">
<phone content="zh" is_yun="0" perr_msg="1"/><phone content="ix" is_yun="1" perr_msg="0" mono_tone="TONE4"/></syll></word>
<word beg_pos="80" content="饿" end_pos="130" symbol="e4"><syll beg_pos="80" content="饿" dp_message="0" end_pos="130" rec_node_type="paper" symbol="e4">
<phone content="e" is_yun="1" perr_msg="2" mono_tone="TONE4"/></syll></word>
<word content="了" symbol="le5"><syll beg_pos="130" content="了" dp_message="16" end_pos="130" rec_node_type="paper" symbol="le5">
<phone content="l" is_yun="0" perr_msg="16"/><phone content="e" is_yun="1" perr_msg="16"/></syll></word>
</sentence></read_sentence></rec_paper></read_sentence></xml_result>`;

describe('iFlytek’s report', () => {
  it('reads the scores and each syllable’s faults, leaving the silences out', () => {
    const r = parseReport(REPORT);
    assert.deepEqual([r.total, r.tone, r.sounds, r.fluency, r.completeness, r.rejected], [78.3, 60, 85.2, 80.5, 100, false]);
    assert.deepEqual(
      r.syllables.map((s) => [s.char, s.symbol, s.said, s.initial, s.final, s.tone]),
      [
        ['小', 'xiao3', 'ok', false, false, false],
        ['智', 'zhi4', 'ok', true, false, false],
        ['饿', 'e4', 'ok', false, false, true],
        ['了', 'le5', 'missed', true, false, false],
      ],
    );
    assert.deepEqual([r.syllables[0]!.from, r.syllables[0]!.to], [100, 400]);
  });

  it('signs the address with the secret, over host, date and the request line', () => {
    const url = new URL(signedUrl({ apiKey: 'key123', apiSecret: 'secret' }, 'Mon, 02 Nov 2026 10:00:00 GMT'));
    assert.equal(url.host, 'ise-api.xfyun.cn');
    assert.equal(url.searchParams.get('date'), 'Mon, 02 Nov 2026 10:00:00 GMT');
    const auth = Buffer.from(url.searchParams.get('authorization')!, 'base64').toString();
    assert.match(auth, /^api_key="key123", algorithm="hmac-sha256", headers="host date request-line", signature="[\w+/=]+"$/);
  });
});

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
      { word: '们', rawpinyin: 'men5', readType: 0, scores: { overall: 80, tone: 100 }, tone_sound_like: 'tone5', pause: { type: 0 }, span: { start: 23, end: 32 },
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
    assert.deepEqual([ka!.initialLike, ka!.finalLike, ka!.initialScore, ka!.finalScore, ka!.score], ['k', 'a', 0, 6, 3]);
    // Hard asks more of 们's final than Common does.
    assert.equal(parseAnswer(ANSWER, 'hard').syllables[1]!.final, true);
  });

  it('tells keys it does not accept from other refusals', () => {
    assert.throws(() => parseAnswer({ errId: 41030, error: 'connect with invalid sig' }, 'common'), (e: EvaluatorRefused) => e.reason === 'keys');
    assert.throws(() => parseAnswer({ errId: 41030, error: 'invalid coreType' }, 'common'), (e: EvaluatorRefused) => e.reason === 'failed');
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

const GOOD: IflytekKeys = { provider: 'iflytek', appId: 'app12345', apiKey: 'apikey0123456789', apiSecret: 'secret0123456789' };

function stub() {
  const seen: Array<{ text: string; bytes: number; strictness: string; pinyin?: string[] }> = [];
  const evaluator: Evaluator = {
    async evaluate(keys, o) {
      if (keys.provider !== 'iflytek' || keys.apiKey !== GOOD.apiKey) throw new EvaluatorRefused('iFlytek: invalid appid (10313)', 'keys');
      seen.push({ text: o.text, bytes: o.pcm.length, strictness: o.strictness, ...(o.pinyin ? { pinyin: o.pinyin } : {}) });
      return parseReport(REPORT) satisfies EvalResult;
    },
  };
  return { evaluator, seen };
}

function appWith(evaluator: Evaluator) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), evaluator, narrator: null });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

describe('phrases scored with the learner’s own keys', () => {
  it('keeps keys only once iFlytek lets them in, never sends them back, and scores at the strictness chosen', async () => {
    const { evaluator, seen } = stub();
    const app = appWith(evaluator);
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'admin', password: 'correct horse' } }));
    assert.deepEqual(await (await call(app, 'GET', '/api/eval', { cookie })).json(), { key: { set: false, hint: null, provider: null }, strictness: 'common' });

    const audio = Buffer.alloc(16_000).toString('base64');
    assert.equal((await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } })).status, 404);
    assert.equal((await call(app, 'PUT', '/api/eval/key', { cookie, body: { ...GOOD, apiKey: 'wrongkey0123456' } })).status, 400);
    const kept = await call(app, 'PUT', '/api/eval/key', { cookie, body: GOOD });
    assert.deepEqual(await kept.json(), { key: { set: true, hint: '…6789', provider: 'iflytek' }, strictness: 'common' });

    const res = await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } });
    const { result } = (await res.json()) as { result: EvalResult };
    assert.equal(result.total, 78.3);
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
