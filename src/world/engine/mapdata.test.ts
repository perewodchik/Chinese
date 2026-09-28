import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { walkable } from '../core/grid';
import { occupiedBy, readMap } from './mapdata';

const load = (id: string) => readMap(id, JSON.parse(readFileSync(`public/world/maps/${id}.json`, 'utf8')));

describe('reading a built map', () => {
  it('gives the walk grid, the objects and the district', () => {
    const m = load('hutong-proto');
    assert.equal(m.district, 'gulou');
    assert.equal(m.width, 32);
    assert.equal(walkable(m.grid, 14, 7), true); // the lane
    assert.equal(walkable(m.grid, 14, 4), false); // the wall
    assert.equal(walkable(m.grid, 6, 5), true); // the doorstep
    assert.equal(walkable(m.grid, 10, 6), false); // a parked bicycle
    assert.ok(m.objects.some((o) => o.kind === 'npc' && o.npc === 'auntie'));
    assert.ok(occupiedBy(m.objects).has('7,7'));
  });
});
