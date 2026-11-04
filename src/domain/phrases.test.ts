import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvalResult, SyllableEval } from '../../shared/speechEval';
import { attemptOf, faultsOf, heardTag, marked, noteOf, numbered, partsOf, troubles, verdictOf } from './phrases';

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

  it('says what SpeechSuper heard instead, and the tone a syllable takes in the phrase', () => {
    const [tone] = faultsOf(syl('一', 'yi1', { tone: true, sandhi: 4, heardTone: 1 }));
    assert.equal(tone!.kind, 'tone4');
    assert.equal(tone!.title, 'Tone: a fourth tone, it sounded like a first tone');
    assert.match(tone!.how, /Here 一 is yì, a fourth tone/);
    assert.equal(faultsOf(syl('卡', 'ka3', { initial: true, initialLike: 'g' }))[0]!.title, 'The initial k — it sounded like g');
    assert.deepEqual(faultsOf(syl('卡', 'ka3', { said: 'missed' })).map((f) => f.title), ['Not heard']);
    // Something said before it is the line's flow, not the character's fault.
    assert.deepEqual(faultsOf(syl('三', 'san1', { extraBefore: true })).map((f) => f.kind), []);
  });

  it('gives each character a band, and for one nearly green the part that fell short', () => {
    assert.deepEqual(noteOf(syl('小', 'xiao3', { score: 95 })), { band: 'good', faults: [] });
    const nearly = noteOf(syl('卡', 'ka3', { score: 70, toneScore: 68, initialScore: 90, finalScore: 80 }));
    assert.equal(nearly.band, 'mid');
    assert.deepEqual(nearly.faults.map((f) => f.title), ['Tone a little off (68)']);
    assert.equal(noteOf(syl('走', 'zou3', { said: 'missed', score: 0 })).band, 'low');
  });

  it('says what the service heard wrong in its own terms, and nothing when it was green', () => {
    assert.equal(heardTag(syl('皮', 'pi2', { initial: true, initialLike: 'j', score: 9, initialScore: 9, finalScore: 100, toneScore: 100 })), 'p → j');
    assert.equal(heardTag(syl('一', 'yi1', { tone: true, sandhi: 4, heardTone: 1 })), 'tone 4 → 1');
    assert.equal(heardTag(syl('走', 'zou3', { said: 'missed' })), 'not heard');
    assert.equal(heardTag(syl('卡', 'ka3', { score: 70, toneScore: 68, initialScore: 90, finalScore: 80 })), 'tone 3 68');
    assert.equal(heardTag(syl('小', 'xiao3', { score: 95, toneScore: 95, initialScore: 100, finalScore: 96 })), '');
  });

  it('numbers each character’s reading for the service, or gives none when one is unknown', () => {
    assert.deepEqual(numbered(['pí', 'kǎ', 'qiū']), ['pi2', 'ka3', 'qiu1']);
    assert.deepEqual(numbered(['nǚ', 'de', 'r']), ['nv3', 'de5', 'er5']);
    assert.equal(numbered(['nǐ', '']), undefined);
  });

  it('names what let a phrase down, and what keeps going wrong across phrases', () => {
    const r: EvalResult = { by: 'iflytek', total: 78, tone: 60, sounds: 86, fluency: 81, completeness: 100, rejected: false, syllables: [syl('饿', 'e4', { tone: true }), syl('智', 'zhi4', { initial: true }), syl('小', 'xiao3')] };
    assert.equal(verdictOf(r).headline, 'Good — the tones let it down');
    const a = attemptOf(r, 1);
    const b = attemptOf({ ...r, syllables: [syl('是', 'shi4', { tone: true })] }, 2);
    const t = troubles([a, b]);
    assert.deepEqual(t.map((x) => [x.kind, x.count, x.chars.map((c) => c.char).join('')]), [['tone4', 2, '饿是'], ['initial:zh', 1, '智']]);
  });
});
