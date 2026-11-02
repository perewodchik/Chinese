import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spokenTones } from './sandhi';
import { parseSyllable, withTone } from './syllable';

describe('syllables', () => {
  it('takes a reading apart into initial, final and tone', () => {
    assert.deepEqual(
      (({ initial, final, tone }) => ({ initial, final, tone }))(parseSyllable('zhōng')),
      { initial: 'zh', final: 'ong', tone: 1 },
    );
    assert.equal(parseSyllable('qù').final, 'ü');
    assert.equal(parseSyllable('xué').final, 'üe');
    assert.equal(parseSyllable('yuè').final, 'üe');
    assert.equal(parseSyllable('yī').final, 'i');
    assert.equal(parseSyllable('wǒ').final, 'uo');
    assert.equal(parseSyllable('jiǔ').final, 'iou');
    assert.equal(parseSyllable('duì').final, 'uei');
    assert.equal(parseSyllable('ài').initial, '');
    assert.equal(parseSyllable('le').tone, 5);
    // ü carries its own two dots; they are not a tone.
    assert.equal(parseSyllable('nǚ').tone, 3);
    assert.equal(parseSyllable('lǜ').tone, 4);
    assert.equal(parseSyllable('lǘ').tone, 2);
    assert.equal(parseSyllable('lǖ').tone, 1);
  });

  it('puts the tone mark where pinyin puts it', () => {
    assert.equal(withTone('hao', 3), 'hǎo');
    assert.equal(withTone('dou', 1), 'dōu');
    assert.equal(withTone('gui', 4), 'guì');
    assert.equal(withTone('xue', 2), 'xué');
    assert.equal(withTone('lü', 4), 'lǜ');
  });
});

describe('tone sandhi', () => {
  const surface = (tones: number[], chars = '') => spokenTones(tones, [...chars]).map((s) => s.surface);

  it('turns the first of two thirds into a second', () => {
    assert.deepEqual(surface([3, 3], '你好'), [2, 3]);
  });

  it('turns all but the last of a longer run into seconds, and says it is approximate', () => {
    const s = spokenTones([3, 3, 3], [...'我很好']);
    assert.deepEqual(s.map((x) => x.surface), [2, 2, 3]);
    assert.ok(s[0]!.approximate);
  });

  it('says 一 as yì before tones 1–3 and yí before a fourth', () => {
    assert.deepEqual(surface([1, 1], '一天'), [4, 1]);
    assert.deepEqual(surface([1, 4], '一样'), [2, 4]);
    assert.deepEqual(surface([1, 4], '一下'), [2, 4]);
  });

  it('leaves 一 alone when it is a number being counted', () => {
    assert.deepEqual(surface([4, 1], '第一'), [4, 1]);
    assert.deepEqual(surface([2, 1], '十一'), [2, 1]);
  });

  it('says 不 as bú before a fourth, and only then', () => {
    assert.deepEqual(surface([4, 4], '不是'), [2, 4]);
    assert.deepEqual(surface([4, 1], '不吃'), [4, 1]);
  });

  it('marks a third with something after it as a half third', () => {
    const s = spokenTones([3, 1], [...'好吃']);
    assert.ok(s[0]!.halfThird);
    assert.ok(!spokenTones([3], ['好'])[0]!.halfThird);
  });
});

