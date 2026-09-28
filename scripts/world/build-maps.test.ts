import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MapError, parseMap, type Legend } from '../../src/world/core/maptext';
import { zoomFor } from '../../src/world/engine/look';
import { checkMaps, loadAll, toTiled } from './build-maps';
import type { TilesetJson } from './art/build';

const legend: Legend = {
  ground: { p: 'paving' },
  below: { b: 'brick', D: 'door-bottom' },
  above: { e: 'roof-grey-eave' },
  walkable: ['door-bottom'],
};
const set: TilesetJson = { image: 'tiles-set.png', tileWidth: 16, tileHeight: 16, columns: 8, names: ['beijing/paving', 'beijing/brick', 'beijing/door-bottom', 'beijing/roof-grey-eave'] };
const text = (extra = '') => `id: t\nsize: 3x2\ndistrict: gulou\n\n[ground]\nppp\nppp\n[below]\nbDb\n...\n${extra}`;

describe('text maps', () => {
  it('reads layers through the legend; below blocks unless walkable', () => {
    const m = parseMap(text(), legend);
    assert.equal(m.width, 3);
    assert.deepEqual(m.layers.below.slice(0, 3), ['brick', 'door-bottom', 'brick']);
    assert.deepEqual([...m.collide], [1, 0, 1, 0, 0, 0]);
    assert.deepEqual(m.layers.above, ['', '', '', '', '', '']);
  });

  it('takes an explicit collide layer over the automatic one', () => {
    const m = parseMap(text('[collide]\n...\n.#.\n'), legend);
    assert.deepEqual([...m.collide], [0, 0, 0, 0, 1, 0]);
  });

  it('says file and line of a mistake', () => {
    assert.throws(() => parseMap(text().replace('bDb', 'bXb'), legend, 'x.map.txt'), /x\.map\.txt:9: \[below\] "X" is not in the legend/);
    assert.throws(() => parseMap(text().replace('bDb', 'bD'), legend), MapError);
    assert.throws(() => parseMap('id: t\n[ground]\np\n', legend), /size/);
  });

  it('compiles to Tiled JSON with gids from the tileset', () => {
    const map = parseMap(text(), legend);
    const tiled = toTiled({ map, objects: [{ kind: 'sign', id: 's', tile: [1, 1], text: '出口' }] }, set);
    const layer = (n: string) => tiled.layers.find((l) => l.name === n) as { data: number[] };
    assert.deepEqual(layer('ground').data, [1, 1, 1, 1, 1, 1]);
    assert.deepEqual(layer('below').data, [2, 3, 2, 0, 0, 0]);
    assert.deepEqual(layer('collide').data, [1, 0, 1, 0, 0, 0]);
    const objs = (tiled.layers.find((l) => l.name === 'objects') as { objects: Array<{ x: number; y: number; type: string }> }).objects;
    assert.deepEqual([objs[0]!.x, objs[0]!.y, objs[0]!.type], [16, 16, 'sign']);
  });

  it('finds doors to nowhere and people in walls', () => {
    const map = parseMap(text(), legend);
    const errs = checkMaps(
      [{ map, objects: [
        { kind: 'door', id: 'd', tile: [1, 0], to: { map: 'nowhere', tile: [0, 0] } },
        { kind: 'npc', id: 'n', npc: 'wang', tile: [0, 0] },
        { kind: 'sign', id: 's', tile: [9, 9], text: '出口' },
      ] }],
      set,
    );
    assert.equal(errs.length, 3, errs.join('\n'));
  });

  it('the real maps build clean', () => {
    const all = loadAll();
    assert.ok(all.length >= 2);
  });
});

describe('zoom', () => {
  it('×3 on an iPad, ×2 on a phone, ×4 on a big screen', () => {
    assert.equal(zoomFor(1024, 768), 3);
    assert.equal(zoomFor(768, 1024), 2);
    assert.equal(zoomFor(390, 844), 2);
    assert.equal(zoomFor(1920, 1080), 4);
  });
});
