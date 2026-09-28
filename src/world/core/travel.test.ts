import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { announcement, changesAt, findRoute, LINES, linesAt, routeText, STATIONS, subwayFare } from './travel';

const lines = (from: string, to: string) => findRoute(from, to)!.legs.map((l) => l.line);

describe('the network', () => {
  it('every stop is a known station, every station is on something', () => {
    const ids = new Set(STATIONS.map((s) => s.id));
    assert.equal(ids.size, STATIONS.length, 'station ids are unique');
    for (const l of LINES) for (const s of l.stops) assert.ok(ids.has(s), `${l.id}: ${s}`);
    for (const s of STATIONS) assert.ok(linesAt(s.id).length || s.id === 'beijingbeizhan', s.id);
  });

  it('lines meet at the real transfer stations', () => {
    const at = (id: string) => linesAt(id).map((l) => l.id).sort();
    assert.deepEqual(at('nanluoguxiang'), ['l6', 'l8']);
    assert.deepEqual(at('guloudajie'), ['l2', 'l8']);
    assert.deepEqual(at('yonghegong'), ['l2', 'l5']);
    assert.deepEqual(at('dongdan'), ['l1', 'l5']);
    assert.deepEqual(at('guomao'), ['l1', 'l10']);
    assert.deepEqual(at('wangfujing'), ['l1', 'l8']);
    assert.deepEqual(at('qianmen'), ['l2', 'l8']);
    assert.deepEqual(at('dongsi'), ['l5', 'l6']);
    assert.deepEqual(at('hujialou'), ['l10', 'l6']);
    assert.deepEqual(at('beitucheng'), ['l10', 'l8']);
    assert.deepEqual(at('tiananmendong'), ['l1']);
  });
});

describe('finding a route', () => {
  it('home to Tiananmen: Line 8 to 王府井, then Line 1 one stop', () => {
    const r = findRoute('nanluoguxiang', 'tiananmendong')!;
    assert.deepEqual(r.legs.map((l) => [l.line, l.to]), [['l8', 'wangfujing'], ['l1', 'tiananmendong']]);
    assert.equal(r.changes, 1);
    assert.equal(r.legs[0]!.direction, '往天桥方向');
    assert.equal(r.legs[1]!.direction, '往复兴门方向');
    assert.equal(routeText(r), 'Line 8 to 王府井, change to Line 1 to 天安门东.');
  });

  it('prefers no change over fewer stops', () => {
    // 南锣鼓巷 → 什刹海 → 鼓楼大街 on Line 8, no change.
    assert.deepEqual(lines('nanluoguxiang', 'guloudajie'), ['l8']);
    assert.deepEqual(lines('dongdan', 'tiantandongmen'), ['l5']);
  });

  it('goes round the Line 2 loop the short way, named 外环 / 内环', () => {
    const cw = findRoute('chegongzhuang', 'jishuitan')!;
    assert.deepEqual(cw.legs[0]!.stops, ['chegongzhuang', 'xizhimen', 'jishuitan']);
    assert.equal(cw.legs[0]!.direction, '外环');
    const ccw = findRoute('xizhimen', 'fuchengmen')!;
    assert.equal(ccw.legs[0]!.direction, '内环');
    assert.equal(ccw.stops, 2);
  });

  it('reaches the bus-only and train-only places', () => {
    const summer = findRoute('nanluoguxiang', 'yiheyuan')!;
    assert.equal(summer.legs.at(-1)!.line, 'b332');
    const wall = findRoute('nanluoguxiang', 'badalingchangcheng')!;
    assert.deepEqual(wall.legs.slice(-2).map((l) => l.mode), ['walk', 'train']);
    assert.equal(findRoute('tiantandongmen', 'panjiayuan')!.legs[0]!.line, 'b34');
  });

  it('nothing to find from a station to itself; unknown ids throw', () => {
    assert.equal(findRoute('dongsi', 'dongsi'), null);
    assert.throws(() => findRoute('dongsi', 'atlantis'));
  });

  it('charges like Beijing: by distance, one ticket through changes', () => {
    assert.equal(subwayFare(1), 3);
    assert.equal(subwayFare(4), 3);
    assert.equal(subwayFare(5), 4);
    assert.equal(subwayFare(10), 5);
    assert.equal(subwayFare(30), 7);
    assert.equal(findRoute('nanluoguxiang', 'tiananmendong')!.fare, 3);
    const summer = findRoute('nanluoguxiang', 'yiheyuan')!;
    assert.equal(summer.fare, subwayFare(summer.legs.filter((l) => l.mode === 'subway').reduce((n, l) => n + l.stops.length - 1, 0)) + 2);
  });
});

describe('announcements', () => {
  it('says the next station and the changes there', () => {
    assert.equal(announcement('l8', 'wangfujing'), '下一站：王府井。可以换乘1号线。');
    assert.equal(announcement('l1', 'tiananmendong'), '下一站：天安门东。');
    assert.equal(announcement('l8', 'tianqiao', true), '下一站：天桥，终点站。');
    assert.deepEqual(changesAt('dongsi', 'l6').map((l) => l.zh), ['5号线']);
  });
});
