import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { castMap, looksOf } from './cast';
import { newSave } from './save';
import type { MapObject, NpcCard } from './types';

const card = (id: string, routine: NpcCard['routine'] = [], palette?: string): NpcCard => ({
  id, name: '王阿姨', role: 'r', look: { sprite: 'auntie', ...(palette ? { palette } : {}) }, character: '', knows: [], wants: [], actions: [], routine, explains: {},
});
const objects: MapObject[] = [
  { kind: 'npc', id: 'a', npc: 'wang', tile: [1, 1] },
  { kind: 'npc', id: 'b', npc: 'kid', tile: [2, 2], when: { flag: 'kid-home' } },
  { kind: 'sign', id: 's', tile: [0, 0], text: '门' },
];
const at = (h: number) => ({ ...newSave('d', 0), clock: h * 60 });

describe('who is on a map now', () => {
  it('keeps people without a routine where the map puts them, drops those whose when fails', () => {
    const c = castMap(objects, 'yard', [card('wang')], at(8));
    assert.deepEqual(c.map((o) => o.id), ['a', 's']);
  });

  it('moves a person to their routine spot here, and takes them away when it says elsewhere', () => {
    const wang = card('wang', [
      { hours: [7, 10], map: 'yard', tile: [5, 5], facing: 'left' },
      { hours: [10, 12], map: 'market', tile: [1, 1] },
    ]);
    const morning = castMap(objects, 'yard', [wang], at(8));
    assert.deepEqual(morning.find((o) => o.id === 'a'), { kind: 'npc', id: 'a', npc: 'wang', tile: [5, 5], facing: 'left' });
    assert.equal(castMap(objects, 'yard', [wang], at(11)).some((o) => o.id === 'a'), false);
    // no word about 15:00: at the map's spot
    const later = castMap(objects, 'yard', [wang], at(15)).find((o) => o.id === 'a');
    assert.deepEqual(later && 'tile' in later ? later.tile : null, [1, 1]);
  });

  it('brings in people whose routine leads here though the map does not name them', () => {
    const rider = card('rider', [{ hours: [11, 14], map: 'yard', tile: [3, 3] }]);
    const c = castMap(objects, 'yard', [card('wang'), rider], at(12));
    assert.deepEqual(c.find((o) => o.kind === 'npc' && o.npc === 'rider'), { kind: 'npc', id: 'routine-rider', npc: 'rider', tile: [3, 3] });
  });

  it('shows a prop only while its when holds', () => {
    const props: MapObject[] = [
      { kind: 'prop', id: 'whole', tile: [1, 1], frame: 'lantern/unlit', when: { not: { flag: 'broken' } } },
      { kind: 'prop', id: 'broken', tile: [1, 1], frame: 'lantern/broken', when: { flag: 'broken' } },
    ];
    assert.deepEqual(castMap(props, 'yard', [], at(8)).map((o) => o.id), ['whole']);
    assert.deepEqual(castMap(props, 'yard', [], { ...at(8), flags: ['broken'] }).map((o) => o.id), ['broken']);
  });

  it('draws people by their card\'s look and palette', () => {
    assert.deepEqual(looksOf([card('wang'), card('li', [], 'green')]), { wang: 'auntie', li: 'auntie-green' });
  });
});
