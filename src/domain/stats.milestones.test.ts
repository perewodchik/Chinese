import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nearestMilestones, type Milestone } from './stats';

const m = (id: string, have: number, need: number, reached: string | null = null): Milestone => ({ id, mark: '字', label: id, reached, have, need });

describe('the milestones shown first', () => {
  it('are the last reached and the two nearest not reached, by how much of the way is done', () => {
    const { last, next } = nearestMilestones([m('10', 10, 10, '2026-10-01'), m('50', 50, 50, '2026-11-01'), m('100', 60, 100), m('250', 60, 250), m('read-1', 0, 1), m('said-100', 90, 100)]);
    assert.equal(last?.id, '50');
    assert.deepEqual(next.map((x) => x.id), ['said-100', '100']);
  });

  it('has no last one before anything is reached', () => {
    assert.equal(nearestMilestones([m('10', 3, 10)]).last, null);
  });
});
