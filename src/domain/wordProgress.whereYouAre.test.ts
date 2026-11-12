import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitOfShare, whereYouAre } from './wordProgress';

const band = (b: number, done: number, size = 100) => ({ band: b, size, done, proven: 0 });

describe('where you are, in words', () => {
  it('is the lowest band with fewer than nine in ten of its words known, and the next one', () => {
    const at = whereYouAre([band(1, 95), band(2, 80), band(3, 10)]);
    assert.equal(at.band, 2);
    assert.equal(at.share, 0.8);
    assert.deepEqual(at.reach.map((r) => [r.band, r.fit]), [[2, 'stretch'], [3, 'hard']]);
  });

  it('starts at HSK 1 with nothing known, and stays on the last band once all are known', () => {
    assert.equal(whereYouAre([band(1, 0), band(2, 0)]).band, 1);
    assert.equal(whereYouAre([band(1, 100), band(2, 95)]).band, 2);
  });

  it('reads nine in ten as comfortable, three in four as a stretch, less as hard', () => {
    assert.deepEqual([0.9, 0.89, 0.75, 0.74].map(fitOfShare), ['comfortable', 'stretch', 'stretch', 'hard']);
  });
});
