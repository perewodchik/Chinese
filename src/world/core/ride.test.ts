import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { board, callNext, fareOut, getOff, nextStop, runOn, startRide, stopMap, trainsAt } from './ride';

describe('a subway ride', () => {
  it('lists the trains at a station, both ways, named as the signs name them', () => {
    const t = trainsAt('nanluoguxiang').map((x) => `${x.name} ${x.towards}`);
    assert.ok(t.includes('8号线 往天桥方向'));
    assert.ok(t.includes('8号线 往奥林匹克公园方向'));
    assert.ok(t.some((x) => x.startsWith('6号线')));
  });

  it('only one way at the end of a line', () => {
    assert.deepEqual(trainsAt('tianqiao').filter((x) => x.line === 'l8').map((x) => x.dir), [-1]);
  });

  it('南锣鼓巷 → 王府井 on line 8, change to line 1, get off at 天安门东', () => {
    let r = startRide('nanluoguxiang');
    const l8 = trainsAt('nanluoguxiang').find((x) => x.line === 'l8' && x.dir === 1)!;
    r = board(r, l8);
    assert.match(callNext('l8', r.at, 1)!, /下一站：中国美术馆/);
    r = runOn(r);
    r = runOn(r);
    assert.match(callNext('l8', r.at, 1)!, /下一站：王府井。可以换乘1号线/);
    r = runOn(r);
    assert.equal(r.at, 'wangfujing');
    r = getOff(r);
    const l1 = trainsAt('wangfujing').find((x) => x.line === 'l1' && nextStop('l1', 'wangfujing', x.dir) === 'tiananmendong')!;
    r = runOn(board(r, l1));
    assert.equal(r.at, 'tiananmendong');
    assert.equal(r.stops, 4);
    assert.equal(fareOut(r), 3);
  });

  it('the end of the line: everyone off', () => {
    const r = runOn(board(startRide('tianqiao'), { line: 'l8', dir: 1, name: '8号线', towards: '' }));
    assert.equal(r.train, null);
    assert.equal(r.at, 'tianqiao');
  });

  it('buses: 332 from 西直门 to 颐和园, 2 元; stops on stop- maps', () => {
    const bus = trainsAt('xizhimen', 'bus');
    assert.deepEqual(bus.map((b) => b.name), ['332路']);
    let r = board(startRide('xizhimen'), bus[0]!);
    r = runOn(runOn(r));
    assert.equal(r.at, 'yiheyuan');
    assert.equal(fareOut(r, 'bus'), 2);
    assert.equal(stopMap('yiheyuan', 'bus'), 'stop-yiheyuan');
    assert.equal(stopMap('nanluoguxiang'), 'station-nanluoguxiang');
    assert.match(callNext('b332', 'xizhimen', 1)!, /下一站：动物园/);
  });

  it('no ride, no fare', () => {
    assert.equal(fareOut(startRide('nanluoguxiang')), 0);
  });
});
