import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cutsOf, joinWithNext, removeLine, split } from './textEdit';

const lines = [
  { zh: '我饿了。', py: 'wǒ è le。', en: 'I am hungry.', p: true },
  { zh: '我们吃饭吧！', py: 'wǒmen chī fàn ba！', en: 'Let us eat!' },
];

describe('editing a text’s lines', () => {
  it('joins a line with the next, words, pinyin and English together', () => {
    assert.deepEqual(joinWithNext(lines, 0), [{ zh: '我饿了。我们吃饭吧！', py: 'wǒ è le。 wǒmen chī fàn ba！', en: 'I am hungry. Let us eat!', p: true }]);
    assert.deepEqual(joinWithNext(lines, 1), lines);
  });

  it('cuts a line where its sentences end, else at its commas, the first keeping what it carried', () => {
    const joined = joinWithNext(lines, 0);
    const cut = split(joined, 0);
    assert.deepEqual(cut.map((l) => l.zh), ['我饿了。', '我们吃饭吧！']);
    assert.equal(cut[0]!.p, true);
    assert.equal(cut[1]!.en, '');
    assert.deepEqual(cutsOf('我饿了，我们吃饭吧'), ['我饿了，', '我们吃饭吧']);
    assert.deepEqual(cutsOf('好'), ['好']);
    assert.deepEqual(split(joined, 0, (zh) => `py of ${zh}`).map((l) => l.py), ['py of 我饿了。', 'py of 我们吃饭吧！']);
  });

  it('takes a line out', () => {
    assert.deepEqual(removeLine(lines, 0).map((l) => l.zh), ['我们吃饭吧！']);
  });
});
