import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildClock, say } from './content';

describe('the clock', () => {
  it('says times the way they are said', () => {
    assert.equal(say({ h: 2, m: 0, part: 1 }, false), '两点');
    assert.equal(say({ h: 3, m: 30, part: 1 }, false), '三点半');
    assert.equal(say({ h: 3, m: 5, part: 1 }, true), '下午三点零五分');
    assert.equal(say({ h: 10, m: 45, part: 0 }, false), '十点四十五分');
  });

  it('asks hours and halves at HSK 1, four different answers each time', () => {
    for (const r of buildClock(testContext(1, 'c'))) {
      assert.ok([0, 30].includes(r.time.m));
      assert.equal(new Set(r.options.map((o) => o.id)).size, 4);
      assert.ok(r.options.some((o) => o.id === r.right));
    }
  });

  it('adds the part of the day at HSK 2', () => {
    assert.ok(buildClock(testContext(2, 'c')).every((r) => /^(上午|下午|晚上)/.test(r.right)));
  });
});
