import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildListen, ROUNDS } from './content';

describe('listening', () => {
  it('asks only words a native speaker recorded, each among four different photos', () => {
    const ctx = testContext(1, 'l');
    const rounds = buildListen(ctx);
    assert.equal(rounds.length, ROUNDS);
    for (const r of rounds) {
      assert.ok(ctx.native.has(r.word.w));
      assert.equal(new Set(r.options.map((o) => ctx.pictureOf(o.id))).size, 4);
    }
  });
});
