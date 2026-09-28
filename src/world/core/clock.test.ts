import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  advance,
  clockAt,
  dayOf,
  formatTime,
  hourOf,
  inHours,
  isRunning,
  partOfDay,
  pause,
  resume,
  sleep,
  START_MINUTES,
  waitUntil,
} from './clock';

const at = (day: number, h: number, m = 0) => (day - 1) * 1440 + h * 60 + m;

describe('clock', () => {
  it('starts on day 1 at 7:00', () => {
    assert.equal(dayOf(START_MINUTES), 1);
    assert.equal(formatTime(START_MINUTES), '7:00');
  });

  it('reads day, hour and time across midnight', () => {
    assert.equal(dayOf(at(1, 23, 59)), 1);
    assert.equal(dayOf(at(2, 0)), 2);
    assert.equal(hourOf(at(3, 21, 30)), 21);
    assert.equal(formatTime(at(2, 9, 5)), '9:05');
    assert.equal(formatTime(at(2, 9, 5) + 0.9), '9:05');
  });

  it('names the parts of the day at their edges', () => {
    assert.equal(partOfDay(at(1, 5, 59)), 'night');
    assert.equal(partOfDay(at(1, 6)), 'morning');
    assert.equal(partOfDay(at(1, 10, 59)), 'morning');
    assert.equal(partOfDay(at(1, 11)), 'day');
    assert.equal(partOfDay(at(1, 17)), 'evening');
    assert.equal(partOfDay(at(1, 20, 59)), 'evening');
    assert.equal(partOfDay(at(1, 21)), 'night');
    assert.equal(partOfDay(at(1, 0)), 'night');
  });

  it('checks hour ranges, wrapping midnight', () => {
    assert.equal(inHours(at(1, 9), [9, 21]), true);
    assert.equal(inHours(at(1, 21), [9, 21]), false);
    assert.equal(inHours(at(1, 23), [21, 6]), true);
    assert.equal(inHours(at(1, 3), [21, 6]), true);
    assert.equal(inHours(at(1, 6), [21, 6]), false);
    assert.equal(inHours(at(1, 12), [0, 0]), true);
  });

  it('runs one game hour per real minute', () => {
    const c = advance(clockAt(START_MINUTES), 60_000);
    assert.equal(formatTime(c.minutes), '8:00');
    assert.equal(advance(clockAt(0), 1000).minutes, 1);
  });

  it('stops while anything holds it, and runs when all have let go', () => {
    let c = pause(clockAt(100), 'dialogue');
    c = pause(c, 'hidden');
    c = pause(c, 'hidden');
    assert.equal(c.pauses.length, 2);
    assert.equal(advance(c, 60_000).minutes, 100);
    c = resume(c, 'dialogue');
    assert.equal(isRunning(c), false);
    assert.equal(advance(c, 60_000).minutes, 100);
    c = resume(c, 'hidden');
    assert.equal(isRunning(c), true);
    assert.equal(advance(c, 60_000).minutes, 160);
    assert.equal(resume(c, 'nothing'), c);
  });

  it('sleeps to the next 7:00', () => {
    assert.equal(sleep(at(1, 22)), at(2, 7));
    assert.equal(sleep(at(2, 2)), at(2, 7));
    assert.equal(sleep(at(2, 7)), at(3, 7));
    assert.equal(sleep(at(2, 6, 59)), at(2, 7));
  });

  it('waiting runs to the next time the clock shows that hour', () => {
    assert.equal(waitUntil(at(1, 10), 19), at(1, 19));
    assert.equal(waitUntil(at(1, 20), 19), at(2, 19));
    assert.equal(waitUntil(at(1, 19), 19), at(2, 19));
  });
});
