import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../data/types';
import { asserted, DAY, grade, learnedFrom, type RecallBook } from './memory';
import { progressOf } from './progress';

const lib = (chars: Array<[string, number]>): Library =>
  ({
    characters: chars.map(([c, hsk]) => ({ c, hsk })),
    byChar: new Map(chars.map(([c, hsk]) => [c, { c, hsk }])),
  }) as unknown as Library;

const L = lib([
  ['一', 1],
  ['二', 1],
  ['三', 1],
  ['四', 2],
]);

const NOW = 100 * DAY;

describe('progressOf', () => {
  it('counts a band as current until every character in it is learned, and tells claims from reviews', () => {
    const recall: RecallBook = {
      c一: { recognise: asserted(NOW - 2 * DAY) },
      c二: { recognise: grade(grade(undefined, 'good', NOW - 20 * DAY), 'good', NOW - 3 * DAY) },
    };
    const p = progressOf(L, recall, learnedFrom(recall), [], NOW);
    assert.equal(p.current?.band, 1);
    assert.deepEqual(
      { size: p.bands[0]!.size, done: p.bands[0]!.done, proven: p.bands[0]!.proven },
      { size: 3, done: 2, proven: 1 },
    );
    assert.equal(p.learned, 2);
    assert.equal(p.proven, 1);
    assert.equal(p.inRotation, 2);
  });

  it('counts due and shaky per skill, and what was answered this week', () => {
    let failed = grade(undefined, 'good', NOW - 30 * DAY, 'sound');
    failed = grade(failed, 'again', NOW - 20 * DAY, 'sound');
    failed = grade(failed, 'again', NOW - 10 * DAY, 'sound');
    const recall: RecallBook = {
      c一: { recognise: asserted(NOW - 2 * DAY), sound: failed },
      c三: { recognise: grade(undefined, 'good', NOW - DAY) },
      r61: { recognise: asserted(NOW) },
    };
    const p = progressOf(L, recall, learnedFrom(recall), [], NOW);
    const sound = p.skills.find((s) => s.skill === 'sound')!;
    assert.equal(sound.seen, 1);
    assert.equal(sound.due, 1);
    assert.equal(sound.shaky, 1);
    // 三 answered yesterday; 一 only ticked this week and answered weeks ago.
    assert.equal(p.week.answered, 1);
    assert.equal(p.week.started, 1);
    // The radical is not a character in rotation.
    assert.equal(p.inRotation, 2);
    assert.equal(p.due, p.skills.reduce((n, s) => n + s.due, 0));
  });

  it('has no current band once everything is learned', () => {
    const one = lib([['一', 1]]);
    const recall: RecallBook = { c一: { recognise: asserted(NOW) } };
    assert.equal(progressOf(one, recall, learnedFrom(recall), [], NOW).current, null);
  });
});
