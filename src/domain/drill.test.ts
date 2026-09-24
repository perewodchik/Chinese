import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library } from '../data/types';
import { reviewPool } from './drill';
import { asserted, grade, type RecallBook } from './memory';

const entry = (c: string, i: number): CharacterEntry => ({
  c,
  i,
  py: ['x'],
  def: c,
  rad: null,
  radNum: null,
  sc: 1,
  ids: null,
  parts: [],
  leaves: [],
  ety: null,
  trad: null,
  hsk: 1,
  freq: i,
  layer: 1,
  words: [],
  sent: null,
  conf: [],
});

const library = (...chars: string[]): Library => {
  const characters = chars.map((c, i) => entry(c, i + 1));
  return {
    characters,
    themes: [],
    components: {},
    strokes: {},
    byChar: new Map(characters.map((e) => [e.c, e])),
    words: [],
    byWord: new Map(),
  };
};

const NOW = 1_700_000_000_000;

describe('the review pool', () => {
  const lib = library('一', '二', '三');

  it('leaves out a character that has only been collected, never marked', () => {
    assert.deepEqual(reviewPool(lib, {}), []);
  });

  it('takes a character in the moment it is marked learned', () => {
    const book: RecallBook = { 'c二': { recognise: asserted(NOW) } };
    assert.deepEqual(reviewPool(lib, book), ['c二']);
  });

  it('keeps one that has been asked about and forgotten', () => {
    const book: RecallBook = { 'c三': { recognise: grade(undefined, 'again', NOW) } };
    assert.deepEqual(reviewPool(lib, book), ['c三']);
  });

  it('drops an entry left with no skill on it at all', () => {
    assert.deepEqual(reviewPool(lib, { 'c一': {} }), []);
  });

  it('puts the pool in teaching order', () => {
    const book: RecallBook = {
      'c三': { recognise: asserted(NOW) },
      'c一': { recognise: asserted(NOW) },
    };
    assert.deepEqual(reviewPool(lib, book), ['c一', 'c三']);
  });
});

describe('the date a character was first marked', () => {
  it('survives every later answer', () => {
    const first = asserted(NOW);
    const later = grade(grade(first, 'good', NOW + 86_400_000), 'again', NOW + 200_000_000);
    assert.equal(later.since, NOW);
    assert.notEqual(later.last, NOW);
  });
});
