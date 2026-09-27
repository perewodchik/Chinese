import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayKey, logDay, type Activity } from './activity';
import { DAY, grade, type RecallBook } from './memory';
import { bucketed, days, goalStreak, records, snapshotOf, weekCompare, weekOf, weeklyNote } from './stats';

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 9, 27); // a Sunday

/** An item met on `t` and answered well twice since, so it counts as learned. */
function learnedOn(t: number) {
  const a = grade(undefined, 'good', t, 'recognise');
  return { recognise: grade(a, 'good', t + 2 * DAY, 'recognise') };
}

const book: RecallBook = {
  c好: learnedOn(at(2026, 9, 20)),
  c人: learnedOn(at(2026, 9, 22)),
  w你好: learnedOn(at(2026, 9, 22)),
  c大: { recognise: grade(undefined, 'again', at(2026, 9, 26), 'recognise') },
};

describe('stats', () => {
  it('counts what is known now', () => {
    const s = snapshotOf(book, NOW);
    assert.equal(s.chars, 2);
    assert.equal(s.words, 1);
  });

  it('estimates the days before any snapshot from when things were first met', () => {
    const list = days({}, book, NOW, 10);
    assert.equal(list.length, 10);
    assert.equal(list[list.length - 1]!.key, dayKey(NOW));
    const byKey = new Map(list.map((d) => [d.key, d]));
    assert.equal(byKey.get('2026-09-19')!.chars, 0);
    assert.equal(byKey.get('2026-09-20')!.chars, 1);
    assert.equal(byKey.get('2026-09-22')!.chars, 2);
    assert.equal(byKey.get('2026-09-22')!.words, 1);
    assert.ok(byKey.get('2026-09-22')!.estimated);
    assert.equal(byKey.get('2026-09-20')!.newChars, 1);
    assert.equal(byKey.get('2026-09-26')!.newChars, 1);
    // today is read live
    assert.equal(list[list.length - 1]!.estimated, false);
  });

  it('uses a snapshot where there is one, and carries it forward', () => {
    let a: Activity = {};
    a = logDay(a, at(2026, 9, 23), { answers: 3, right: 3, snap: { chars: 40, words: 7, solid: 0, holding: 0, shaky: 0, fresh: 0 } });
    const byKey = new Map(days(a, book, NOW, 10).map((d) => [d.key, d]));
    assert.equal(byKey.get('2026-09-23')!.chars, 40);
    assert.equal(byKey.get('2026-09-25')!.chars, 40);
    assert.equal(byKey.get('2026-09-25')!.estimated, false);
    assert.equal(byKey.get('2026-09-22')!.estimated, true);
  });

  it('folds days into Monday weeks', () => {
    assert.equal(weekOf('2026-09-27'), '2026-09-21');
    assert.equal(weekOf('2026-09-21'), '2026-09-21');
    const weeks = bucketed(days({}, book, NOW, 14), 'week');
    assert.equal(weeks[weeks.length - 1]!.key, '2026-09-21');
    assert.equal(weeks[weeks.length - 1]!.newChars, 2);
  });

  it('compares the last seven days with the seven before', () => {
    let a: Activity = {};
    a = logDay(a, at(2026, 9, 25), { answers: 10, right: 8, ms: 600_000 });
    a = logDay(a, at(2026, 9, 15), { answers: 4, right: 4 });
    const { now, before } = weekCompare(days(a, book, NOW, 14));
    assert.equal(now.answers, 10);
    assert.equal(now.accuracy, 0.8);
    assert.equal(now.minutes, 10);
    assert.equal(before.answers, 4);
  });

  it('keeps records', () => {
    const r = records(days({}, book, NOW, 14));
    assert.equal(r.bestDay!.key, '2026-09-22');
    assert.equal(r.bestDay!.items, 2);
  });

  it('lets one missed day a week rest without breaking the run', () => {
    let a: Activity = {};
    for (const d of [21, 22, 24, 25, 26]) a = logDay(a, at(2026, 9, d), { answers: 1 });
    const loose = goalStreak(a, NOW, { dailyGoal: 'plan', goalMinutes: 15, restDays: true });
    assert.equal(loose.current, 5);
    assert.ok(loose.rested.has('2026-09-23'));
    const strict = goalStreak(a, NOW, { dailyGoal: 'plan', goalMinutes: 15, restDays: false });
    assert.equal(strict.current, 3);
    assert.equal(strict.best, 3);
    // a second miss in the same week breaks it
    a = {};
    for (const d of [21, 23, 26]) a = logDay(a, at(2026, 9, d), { answers: 1 });
    assert.equal(goalStreak(a, NOW, { dailyGoal: 'plan', goalMinutes: 15, restDays: true }).current, 1);
  });

  it('counts only days with enough minutes when the goal is minutes', () => {
    let a: Activity = {};
    a = logDay(a, at(2026, 9, 26), { answers: 1, ms: 5 * 60_000 });
    assert.equal(goalStreak(a, NOW, { dailyGoal: 'minutes', goalMinutes: 15, restDays: false }).current, 0);
    a = logDay(a, at(2026, 9, 26), { ms: 10 * 60_000 });
    assert.equal(goalStreak(a, NOW, { dailyGoal: 'minutes', goalMinutes: 15, restDays: false }).current, 1);
  });

  it('writes a note on Monday about last week', () => {
    const monday = at(2026, 9, 28);
    let a: Activity = {};
    a = logDay(a, at(2026, 9, 25), { answers: 10, right: 9 });
    const note = weeklyNote(days(a, book, monday, 21), monday);
    assert.match(note!, /Last week: 2 new characters, 1 word, 90% right — your best week yet/);
    assert.equal(weeklyNote(days(a, book, NOW, 21), NOW), null);
  });
});
