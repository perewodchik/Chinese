import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pendingSheets } from './memory';

describe('printed sheets waiting to be marked', () => {
  const DAY = 86_400_000;
  const NOW = Date.UTC(2026, 10, 12);
  const sheet = (id: string, printedDaysAgo: number, graded = false) => ({ id, name: id, items: [], printedAt: NOW - printedDaysAgo * DAY, gradedAt: graded ? NOW : null });

  it('offers the ones not marked from the last thirty days, the oldest first, and lets older ones go', () => {
    const waiting = pendingSheets([sheet('new', 1), sheet('month', 30), sheet('old', 31), sheet('marked', 2, true)], NOW);
    assert.deepEqual(waiting.map((s) => s.id), ['month', 'new']);
  });
});
