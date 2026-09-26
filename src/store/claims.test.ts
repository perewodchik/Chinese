import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY, grade, isClaimOnly } from '../domain/memory';
import { reduce, type Action } from './actions';
import { hydrate, serialise } from './migrations';
import { emptyState, type AppState } from './state';

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reduce, state);
const tick = (value: boolean, at: number): Action => ({ type: 'recall/setLearned', ids: ['c好'], value, at });
const answer = (rating: 'again' | 'good', at: number, skill: 'recognise' | 'sound' = 'recognise'): Action => ({
  type: 'recall/grade',
  results: [{ id: 'c好', skill, rating }],
  at,
});

describe('ticking and unticking learned', () => {
  it('takes back a claim that was never answered for, leaving nothing behind', () => {
    const state = run(emptyState(), tick(true, 1), tick(false, 2));
    assert.equal(state.recall['c好'], undefined);
    assert.equal(state.learned.has('c好'), false);
  });

  it('keeps the answers behind a character when it is unticked, and makes it due', () => {
    const earned = run(emptyState(), tick(true, 1), answer('good', 10 * DAY), answer('again', 40 * DAY));
    const before = earned.recall['c好'].recognise!;
    const state = run(earned, tick(false, 41 * DAY));
    const after = state.recall['c好'].recognise!;
    assert.equal(state.learned.has('c好'), false);
    assert.equal(after.reps, before.reps);
    assert.equal(after.lapses, before.lapses);
    assert.equal(after.since, 1);
    assert.equal(after.due, 41 * DAY);
  });

  it('renews a claim over a failed character without wiping its lapses', () => {
    const failed = run(emptyState(), tick(true, 1), answer('again', 5 * DAY), answer('again', 6 * DAY));
    assert.equal(failed.learned.has('c好'), false);
    const lapses = failed.recall['c好'].recognise!.lapses;
    const state = run(failed, tick(true, 7 * DAY));
    assert.ok(state.learned.has('c好'));
    assert.equal(state.recall['c好'].recognise!.lapses, lapses);
    assert.equal(isClaimOnly(state.recall['c好'].recognise), false);
  });

  it('keeps the claim mark through a save and load, and loses it on the first answer', () => {
    const claimed = run(emptyState(), tick(true, 1));
    assert.equal(claimed.recall['c好'].recognise!.claim, true);
    const loaded = hydrate(JSON.parse(JSON.stringify(serialise(claimed))));
    assert.equal(loaded.recall['c好'].recognise!.claim, true);
    const answered = run(claimed, answer('good', 3 * DAY));
    assert.equal(answered.recall['c好'].recognise!.claim, undefined);
  });

  it('recognises a claim written before claims were marked', () => {
    const legacy = { s: 9, d: 5, last: 1, since: 1, due: 9 * DAY, reps: 1, lapses: 0 };
    assert.ok(isClaimOnly(legacy));
    assert.equal(isClaimOnly(grade(undefined, 'good', 1)), false);
  });
});

describe('a weighted answer', () => {
  it('buys less time for a pick from several than for a full answer', () => {
    const full = grade(undefined, 'good', 0, 'sound');
    const pick = grade(undefined, 'good', 0, 'sound', 0.5);
    assert.ok(pick.s < full.s);
    const fullNext = grade(full, 'good', 3 * DAY, 'sound');
    const pickNext = grade(full, 'good', 3 * DAY, 'sound', 0.5);
    assert.ok(pickNext.s < fullNext.s);
    assert.ok(pickNext.s > full.s);
  });

  it('costs the same when it is wrong', () => {
    const start = grade(undefined, 'good', 0);
    assert.deepEqual(grade(start, 'again', DAY, 'recognise', 0.5), grade(start, 'again', DAY));
  });
});

describe('the day’s tally', () => {
  it('counts answers and texts read on the day they happen, and survives a save', () => {
    const at = new Date(2026, 8, 24, 10).getTime();
    const state = run(emptyState(), answer('good', at), answer('again', at + 1000), {
      type: 'activity/log',
      at,
      add: { spoken: 2 },
    });
    assert.deepEqual(state.activity['2026-09-24'], { answers: 2, right: 1, read: 0, spoken: 2, videos: 0 });
    const loaded = hydrate(JSON.parse(JSON.stringify(serialise(state))));
    assert.deepEqual(loaded.activity, state.activity);
  });
});
