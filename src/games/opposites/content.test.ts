import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildOpposites, pairsAt, ROUNDS } from './content';

describe('opposites', () => {
  it('uses only pairs on the list, and has a full game at HSK 1', () => {
    const ctx = testContext(1);
    assert.ok(pairsAt(ctx).length >= ROUNDS);
    for (const [a, b] of pairsAt(ctx)) assert.ok(a.hsk <= 1 && b.hsk <= 1);
  });

  it('never offers the word itself', () => {
    for (const r of buildOpposites(testContext(2, 'o'))) {
      assert.ok(!r.options.some((o) => o.id === r.shown.w));
      assert.ok(r.options.some((o) => o.id === r.opposite.w));
    }
  });
});
