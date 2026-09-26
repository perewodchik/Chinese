import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activityFrom, calendar, dayKey, logDay, mergeActivity, streakOf, type Activity } from './activity';

const day = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();
const NOW = day(2026, 9, 24); // a Thursday

describe('activity', () => {
  it('adds to the day things happen on', () => {
    let a: Activity = {};
    a = logDay(a, NOW, { answers: 3, right: 2 });
    a = logDay(a, NOW + 3_600_000, { spoken: 1, videos: 0 });
    a = logDay(a, day(2026, 9, 23), { read: 1 });
    assert.deepEqual(a[dayKey(NOW)], { answers: 3, right: 2, read: 0, spoken: 1, videos: 0 });
    assert.deepEqual(a['2026-09-23'], { answers: 0, right: 0, read: 1, spoken: 0, videos: 0 });
  });

  it('counts the run of days up to today, or up to yesterday while today is still empty', () => {
    let a: Activity = {};
    for (const d of [18, 19, 21, 22, 23]) a = logDay(a, day(2026, 9, d), { answers: 1 });
    assert.deepEqual(streakOf(a, NOW), { current: 3, best: 3, today: false });
    a = logDay(a, NOW, { spoken: 1, videos: 0 });
    assert.deepEqual(streakOf(a, NOW), { current: 4, best: 4, today: true });
    assert.equal(streakOf(a, day(2026, 9, 26)).current, 0);
  });

  it('draws whole weeks, Monday first, ending with this one', () => {
    const a = logDay({}, NOW, { answers: 10 });
    const rows = calendar(a, NOW, 5);
    assert.equal(rows.length, 5);
    assert.ok(rows.every((r) => r.length === 7));
    const last = rows[4]!;
    assert.equal(last[0]!.key, '2026-09-21');
    assert.equal(last[3]!.today, true);
    assert.equal(last[3]!.level, 4);
    assert.ok(last[4]!.future && last[6]!.future);
    assert.equal(rows[0]![0]!.key, '2026-08-24');
  });

  it('merges two copies of the same days without counting twice, and reads only what is sound', () => {
    const a = { '2026-09-24': { answers: 5, right: 4, read: 0, spoken: 2, videos: 0 } };
    const b = { '2026-09-24': { answers: 3, right: 3, read: 1, spoken: 0, videos: 0 }, '2026-09-20': { answers: 1, right: 1, read: 0, spoken: 0, videos: 0 } };
    assert.deepEqual(mergeActivity(a, b), {
      '2026-09-24': { answers: 5, right: 4, read: 1, spoken: 2, videos: 0 },
      '2026-09-20': { answers: 1, right: 1, read: 0, spoken: 0, videos: 0 },
    });
    assert.deepEqual(activityFrom({ bad: 1, '2026-09-01': { answers: 'x', read: 2 }, '2026-09-02': {} }), {
      '2026-09-01': { answers: 0, right: 0, read: 2, spoken: 0, videos: 0 },
    });
  });
});
