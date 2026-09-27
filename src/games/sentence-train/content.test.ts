import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildTrains, ROUNDS, trains } from './content';

describe('the sentence train', () => {
  it('has enough sentences at HSK 1, all in the band, three to six words', () => {
    const ctx = testContext(1);
    const all = trains(ctx);
    assert.ok(all.length >= ROUNDS * 3, `only ${all.length}`);
    for (const t of all) {
      assert.ok(t.cars.length >= 3 && t.cars.length <= 6);
      assert.equal(t.cars.join('') + t.end, t.zh.trim());
    }
  });

  it('never hands out a train already in order', () => {
    for (const r of buildTrains(testContext(1, 't'))) assert.notEqual(r.shuffled.join(''), r.cars.join(''));
  });
});
