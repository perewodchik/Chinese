import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildRounds, ROUNDS } from './content';

describe('the template game', () => {
  it('has a full game at each band', () => {
    assert.equal(buildRounds(testContext(1)).length, ROUNDS);
    assert.equal(buildRounds(testContext(2)).length, ROUNDS);
  });

  it('builds the same rounds from the same seed', () => {
    assert.deepEqual(buildRounds(testContext(1, 'same')), buildRounds(testContext(1, 'same')));
  });
});
