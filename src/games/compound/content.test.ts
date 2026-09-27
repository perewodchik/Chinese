import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildCompound, compounds, ROUNDS } from './content';

describe('compounds', () => {
  it('has a full game at HSK 2, each word made of two pictured parts', () => {
    const rounds = buildCompound(testContext(2, 'x'));
    assert.equal(rounds.length, ROUNDS);
    for (const r of rounds) {
      assert.equal(r.parts.length, 2);
      assert.ok(r.parts.every((p) => p.picture));
      assert.equal(new Set(r.parts.map((p) => p.picture!.src)).size, 2);
      assert.equal(new Set(r.options.map((o) => o.id)).size, 4);
    }
  });

  it('finds 火车 and 电脑 among them', () => {
    const words = compounds(testContext(1)).map((w) => w.w);
    assert.ok(words.includes('火车') && words.includes('电脑'));
  });
});
