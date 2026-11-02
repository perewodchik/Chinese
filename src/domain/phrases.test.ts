import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvalResult, SyllableEval } from '../../shared/speechEval';
import { attemptOf, faultsOf, marked, partsOf, troubles, verdictOf } from './phrases';

const syl = (char: string, symbol: string, o: Partial<SyllableEval> = {}): SyllableEval => ({ char, symbol, said: 'ok', initial: false, final: false, tone: false, from: 0, to: 0, ...o });

describe('phrases said and scored', () => {
  it('takes iFlytek’s syllables apart and marks their tones', () => {
    assert.deepEqual(partsOf('zhi4'), { initial: 'zh', final: 'i', tone: 4, marked: 'zhì' });
    assert.equal(partsOf('xiao3').marked, 'xiǎo');
    assert.equal(partsOf('le5').marked, 'le');
    assert.equal(marked('gou', 3), 'gǒu');
    assert.equal(marked('lv', 4), 'lǜ');
  });

  it('says what was wrong with a syllable, as iFlytek found it', () => {
    assert.deepEqual(faultsOf(syl('饿', 'e4', { tone: true })).map((f) => f.kind), ['tone4']);
    assert.deepEqual(faultsOf(syl('智', 'zhi4', { initial: true })).map((f) => f.kind), ['initial:zh']);
    assert.match(faultsOf(syl('去', 'qu4', { final: true }))[0]!.how, /ü/);
    assert.deepEqual(faultsOf(syl('了', 'le5', { said: 'missed', initial: true })).map((f) => f.kind), ['missed']);
    assert.deepEqual(faultsOf(syl('小', 'xiao3')), []);
  });

  it('names what let a phrase down, and what keeps going wrong across phrases', () => {
    const r: EvalResult = { total: 78, tone: 60, sounds: 86, fluency: 81, completeness: 100, rejected: false, syllables: [syl('饿', 'e4', { tone: true }), syl('智', 'zhi4', { initial: true }), syl('小', 'xiao3')] };
    assert.equal(verdictOf(r).headline, 'Good — the tones let it down');
    const a = attemptOf(r, 1);
    const b = attemptOf({ ...r, syllables: [syl('是', 'shi4', { tone: true })] }, 2);
    const t = troubles([a, b]);
    assert.deepEqual(t.map((x) => [x.kind, x.count, x.chars.map((c) => c.char).join('')]), [['tone4', 2, '饿是'], ['initial:zh', 1, '智']]);
  });
});
