import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildMeasure, phrase, ROUNDS } from './content';

describe('measure words', () => {
  it('has a full game at HSK 1 and at HSK 2', () => {
    assert.equal(buildMeasure(testContext(1)).length, ROUNDS);
    assert.equal(buildMeasure(testContext(2)).length, ROUNDS);
  });

  it('asks each noun with its own measure word among four, never another right one', () => {
    for (const r of buildMeasure(testContext(2, 'm'))) {
      assert.equal(r.options.length, 4);
      assert.equal(r.right, r.word.cl![0]);
      for (const o of r.options) if (o.id !== r.right) assert.ok(!(r.word.cl ?? []).includes(o.id) && o.id !== '个');
    }
  });

  it('never asks 个 more than twice', () => {
    assert.ok(buildMeasure(testContext(1, 'g')).filter((r) => r.right === '个').length <= 2);
  });

  it('says two as 两', () => {
    const r = { ...buildMeasure(testContext(1))[0], n: 2 };
    assert.ok(phrase(r).startsWith('两'));
  });
});
