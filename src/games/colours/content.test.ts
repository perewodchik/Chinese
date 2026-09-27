import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildColours, coloursAt, ROUNDS } from './content';

describe('colours', () => {
  it('has the four HSK 2 colours at HSK 2, and none at HSK 1', () => {
    assert.equal(coloursAt(testContext(2)).length, 4);
    assert.equal(coloursAt(testContext(1)).length, 0);
  });

  it('never asks the same thing in the same colour twice running', () => {
    const rounds = buildColours(testContext(2, 'c'));
    assert.equal(rounds.length, ROUNDS);
    for (let i = 1; i < rounds.length; i++) {
      assert.notEqual(rounds[i].colour.w + rounds[i].thing.w, rounds[i - 1].colour.w + rounds[i - 1].thing.w);
    }
  });
});
