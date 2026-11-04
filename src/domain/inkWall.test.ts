import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../data/types';
import { levelCounts, wallOf } from './inkWall';
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

describe('the wall', () => {
  it('has one tile per item of the band, each at its level, and counts them', () => {
    const r = (s: number, at = NOW) => ({ recognise: { s, d: 5, due: at + s * DAY, last: at, since: at, reps: 3, lapses: 0 } });
    const tiles = wallOf(lib, { 'c我': r(30), 'c你': r(8), 'c他': r(2) }, 'chars', 1, NOW);
    assert.deepEqual(tiles.map((t) => [t.text, t.level]), [['我', 3], ['你', 2], ['他', 1]]);
    assert.deepEqual(levelCounts(tiles), [0, 1, 1, 1]);
    assert.equal(wallOf(lib, {}, 'words', 1, NOW).length, 1);
  });

  it('lets a level slip when an item goes long past due', () => {
    const fresh = { 'c我': { recognise: asserted(NOW, 60) } };
    const old = { 'c我': { recognise: { ...asserted(NOW - 900 * DAY, 30), claim: undefined, reps: 3, d: 4 } } };
    const at = (b: typeof fresh) => wallOf(lib, b, 'chars', 1, NOW).find((t) => t.text === '我')!.level;
    assert.ok(at(old) < 3, `${at(old)}`);
    assert.equal(at(fresh), 1); // a claim is believed, not known
  });
});
