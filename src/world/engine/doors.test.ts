import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newSave } from '../core/save';
import type { MapObject } from '../core/types';
import { edgeAt, resolveArrival, throughDoor, throughEdge } from './doors';

const objects: MapObject[] = [
  { kind: 'edge', id: 'east', side: 'right', from: 4, to: 7, target: { map: 'lane-2', offset: -2 } },
  { kind: 'edge', id: 'north', side: 'up', from: 0, to: 3, target: { map: 'square', offset: 5 } },
];

describe('edges', () => {
  it('only inside the exit range, on the edge itself', () => {
    assert.equal(edgeAt(objects, [9, 5], 10, 10)?.id, 'east');
    assert.equal(edgeAt(objects, [9, 8], 10, 10), undefined);
    assert.equal(edgeAt(objects, [8, 5], 10, 10), undefined);
    assert.equal(edgeAt(objects, [2, 0], 10, 10)?.id, 'north');
  });

  it('comes in at the opposite side, moved by the offset', () => {
    const e = edgeAt(objects, [9, 5], 10, 10)!;
    assert.deepEqual(throughEdge(e, [9, 5]), { map: 'lane-2', tile: [0, 3], facing: 'right' });
    const n = edgeAt(objects, [2, 0], 10, 10)!;
    const a = throughEdge(n, [2, 0]);
    assert.deepEqual(a.tile, [7, -1]);
    assert.deepEqual(resolveArrival(a.tile, 20, 12), [7, 11]);
  });
});

describe('doors', () => {
  it('open, or say why not', () => {
    const d: MapObject = { kind: 'door', id: 'palace', tile: [3, 3], to: { map: 'gugong', tile: [1, 1] }, when: { item: 'ticket' }, locked: 'You need a ticket.' };
    if (d.kind !== 'door') throw new Error();
    assert.deepEqual(throughDoor(d, newSave('x', 0)), { open: false, why: 'You need a ticket.' });
    const withTicket = { ...newSave('x', 0), bag: { items: { ticket: 1 }, money: 0, card: null } };
    assert.deepEqual(throughDoor(d, withTicket), { open: true, to: { map: 'gugong', tile: [1, 1], facing: 'down' } });
  });
});
