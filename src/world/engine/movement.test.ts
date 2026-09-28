import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gridFromRows } from '../core/grid';
import type { MapObject } from '../core/types';
import { facingTo, objectAt, pinchTo, pinchZooms, planTap, stepOnce } from './movement';

const g = gridFromRows([
  '#######',
  '#.....#',
  '#.##..#',
  '#.....#',
  '#######',
]);
const objects: MapObject[] = [
  { kind: 'npc', id: 'wang-1', npc: 'wang', tile: [5, 1] },
  { kind: 'sign', id: 'exit', tile: [3, 2], text: '出口' },
  { kind: 'prop', id: 'tree', tile: [2, 2], frame: 'tree/huai', blocks: [1, 1] },
];
const occ = new Set(['5,1']);

describe('a tap', () => {
  it('on the ground walks there', () => {
    const p = planTap(g, objects, [1, 1], [4, 3], occ);
    assert.equal(p.kind, 'walk');
    assert.deepEqual(p.path.at(-1), [4, 3]);
  });

  it('on a wall walks as near as it can', () => {
    const p = planTap(g, objects, [1, 1], [6, 0], occ);
    assert.equal(p.kind, 'walk');
    assert.equal(p.arrived, false);
  });

  it('on a person walks beside them and faces them to talk', () => {
    const p = planTap(g, objects, [1, 3], [5, 1], occ);
    assert.equal(p.kind, 'talk');
    if (p.kind !== 'talk') return;
    assert.equal(p.npc, 'wang');
    const end = p.path.at(-1)!;
    assert.equal(Math.abs(end[0] - 5) + Math.abs(end[1] - 1), 1);
  });

  it('on a sign or a tree walks up and looks', () => {
    assert.equal(planTap(g, objects, [1, 1], [3, 2], occ).kind, 'look');
    const tree = planTap(g, objects, [4, 3], [2, 2], occ);
    assert.equal(tree.kind, 'look');
  });

  it('finds what stands on a tile', () => {
    assert.equal(objectAt(objects, [5, 1])?.id, 'wang-1');
    assert.equal(objectAt(objects, [4, 1]), undefined);
  });
});

describe('keys and holding', () => {
  it('steps ahead when free, only turns when not', () => {
    assert.deepEqual(stepOnce(g, [1, 1], 'right', occ).to, [2, 1]);
    assert.equal(stepOnce(g, [1, 1], 'up', occ).to, null);
    assert.equal(stepOnce(g, [4, 1], 'right', occ).to, null); // wang is there
  });

  it('holding points the way', () => {
    assert.equal(facingTo([2, 2], 6, 2.4), 'right');
    assert.equal(facingTo([2, 2], 2.6, 0), 'up');
    assert.equal(facingTo([2, 2], 2.5, 2.5), null);
  });
});

describe('pinch', () => {
  it('keeps whole-number zooms around the page zoom', () => {
    assert.deepEqual(pinchZooms(3), [3, 4]);
    assert.deepEqual(pinchZooms(2), [2, 3]);
    assert.deepEqual(pinchZooms(4), [3, 4, 5, 6]);
    assert.equal(pinchTo(3, 1.4), 4);
    assert.equal(pinchTo(3, 0.8), 3);
  });
});
