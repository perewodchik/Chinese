import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildPairs } from './content';

describe('pairs', () => {
  it('lays out six words twice each, a photo and a word, all different photos', () => {
    const ctx = testContext(1, 'a');
    const { words, cards } = buildPairs(ctx);
    assert.equal(words.length, 6);
    assert.equal(cards.length, 12);
    assert.equal(new Set(words.map((w) => ctx.pictureOf(w))).size, 6);
    for (const w of words) {
      assert.deepEqual(
        cards.filter((c) => c.word === w).map((c) => c.face).sort(),
        ['picture', 'word'],
      );
    }
  });

  it('deals the same table from the same seed', () => {
    assert.deepEqual(buildPairs(testContext(1, 's1')), buildPairs(testContext(1, 's1')));
  });
});
