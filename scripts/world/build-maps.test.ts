import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MapError, parseMap, type Legend } from '../../src/world/core/maptext';
import { zoomFor } from '../../src/world/engine/look';
import { checkMaps, loadAll, toTiled } from './build-maps';
import { findPath, gridFromLayer } from '../../src/world/core/grid';
import { hoodOf } from '../../src/world/core/hoods';
import { STATIONS } from '../../src/world/core/travel';
import type { Tile } from '../../src/world/core/types';
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

  it('lets a map add letters of its own for a layer (§13 V2)', () => {
    const m = parseMap(text().replace('district: gulou', 'district: gulou\nbelow_keys: 1=pitch-green-ridge-l 2=pitch-green-ridge').replace('bDb', '12b'), legend);
    assert.deepEqual(m.layers.below.slice(0, 3), ['pitch-green-ridge-l', 'pitch-green-ridge', 'brick']);
    assert.throws(() => parseMap(text().replace('district: gulou', 'district: gulou\nbelow_keys: 12=x'), legend), /below_keys: "12=x"/);
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

  it('the north–south streets walk end to end (§13 T1, T4)', () => {
    const all = new Map(loadAll().map((c) => [c.map.id, c.map]));
    for (const id of ['nanluo-main', 'wangfujing-street', 'qianmen-street']) {
      const m = all.get(id)!;
      const g = gridFromLayer(m.width, m.height, (x, y) => m.collide[y * m.width + x] !== 0);
      const open = (y: number) => [...Array(m.width).keys()].filter((x) => !g.blocked[y * m.width + x]).map((x) => [x, y] as Tile);
      // the first and last open rows: the street's two ends
      const rows = [...Array(m.height).keys()].filter((y) => open(y).length);
      const [top, bottom] = [open(rows[0]!)[0]!, open(rows.at(-1)!)];
      assert.ok(findPath(g, top, bottom), `${id}: no way from its north end to its south end`);
    }
  });

  it('every station hall is a station of the lines, and its way out is in that station’s neighbourhood (§13 T5)', () => {
    for (const { map, objects } of loadAll()) {
      if (!map.id.startsWith('station-')) continue;
      const id = map.id.slice('station-'.length);
      assert.ok(STATIONS.some((s) => s.id === id), `${map.id}: no station ${id} in travel.ts`);
      const exits = objects.filter((o) => o.kind === 'door');
      assert.ok(exits.length, `${map.id}: no way out`);
      for (const d of exits) {
        if (d.kind !== 'door') continue;
        const hood = hoodOf(d.to.map);
        assert.ok(hood?.stations.includes(id) || hoodOf(map.id)?.id === hood?.id, `${map.id}: its way out leads to ${d.to.map}, in another neighbourhood`);
      }
    }
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
