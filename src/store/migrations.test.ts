import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hydrate, serialise } from './migrations';

/**
 * Radicals used to live among the characters: a radical collection was a
 * collection, and a radical you had ticked sat in the learned list beside them.
 * Opening one of those documents has to move all of it across without losing
 * anything — this is the one migration that can quietly drop somebody's work.
 */
describe('a workspace written before radicals had a place of their own', () => {
  const stored = {
    version: 5,
    collections: [
      {
        id: 'a',
        name: 'HSK 1',
        kind: 'char',
        items: ['c好', 'c你'],
        sheet: { perPage: 2 },
        scope: { mode: 'all', from: 1, count: 20 },
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: 'b',
        name: 'Radicals I keep missing',
        kind: 'radical',
        items: ['r61', 'r85'],
        sheet: { perPage: 5, practiceRows: 2, palette: 'plum' },
        scope: { mode: 'unlearned', from: 1, count: 20 },
        createdAt: 3,
        updatedAt: 4,
      },
    ],
    recall: {
      'c好': { recognise: { s: 3, d: 5, last: 10, due: 20, reps: 1, lapses: 0 } },
      r61: { recognise: { s: 9, d: 5, last: 11, due: 30, reps: 1, lapses: 0 } },
    },
    learned: ['c好', 'r61', 'r85'],
    sheets: [],
    texts: [],
    sets: [],
    plan: null,
    settings: { radicalLimit: 100, hskBand: 2 },
  };
  const state = hydrate(stored);

  it('leaves the character collections alone and makes the radical one a set', () => {
    assert.deepEqual(
      state.collections.map((c) => c.id),
      ['a'],
    );
    assert.deepEqual(
      state.radicals.sets.map((s) => s.id),
      ['b'],
    );
    const set = state.radicals.sets[0];
    assert.deepEqual(set.items, [61, 85]);
    assert.equal(set.name, 'Radicals I keep missing');
    assert.equal(set.sheet.palette, 'plum');
    // "Not yet learned" is "not known yet" now, and five a page is not offered.
    assert.equal(set.scope.mode, 'unknown');
    assert.equal(set.sheet.perPage, 4);
  });

  it('keeps a ticked radical as known, and out of the review book', () => {
    assert.deepEqual(Object.keys(state.recall), ['c好']);
    assert.equal(state.radicals.known[61], 11);
    assert.ok(state.radicals.known[85]);
    assert.ok(![...state.learned].some((id) => id.startsWith('r')));
  });

  it('carries the library filter over to the radicals page', () => {
    assert.equal(state.radicals.limit, 100);
    assert.equal(state.settings.hskBand, 2);
  });

  it('writes the workspace back at the version it has now', () => {
    const written = serialise(state);
    assert.equal(written.version, 6);
    assert.equal(written.radicals.sets.length, 1);
  });
});
