import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAY, levelOf } from '../domain/memory';
import { reduce, type Action } from './actions';
import { hydrate, serialise } from './migrations';
import { emptyState, type AppState } from './state';

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reduce, state);
const set = (level: 0 | 1 | 2 | 3, at: number): Action => ({ type: 'recall/setLevel', ids: ['c好'], level, at });
const answer = (rating: 'again' | 'good', at: number, skill: 'recognise' | 'write' = 'recognise'): Action => ({
  type: 'recall/grade',
  results: [{ id: 'c好', skill, rating }],
  at,
});

describe('setting the level by hand', () => {
  it('is the level until the next answer', () => {
    for (const l of [1, 2, 3] as const) {
      const s = run(emptyState(), set(l, 1_000));
      assert.equal(levelOf(s.recall['c好'], 2_000), l);
      assert.ok(s.learned.has('c好'));
    }
    const s = run(emptyState(), set(3, 1_000), answer('again', 2_000));
    assert.equal(levelOf(s.recall['c好'], 3_000), 0);
  });

  it('a slip in writing does not undo what you said about reading it', () => {
    const s = run(emptyState(), set(3, 1_000), answer('again', 2_000, 'write'));
    assert.equal(levelOf(s.recall['c好'], 3_000), 3);
  });

  it('holds a lower level over an older, stronger skill', () => {
    const s = run(emptyState(), answer('good', 1_000, 'write'), answer('good', 1_000 + 20 * DAY, 'write'), set(0, 1_000 + 21 * DAY));
    assert.equal(levelOf(s.recall['c好'], 1_000 + 21 * DAY), 0);
    assert.ok(!s.learned.has('c好'));
  });

  it('"Not known" on something only set leaves no record behind', () => {
    const s = run(emptyState(), set(2, 1_000), set(0, 2_000));
    assert.equal(s.recall['c好'], undefined);
  });

  it('keeps answers given before it', () => {
    const s = run(emptyState(), answer('good', 1_000), answer('again', 2_000), set(2, 3_000));
    assert.equal(s.recall['c好']!.recognise!.lapses, 1);
    assert.equal(levelOf(s.recall['c好'], 4_000), 2);
  });

  it('survives saving and loading', () => {
    const s = run(emptyState(), set(3, 1_000));
    const back = hydrate(JSON.parse(JSON.stringify(serialise(s))));
    assert.equal(back.recall['c好']!.recognise!.set, 3);
  });
});
