import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkHanzi, checkMeaning, checkOrder, checkPinyin } from './check';

describe('typed pinyin', () => {
  it('reads digits, marks, spaces or none', () => {
    for (const typed of ['huo3 che1', 'huo3che1', 'huǒ chē', 'huǒchē', 'Huo3 Che1']) {
      assert.equal(checkPinyin(typed, 'huǒ chē').ok, true, typed);
    }
  });

  it('knows ü however it is typed', () => {
    for (const typed of ['nv3', 'nü3', 'nu:3', 'nǚ']) assert.equal(checkPinyin(typed, 'nǚ').ok, true, typed);
    assert.equal(checkPinyin('nu3', 'nǚ').ok, false);
  });

  it('tells a wrong tone from a wrong sound', () => {
    const tone = checkPinyin('huo2 che1', 'huǒ chē');
    assert.equal(tone.ok, false);
    assert.equal(tone.tonesOnly, true);
    assert.deepEqual(tone.syllables.map((s) => s.verdict), ['tone', 'right']);
    const sound = checkPinyin('hu3 che1', 'huǒ chē');
    assert.equal(sound.tonesOnly, false);
    assert.deepEqual(sound.syllables.map((s) => s.verdict), ['wrong', 'right']);
  });

  it('takes no tone, 5 or 0 for the neutral tone', () => {
    for (const typed of ['dong1 xi', 'dong1 xi5', 'dong1xi0']) assert.equal(checkPinyin(typed, 'dōng xi').ok, true, typed);
    assert.equal(checkPinyin('dong xi', 'dōng xi').tonesOnly, true);
  });
});

describe('typed meaning', () => {
  it('forgives articles, "to", plurals and a slip', () => {
    assert.ok(checkMeaning('train', 'train'));
    assert.ok(checkMeaning('the Train', 'train'));
    assert.ok(checkMeaning('eat', 'to eat'));
    assert.ok(checkMeaning('trains', 'train'));
    assert.ok(checkMeaning('trian', 'train'));
    assert.ok(checkMeaning('excellent', 'good, excellent, fine; proper'));
    assert.ok(checkMeaning('hello', 'hello; hi'));
    assert.ok(!checkMeaning('car', 'train'));
    assert.ok(!checkMeaning('', 'train'));
  });

  it('accepts what the learner has said was right before', () => {
    assert.ok(!checkMeaning('locomotive', 'train'));
    assert.ok(checkMeaning('locomotive', 'train', ['locomotive']));
  });
});

describe('typed hanzi', () => {
  it('compares characters and ignores punctuation', () => {
    assert.equal(checkHanzi('火车。', '火车').ok, true);
    const off = checkHanzi('火东', '火车');
    assert.equal(off.ok, false);
    assert.deepEqual(off.chars.map((c) => c.ok), [true, false]);
    assert.equal(checkHanzi('huoche', '火车').anyHanzi, false);
  });
});

describe('tiles in order', () => {
  it('takes the sentence however it was cut', () => {
    assert.equal(checkOrder(['你', '坐', '火车', '去', '吗'], ['你', '坐', '火车', '去', '吗']), 'right');
    assert.equal(checkOrder(['你', '坐火车', '去', '吗'], ['你', '坐', '火车', '去', '吗']), 'right');
  });

  it('lets a time word stand on the other side of the subject', () => {
    assert.equal(checkOrder(['今天', '我', '去', '北京'], ['我', '今天', '去', '北京']), 'also');
    assert.equal(checkOrder(['北京', '我', '今天', '去'], ['我', '今天', '去', '北京']), 'wrong');
  });
});
