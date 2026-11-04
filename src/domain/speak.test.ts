import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvalResult, SyllableEval } from '../../shared/speechEval';
import type { Attempt } from './phrases';
import { fixesOf, linesWithFault, matchSyllables, pausesOf, tagOf, today, weakLines } from './speak';

const syl = (char: string, symbol: string, o: Partial<SyllableEval> = {}): SyllableEval => ({ char, symbol, said: 'ok', initial: false, final: false, tone: false, from: 0, to: 0, score: 95, ...o });
const result = (syllables: SyllableEval[]): EvalResult => ({ by: 'speechsuper', total: 80, tone: 80, sounds: 80, fluency: 80, completeness: 100, rejected: false, syllables });
const attempt = (at: number, total: number, faults: Attempt['faults'] = []): Attempt => ({ at, total, tone: total, sounds: total, fluency: total, completeness: 100, faults });

describe('the new Speak', () => {
  it('matches each character to its scored syllable, past punctuation and an added sound', () => {
    const r = result([syl('你', 'ni3'), syl('嗯', 'en5', { said: 'added' }), syl('好', 'hao3'), syl('吗', 'ma5')]);
    assert.deepEqual(matchSyllables('你好，吗？', r), [0, 2, null, 3, null]);
    assert.deepEqual(matchSyllables('你好', null), [null, null]);
    // A character the service did not give back is not matched to the next one's syllable.
    assert.deepEqual(matchSyllables('你们好', result([syl('你', 'ni3'), syl('好', 'hao3')])), [0, null, 1]);
  });

  it('writes a fault as a short tag', () => {
    assert.equal(tagOf(syl('是', 'shi4', { initial: true, initialLike: 's' })), 'sh→s');
    assert.equal(tagOf(syl('好', 'hao3', { tone: true, heardTone: 2 })), 'tone 3→2');
    assert.equal(tagOf(syl('了', 'le5', { said: 'missed' })), 'not heard');
    assert.equal(tagOf(syl('很', 'hen3', { score: 70 })), 'nearly');
    assert.equal(tagOf(syl('很', 'hen3')), '');
  });

  it('lists the words to fix, a word whole, the ones said well left out', () => {
    const r = result([syl('认', 'ren4', { tone: true, heardTone: 1, score: 40, toneScore: 30 }), syl('识', 'shi5'), syl('你', 'ni3'), syl('很', 'hen3', { score: 70, toneScore: 65 })]);
    const fixes = fixesOf('认识你很', ['rèn', 'shi', 'nǐ', 'hěn'], r, [{ text: '认识', at: 0 }, { text: '你', at: 2 }, { text: '很', at: 3 }]);
    assert.deepEqual(fixes.map((f) => [f.word, f.band, f.worst]), [['认识', 'low', 30], ['很', 'mid', 65]]);
    assert.deepEqual(fixes[0]!.chars.map((c) => c.py), ['rèn', 'shi']);
    assert.equal(fixes[0]!.faults[0]!.kind, 'tone4');
    assert.ok(fixes[1]!.faults.length > 0, 'a nearly green character says what fell short');
    assert.deepEqual(fixesOf('你', ['nǐ'], result([syl('你', 'ni3')]), []), []);
  });

  it('finds the pauses inside a line', () => {
    assert.deepEqual(pausesOf(result([syl('我', 'wo3', { pause: true }), syl('好', 'hao3')])), ['我']);
  });

  it('picks the lines to say again and the lines with a fault, the latest first', () => {
    const all = {
      早: [attempt(1, 50)],
      晚: [attempt(5, 60), attempt(6, 90)],
      今: [attempt(3, 70, [{ kind: 'tone3', char: '今', symbol: 'jin1' }])],
      明: [attempt(4, 72, [{ kind: 'tone3', char: '明', symbol: 'ming2' }]), attempt(7, 95)],
    };
    assert.deepEqual(weakLines(all), ['今', '早']);
    assert.deepEqual(linesWithFault(all, 'tone3'), ['今']);
  });

  it('counts the lines said today and those that reached green', () => {
    const now = new Date(2026, 10, 3, 15).getTime();
    const yesterday = new Date(2026, 10, 2, 15).getTime();
    assert.deepEqual(today({ a: [attempt(yesterday, 90)], b: [attempt(now - 1000, 60), attempt(now, 80)], c: [attempt(now, 40)] }, now), { said: 2, green: 1 });
  });
});
