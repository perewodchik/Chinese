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
    assert.equal(written.version, 7);
    assert.equal(written.radicals.sets.length, 1);
  });
});

/**
 * Words are items since version 7. A document carrying them has to come back
 * with every one of them — dropping them on the way in is exactly what an
 * older build does, and what the server refuses to let it save.
 */
describe('a workspace with words in it', () => {
  const stored = {
    version: 7,
    collections: [
      {
        id: 'w',
        name: 'HSK 1 words',
        items: ['w东西', 'c东', 'w好', 'r61'],
        sheet: {},
        scope: { mode: 'all', from: 1, count: 20 },
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    recall: {
      'w东西': { recognise: { s: 3, d: 5, last: 10, since: 10, due: 20, reps: 1, lapses: 0 } },
      'w好': { recognise: { s: 0.5, d: 5, last: 11, since: 11, due: 12, reps: 1, lapses: 0 } },
    },
    learned: ['w东西'],
    sheets: [],
    texts: [],
    sets: [],
    plan: null,
    settings: {},
  };
  const state = hydrate(stored);

  it('keeps words in collections, beside characters, and nothing else', () => {
    assert.deepEqual(state.collections[0].items, ['w东西', 'c东', 'w好']);
  });

  it('keeps what is known about each word, and counts it as learned the same way', () => {
    assert.deepEqual(Object.keys(state.recall).sort(), ['w东西', 'w好']);
    assert.ok(state.learned.has('w东西'));
    // Asked once and barely held: not learned yet.
    assert.ok(!state.learned.has('w好'));
  });

  it('writes the words back out', () => {
    const written = serialise(state);
    assert.deepEqual(written.collections[0].items, ['w东西', 'c东', 'w好']);
    assert.ok(written.recall['w东西']);
  });
});

/**
 * A passage marks the words you do not know now, rather than every word by
 * its band. The bands are turned off once, for a document from before words,
 * and after that stay however they were left.
 */
describe('the reader marks, from before words', () => {
  it('turns the band marks off in a document from before words, and the unknown words on', () => {
    const s = hydrate({ version: 6, collections: [], settings: { markAbove: true } }).settings;
    assert.equal(s.markAbove, false);
    assert.equal(s.markUnknown, true);
  });

  it('leaves them as they were left in a document from since', () => {
    const s = hydrate({ version: 7, collections: [], settings: { markAbove: true, markUnknown: false } }).settings;
    assert.equal(s.markAbove, true);
    assert.equal(s.markUnknown, false);
  });
});

describe('a word list Claude wrote, from before words were items', () => {
  const list = {
    id: 'doc',
    name: 'At the doctor’s',
    items: ['c挂', 'c号'],
    sheet: {},
    scope: { mode: 'all', from: 1, count: 20 },
    createdAt: 1,
    updatedAt: 1,
    words: [
      { w: '挂号', py: 'guà hào', d: 'to register', hsk: 5, explain: '', examples: [] },
      { w: '我想要…', py: '', d: 'I would like…', hsk: null, explain: '', examples: [] },
      { w: '号', py: 'hào', d: 'number', hsk: 1, explain: '', examples: [] },
    ],
  };

  it('puts its words in as words, once, after its characters', () => {
    const items = hydrate({ version: 6, collections: [list] }).collections[0].items;
    assert.deepEqual(items, ['c挂', 'c号', 'w挂号', 'w号']);
  });

  it('does not put back a word taken out since', () => {
    const items = hydrate({ version: 7, collections: [list] }).collections[0].items;
    assert.deepEqual(items, ['c挂', 'c号']);
  });
});
