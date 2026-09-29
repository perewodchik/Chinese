import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PLACES, placeOf, walkPath, type MapLinks } from './places';

const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as MapLinks;

describe('places', () => {
  it('name every map of the game, once', () => {
    for (const m of Object.keys(index)) assert.ok(placeOf(m), m);
    assert.equal(new Set(PLACES.map((p) => p.map)).size, PLACES.length);
    for (const p of PLACES) assert.ok(index[p.map], p.map);
  });

  it('find the way on foot through doors and edges', () => {
    assert.deepEqual(walkPath(index, 'siheyuan-room', 'chaguan'), ['siheyuan-room', 'siheyuan-yard', 'hutong-home', 'nanluo-main', 'chaguan']);
    // 鼓楼 to 后海 to 北海 is a walk
    assert.deepEqual(walkPath(index, 'gulou-square', 'jingshan-park'), ['gulou-square', 'houhai-lake', 'beihai-north', 'jingshan-park']);
    // across town needs a ride
    assert.equal(walkPath(index, 'nanluo-main', 'panjiayuan-market'), null);
  });
});
