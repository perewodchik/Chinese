import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DistrictContent } from '../../src/world/core/types';
import { coverage, coverageProblems } from './coverage';

const district = (id: string, maps: string[], quests: unknown[], scenes: unknown[] = []) =>
  ({ district: { id, maps }, quests, scenes, npcs: [], shops: [] }) as unknown as DistrictContent;

describe('coverage (§13 Z0)', () => {
  const a = district('a', ['yard', 'lane', 'station-a', 'shop'], [
    { id: 'ch1', kind: 'main', steps: [{ id: 'meet', done: { scene: 'hello' } }, { id: 'go', where: 'lane', done: { flag: 'x' } }] },
    { id: 'side-1', kind: 'side', steps: [{ id: 'do', where: 'shop' }] },
    { id: 'sub-ma-1', kind: 'side', steps: [{ id: 'order', where: 'shop' }] },
  ], [{ id: 'hello', map: 'yard' }]);
  const b = district('b', ['park', 'station-b'], []);

  it('lists what points at each map', () => {
    const rows = coverage([a, b], [{ id: 'denglong', place: 'yard' }], ['hutong-proto']);
    const yard = rows.find((r) => r.map === 'yard')!;
    assert.deepEqual(yard.main, ['ch1/meet']);
    assert.deepEqual(yard.books, ['denglong']);
    const shop = rows.find((r) => r.map === 'shop')!;
    assert.deepEqual(shop.side, ['side-1/do']);
    assert.deepEqual(shop.substory, ['sub-ma-1/order']);
    assert.equal(rows.find((r) => r.map === 'hutong-proto')?.district, undefined);
  });

  it('fails a map on no main route, but not an exception or a stop of a district on a route', () => {
    const problems = coverageProblems(coverage([a, b], [], ['hutong-proto']));
    assert.deepEqual(problems, [
      'map shop (a) is on no main route',
      'map park (b) is on no main route',
      'map station-b (b) is on no main route',
    ]);
  });
});
