import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvalResult, SyllableEval } from '../../shared/speechEval';
import { attemptOf, charBands, faultsOf, heardNote, heardTag, marked, noteOf, numbered, partsOf, resultOfAttempt, troubles, verdictOf } from './phrases';

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

  it('draws a try kept without the whole answer from what was kept of it', () => {
    // A try moved over from a device: totals and faults, no numbers per character.
    const old = {
      at: 1,
      total: 68,
      tone: 64,
      sounds: 69,
      fluency: 69,
      completeness: 91,
      faults: [
        { kind: 'final:e', char: '和', symbol: 'he2' },
        { kind: 'tone3', char: '卡', symbol: 'ka3' },
        { kind: 'initial:k', char: '卡', symbol: 'ka3' },
        { kind: 'missed', char: '走', symbol: 'zou3' },
      ],
    };
    const r = resultOfAttempt('小和卡，走。', ['xiao3', 'he2', 'ka3', 'zou3'], old);
    assert.equal(r.total, 68);
    assert.deepEqual(
      r.syllables.map((x) => [x.char, x.symbol, x.said, x.initial, x.final, x.tone]),
      [
        ['小', 'xiao3', 'ok', false, false, false],
        ['和', 'he2', 'ok', false, true, false],
        ['卡', 'ka3', 'ok', true, false, true],
        ['走', 'zou3', 'missed', false, false, false],
      ],
    );
    // One kept with its numbers gets them back.
    const r2 = attemptOf({ by: 'speechsuper', total: 90, tone: 90, sounds: 90, fluency: 90, completeness: 100, rejected: false, syllables: [syl('小', 'xiao3', { score: 90, toneScore: 70, initialScore: 95, finalScore: 92, tone: true })] }, 2);
    const back = resultOfAttempt('小', undefined, r2).syllables[0]!;
    assert.deepEqual([back.toneScore, back.initialScore, back.finalScore, back.tone], [70, 95, 92, true]);
  });

  it('says what was heard, from the service\'s own data only', () => {
    assert.equal(heardNote(syl('打', 'da3', { tone: true, heardTone: 2 })), 'tone 3, heard as 2');
    assert.equal(heardNote(syl('打', 'da3', { tone: true })), 'tone 3 off');
    assert.equal(heardNote(syl('这', 'zhe4', { initial: true, initialLike: 'z' })), 'zh, heard as z');
    assert.equal(heardNote(syl('一', 'yi1', { tone: true, sandhi: 4, heardTone: 4 })), 'tone 4 off');
    assert.equal(heardNote(syl('鱼', 'yu2', { said: 'missed' })), 'not heard');
    assert.equal(heardNote(syl('好', 'hao3')), '');
  });

  it('colours each character of a line by how it was said, punctuation left plain', () => {
    const r: EvalResult = { by: 'speechsuper', total: 70, tone: 70, sounds: 70, fluency: 70, completeness: 90, rejected: false,
      syllables: [syl('你', 'ni3', { score: 95 }), syl('好', 'hao3', { tone: true, toneScore: 40 }), syl('吗', 'ma5', { said: 'missed' })] };
    assert.deepEqual(charBands('你好，吗？', r), ['good', 'low', null, 'low', null]);
  });
});
