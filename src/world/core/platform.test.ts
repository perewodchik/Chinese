import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { doorMap, doorsOpen, platformLines, platformTrains, sideOf, stopsAhead, stopsBehind } from './platform';
import { line, LINES } from './travel';

describe('a subway platform (MT)', () => {
  it('has one direction on each side', () => {
    const t = platformTrains('wangfujing', 'l1');
    assert.equal(t.top?.dir, -1);
    assert.equal(t.bottom?.dir, 1);
    assert.match(t.top!.towards, /往.+方向/);
    assert.notEqual(t.top!.towards, t.bottom!.towards);
  });

  it('has no train on the side that goes nowhere at the end of a line', () => {
    const l1 = line('l1');
    const first = platformTrains(l1.stops[0]!, 'l1');
    assert.equal(first.top, null);
    assert.ok(first.bottom);
    const last = platformTrains(l1.stops.at(-1)!, 'l1');
    assert.equal(last.bottom, null);
    assert.ok(last.top);
  });

  it('runs both ways round the loop, named 外环 and 内环', () => {
    const t = platformTrains('qianmen', 'l2');
    assert.ok(t.top && t.bottom);
    assert.deepEqual(new Set([t.top.towards, t.bottom.towards]), new Set(['外环', '内环']));
  });

  it('lists every subway line with a platform at an interchange', () => {
    assert.deepEqual(new Set(platformLines('wangfujing')), new Set(['l1', 'l8']));
    for (const l of LINES.filter((x) => x.mode === 'subway')) for (const st of l.stops) assert.ok(platformLines(st).includes(l.id));
  });

  it('puts a direction on one side, always the same', () => {
    assert.equal(sideOf(-1), 'top');
    assert.equal(sideOf(1), 'bottom');
  });
});

describe('the train’s screens (MT)', () => {
  it('the stops ahead and behind are the line in order', () => {
    const s = line('l1').stops;
    const i = s.indexOf('wangfujing');
    assert.deepEqual(stopsAhead('l1', 'wangfujing', 1, 2), [s[i + 1], s[i + 2]]);
    assert.deepEqual(stopsBehind('l1', 'wangfujing', 1, 2), [s[i - 1], s[i - 2]]);
    assert.deepEqual(stopsAhead('l1', s.at(-1)!, 1, 3), []);
  });

  it('the door map is a window round the train, in the way it goes', () => {
    const m = doorMap('l1', 'wangfujing', -1, 2, 3);
    assert.equal(m.stops[m.here], 'wangfujing');
    assert.equal(m.here, 2);
    const s = line('l1').stops;
    const i = s.indexOf('wangfujing');
    assert.deepEqual(m.stops, [s[i + 2], s[i + 1], s[i], s[i - 1], s[i - 2], s[i - 3]]);
  });

  it('a loop’s door map never shows a stop twice', () => {
    const m = doorMap('l2', 'qianmen', 1, 3, 5);
    assert.equal(new Set(m.stops).size, m.stops.length);
  });

  it('doors open on alternating sides down a line', () => {
    const s = line('l8').stops;
    assert.notEqual(doorsOpen('l8', s[0]!), doorsOpen('l8', s[1]!));
  });
});
