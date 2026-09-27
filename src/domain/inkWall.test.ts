import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../data/types';
import { inkCounts, inkOf, wallOf } from './inkWall';
import { asserted } from './memory';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const lib = {
  characters: [
    { c: '我', hsk: 1 },
    { c: '你', hsk: 1 },
    { c: '他', hsk: 1 },
    { c: '经', hsk: 2 },
  ],
  words: [{ w: '我们', hsk: 1 }],
} as unknown as Library;

describe('the ink wall', () => {
  it('draws the never-met as outlines and everything else in five steps', () => {
    assert.equal(inkOf(0.99, false), 0);
    assert.deepEqual([0, 0.2, 0.4, 0.7, 0.9].map((s) => inkOf(s, true)), [1, 2, 3, 4, 5]);
  });

  it('fades a character left alone for a long time', () => {
    const held = (at: number) => {
      const r = asserted(at, 60);
      return { recognise: r, sound: r, write: r, use: r };
    };
    const fresh = { 'c我': held(NOW) };
    const old = { 'c我': held(NOW - 400 * DAY) };
    const now = (r: typeof fresh) => wallOf(lib, r, new Set(), 'chars', 1, NOW).find((t) => t.text === '我')!.ink;
    assert.ok(now(old) < now(fresh), `${now(old)} < ${now(fresh)}`);
  });

  it('has one tile per item of the band, and counts them by ink', () => {
    const tiles = wallOf(lib, {}, new Set(['c你']), 'chars', 1, NOW);
    assert.deepEqual(tiles.map((t) => t.text), ['我', '你', '他']);
    assert.deepEqual(inkCounts(tiles), [2, 1, 0, 0, 0, 0]);
    assert.equal(wallOf(lib, {}, new Set(), 'words', 1, NOW).length, 1);
  });
});
