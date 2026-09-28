import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gridFromRows, walkable } from '../core/grid';
import { borderTiles, crowdTrip, facingOf, idleNext, pigeonSpots, rand, scared } from './life';

const lane = gridFromRows([
  '##########',
  '..........',
  '..........',
  '##########',
]);

describe('street life', () => {
  it('passers-by cross the map from one side to the other', () => {
    const r = rand(7);
    for (let i = 0; i < 10; i++) {
      const trip = crowdTrip(lane, r)!;
      assert.ok(trip.length >= 5);
      const [a, b] = [trip[0]!, trip.at(-1)!];
      assert.ok(borderTiles(lane).some((t) => t[0] === a[0] && t[1] === a[1]));
      assert.ok(borderTiles(lane).some((t) => t[0] === b[0] && t[1] === b[1]));
      for (const t of trip) assert.ok(walkable(lane, t[0], t[1]));
    }
  });

  it('a closed room gives wanderers, or nothing if too small', () => {
    const room = gridFromRows(['#####', '#...#', '#####']);
    assert.equal(crowdTrip(room, rand(1)), null);
  });

  it('pigeons stand apart, on open ground, and flee when you come close', () => {
    const spots = pigeonSpots(lane, rand(3), 4);
    assert.equal(spots.length, 4);
    for (const s of spots) assert.ok(walkable(lane, s[0], s[1]));
    assert.equal(scared([3, 1], [4, 2]), true);
    assert.equal(scared([3, 1], [7, 2]), false);
  });

  it('people standing about blink, turn or stay still, every few seconds', () => {
    const r = rand(9);
    const acts = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const n = idleNext(r, 'down');
      assert.ok(n.after >= 1200 && n.after < 5000);
      acts.add(n.act);
    }
    assert.deepEqual([...acts].sort(), ['blink', 'still', 'turn']);
    assert.equal(facingOf([1, 1], [2, 1]), 'right');
  });
});
