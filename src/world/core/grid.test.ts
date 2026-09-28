import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ahead, approach, facingToward, findPath, gridFromRows, key, walkable, walkTo } from './grid';

// A courtyard: walls round it, a wall across with a gap, a closed room.
const yard = gridFromRows([
  '##########',
  '#........#',
  '#.####.###',
  '#........#',
  '#..####..#',
  '#..#..#..#',
  '#..####..#',
  '##########',
]);

describe('grid', () => {
  it('reads walls from rows', () => {
    assert.equal(yard.width, 10);
    assert.equal(walkable(yard, 1, 1), true);
    assert.equal(walkable(yard, 0, 0), false);
    assert.equal(walkable(yard, -1, 3), false);
    assert.equal(walkable(yard, 1, 1, new Set([key(1, 1)])), false);
  });

  it('finds the shortest 4-way path', () => {
    const p = findPath(yard, [1, 1], [[8, 3]])!;
    assert.equal(p.length, 9);
    assert.deepEqual(p.at(-1), [8, 3]);
    for (let i = 1; i < p.length; i++) {
      assert.equal(Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]), 1);
    }
  });

  it('gives an empty path when already there, null when there is no way', () => {
    assert.deepEqual(findPath(yard, [1, 1], [[1, 1]]), []);
    assert.equal(findPath(yard, [1, 1], [[4, 5]]), null);
  });

  it('walks round people standing in the way', () => {
    const p = findPath(yard, [1, 3], [[3, 3]], new Set([key(2, 3)]))!;
    assert.ok(p.length > 2);
    assert.ok(!p.some(([x, y]) => x === 2 && y === 3));
  });

  it('walks as near as it can to an unreachable tile', () => {
    const w = walkTo(yard, [1, 1], [4, 5]);
    assert.equal(w.arrived, false);
    assert.equal(Math.abs(w.end[0] - 4) + Math.abs(w.end[1] - 5), 2);
    const wall = walkTo(yard, [1, 1], [0, 1]);
    assert.deepEqual(wall.end, [1, 1]);
    assert.deepEqual(wall.path, []);
  });

  it('walks up to a person and faces them', () => {
    const a = approach(yard, [1, 1], [8, 3]);
    assert.equal(a.arrived, true);
    assert.deepEqual(a.end, [7, 3]);
    assert.equal(a.facing, 'right');
    const here = approach(yard, [7, 3], [8, 3]);
    assert.deepEqual(here.path, []);
    assert.equal(here.facing, 'right');
  });

  it('talks across a counter', () => {
    // 0 is the shopkeeper behind the counter (row 2 is the counter).
    const shop = gridFromRows(['#####', '#...#', '#####', '#...#', '#####']);
    const blocked = approach(shop, [1, 3], [2, 1]);
    assert.equal(blocked.arrived, false);
    const across = approach(shop, [1, 3], [2, 1], undefined, 2);
    assert.equal(across.arrived, true);
    assert.deepEqual(across.end, [2, 3]);
    assert.equal(across.facing, 'up');
  });

  it('knows directions', () => {
    assert.equal(facingToward([2, 2], [2, 0]), 'up');
    assert.equal(facingToward([2, 2], [0, 3]), 'left');
    assert.deepEqual(ahead([2, 2], 'down'), [2, 3]);
  });
});
