import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { districtFrame, PLACES, placeOf, walkPath, type MapLinks } from './places';

const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as MapLinks;

describe('the city map', () => {
  it('draws every map of the game, once, inside the drawing', () => {
    for (const m of Object.keys(index)) assert.ok(placeOf(m), m);
    assert.equal(new Set(PLACES.map((p) => p.map)).size, PLACES.length);
    for (const p of PLACES) {
      assert.ok(index[p.map], p.map);
      assert.ok(p.at[0] >= 0 && p.at[0] <= 160 && p.at[1] >= 0 && p.at[1] <= 100, p.map);
    }
  });

  it('keeps the places of the map apart from each other', () => {
    const shown = PLACES.filter((p) => !p.apart);
    for (const a of shown)
      for (const b of shown) if (a !== b) assert.ok(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) > 1.5, `${a.map} ~ ${b.map}`);
  });

  it('finds the way on foot through doors and edges', () => {
    assert.deepEqual(walkPath(index, 'siheyuan-room', 'chaguan'), ['siheyuan-room', 'siheyuan-yard', 'hutong-home', 'nanluo-main', 'chaguan']);
    // 鼓楼 to 后海 to 北海 is a walk
    assert.deepEqual(walkPath(index, 'gulou-square', 'jingshan-park'), ['gulou-square', 'houhai-lake', 'beihai-north', 'jingshan-park']);
    // across town needs a ride
    assert.equal(walkPath(index, 'nanluo-main', 'panjiayuan-market'), null);
  });

  it('frames each district around its places', () => {
    const f = districtFrame('gulou', index)!;
    for (const p of PLACES.filter((p) => index[p.map]?.district === 'gulou' && !p.apart)) assert.ok(p.at[0] > f.x && p.at[0] < f.x + f.w, p.map);
    assert.ok(Math.abs(f.w / f.h - 1.6) < 0.01);
  });
});
