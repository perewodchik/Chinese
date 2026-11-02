import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvalKeys, EvalResult } from '../../shared/speechEval';
import type { Evaluator } from '../src/application/speech-eval-service';
import { createServices } from '../src/composition';
import { createHttpApp } from '../src/http/app';
import { EvaluatorRefused, parseReport, signedUrl } from '../src/infrastructure/iflytek';
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
    const url = new URL(signedUrl({ appId: 'a', apiKey: 'key123', apiSecret: 'secret' }, 'Mon, 02 Nov 2026 10:00:00 GMT'));
    assert.equal(url.host, 'ise-api.xfyun.cn');
    assert.equal(url.searchParams.get('date'), 'Mon, 02 Nov 2026 10:00:00 GMT');
    const auth = Buffer.from(url.searchParams.get('authorization')!, 'base64').toString();
    assert.match(auth, /^api_key="key123", algorithm="hmac-sha256", headers="host date request-line", signature="[\w+/=]+"$/);
  });
});

const GOOD: EvalKeys = { appId: 'app12345', apiKey: 'apikey0123456789', apiSecret: 'secret0123456789' };

function stub() {
  const seen: Array<{ text: string; bytes: number; strictness: string }> = [];
  const evaluator: Evaluator = {
    async evaluate(keys, o) {
      if (keys.apiKey !== GOOD.apiKey) throw new EvaluatorRefused('iFlytek: invalid appid (10313)', 'keys');
      seen.push({ text: o.text, bytes: o.pcm.length, strictness: o.strictness });
      return parseReport(REPORT) satisfies EvalResult;
    },
  };
  return { evaluator, seen };
}

function appWith(evaluator: Evaluator) {
  const services = createServices(sqliteStores(openDatabase(':memory:')), { hasher: cheapHasher, clock: new TestClock(), evaluator, narrator: null });
  return createHttpApp(services, { trustProxy: false, staticDir: null, log: () => undefined });
}

describe('phrases scored by iFlytek with the learner’s keys', () => {
  it('keeps keys only once iFlytek lets them in, never sends them back, and scores at the strictness chosen', async () => {
    const { evaluator, seen } = stub();
    const app = appWith(evaluator);
    const cookie = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'admin', password: 'correct horse' } }));
    assert.deepEqual(await (await call(app, 'GET', '/api/eval', { cookie })).json(), { key: { set: false, hint: null }, strictness: 'common' });

    const audio = Buffer.alloc(16_000).toString('base64');
    assert.equal((await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } })).status, 404);
    assert.equal((await call(app, 'PUT', '/api/eval/key', { cookie, body: { ...GOOD, apiKey: 'wrongkey0123456' } })).status, 400);
    const kept = await call(app, 'PUT', '/api/eval/key', { cookie, body: GOOD });
    assert.deepEqual(await kept.json(), { key: { set: true, hint: '…6789' }, strictness: 'common' });

    const res = await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } });
    const { result } = (await res.json()) as { result: EvalResult };
    assert.equal(result.total, 78.3);
    assert.deepEqual(seen.at(-1), { text: '小智饿了', bytes: 16_000, strictness: 'common' });

    await call(app, 'PATCH', '/api/eval/settings', { cookie, body: { strictness: 'hard' } });
    await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio } });
    assert.equal(seen.at(-1)!.strictness, 'hard');
    assert.equal((await call(app, 'POST', '/api/eval', { cookie, body: { text: '小智饿了', audio: Buffer.alloc(100).toString('base64') } })).status, 400);

    const other = sessionCookie(await call(app, 'POST', '/api/auth/register', { body: { username: 'masha', password: 'correct horse' } }));
    assert.equal((await call(app, 'POST', '/api/eval', { cookie: other, body: { text: '小智饿了', audio } })).status, 404);
  });
});
