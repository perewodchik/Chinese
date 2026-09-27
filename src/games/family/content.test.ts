import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildFamily, peopleAt, ROUNDS } from './content';

describe('the family', () => {
  it('leaves the grandparents out at HSK 1 and brings them in at HSK 2', () => {
    assert.ok(!peopleAt(testContext(1)).some((p) => p.w === '爷爷'));
    assert.ok(peopleAt(testContext(2)).some((p) => p.w === '爷爷'));
  });

  it('asks about a different person each time, never 我', () => {
    const rounds = buildFamily(testContext(2, 'f'));
    assert.equal(rounds.length, ROUNDS);
    assert.equal(new Set(rounds.map((r) => r.right)).size, ROUNDS);
    assert.ok(!rounds.some((r) => r.right === '我'));
  });
});
