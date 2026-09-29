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
    // 鼓楼 by 烟袋斜街 to 后海 to 北海 is a walk (§13 T1)
    assert.deepEqual(walkPath(index, 'gulou-square', 'jingshan-park'), ['gulou-square', 'yandai-xiejie', 'houhai-lake', 'beihai-north', 'jingshan-park']);
    // 南锣鼓巷 runs north to 鼓楼东大街 and south to the station's street
    assert.deepEqual(walkPath(index, 'gulou-dongdajie', 'station-nanluoguxiang'), ['gulou-dongdajie', 'nanluo-main', 'subway-lane', 'station-nanluoguxiang']);
    // §13 T4: the palace in its real order, and 神武门 a way out only
    assert.deepEqual(walkPath(index, 'wumen', 'yuhuayuan'), ['wumen', 'taihedian', 'qianqinggong', 'yuhuayuan']);
    assert.deepEqual(walkPath(index, 'yuhuayuan', 'jiaolou'), ['yuhuayuan', 'jiaolou']);
    assert.equal(walkPath(index, 'jiaolou', 'yuhuayuan'), null);
    assert.deepEqual(walkPath(index, 'qianmen-street', 'ruifuxiang'), ['qianmen-street', 'dashilar', 'ruifuxiang']);
    // across town needs a ride
    assert.equal(walkPath(index, 'nanluo-main', 'panjiayuan-market'), null);
  });
});
