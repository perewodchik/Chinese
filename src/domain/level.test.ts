import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../data/types';
import { asserted, levelOf, type Recall } from './memory';
import { wordKnowledge } from './words';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const held = (s: number, ago = 0, o: Partial<Recall> = {}): Recall => ({ s, d: 5, due: NOW - ago * DAY + s * DAY, last: NOW - ago * DAY, since: NOW - 60 * DAY, reps: 4, lapses: 0, ...o });

describe('how well an item is known, 0 to 3', () => {
  it('goes by how long the memory holds, from review alone', () => {
    assert.equal(levelOf(undefined, NOW), 0);
    assert.equal(levelOf({ recognise: held(0.02, 0, { reps: 1, lapses: 1 }) }, NOW), 0); // just failed
    assert.equal(levelOf({ recognise: held(1.5) }, NOW), 1);
    assert.equal(levelOf({ recognise: held(8) }, NOW), 2);
    assert.equal(levelOf({ recognise: held(40) }, NOW), 3);
  });

  it('counts the best skill, takes a claim for met, and slips one long past due', () => {
    assert.equal(levelOf({ recognise: held(2), write: held(25) }, NOW), 3);
    assert.equal(levelOf({ recognise: asserted(NOW) }, NOW), 1);
    assert.equal(levelOf({ recognise: held(8, 400) }, NOW), 1);
  });

  it('does not count a word as being learned for being on a list', () => {
    const lib = { byWord: new Map([['我们', {}]]) } as unknown as Library;
    const know = wordKnowledge(lib, {}, new Set(['w我们']), NOW);
    assert.equal(know.status('我们'), 'new');
    assert.equal(know.level('我们'), 0);
    assert.equal(wordKnowledge(lib, { 'w我们': { recognise: held(8) } }, undefined, NOW).level('我们'), 2);
  });
});
