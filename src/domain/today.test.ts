import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asserted, DAY, grade, type RecallBook } from './memory';
import type { GeneratedText, TextSet } from './text';
import { answeredSince, forecast, nextReading, readSince, reviewMinutes } from './today';

const text = (id: string, setId: string | null, createdAt: number, read = false, lastReadAt?: number) =>
  ({ id, setId, createdAt, read, lastReadAt, lines: [] }) as unknown as GeneratedText;
const set = (id: string, createdAt: number, order?: string[]): TextSet => ({ id, name: id, createdAt, order });

describe('today', () => {
  it('counts answers since a time, and not claims', () => {
    const book: RecallBook = {
      c一: { recognise: asserted(10 * DAY), sound: grade(undefined, 'good', 10 * DAY, 'sound') },
      c二: { recognise: grade(undefined, 'again', 5 * DAY) },
    };
    assert.equal(answeredSince(book, 9 * DAY), 1);
    assert.equal(answeredSince(book, 0), 2);
  });

  it('reads next the first unread text of the newest session, in its reading order', () => {
    const texts = [
      text('a1', 'old', 1),
      text('b1', 'new', 2, true),
      text('b2', 'new', 3),
      text('b3', 'new', 4),
    ];
    const sets = [set('old', 1), set('new', 2, ['b1', 'b3', 'b2'])];
    assert.equal(nextReading(texts, sets)?.id, 'b3');
  });

  it('falls back to an older session, then to loose texts, then to nothing', () => {
    const sets = [set('old', 1), set('new', 2)];
    assert.equal(nextReading([text('a1', 'old', 1), text('b1', 'new', 2, true)], sets)?.id, 'a1');
    assert.equal(nextReading([text('x', null, 5), text('y', null, 6)], [])?.id, 'y');
    assert.equal(nextReading([text('x', null, 5, true)], []), null);
  });

  it('counts texts read since a time, and estimates minutes', () => {
    assert.equal(readSince([text('a', null, 1, true, 5 * DAY), text('b', null, 1, true, DAY)], 2 * DAY), 1);
    assert.equal(reviewMinutes(0), 0);
    assert.equal(reviewMinutes(3), 1);
    assert.equal(reviewMinutes(45), 6);
  });
});

describe('forecast', () => {
  it('puts overdue into today and spreads the rest over the coming days', () => {
    const now = new Date(2026, 8, 24, 10).getTime();
    const at = (daysAhead: number) => ({ ...asserted(0), due: now + daysAhead * DAY });
    const book: RecallBook = {
      c一: { recognise: at(-3), sound: at(0.2) },
      c二: { recognise: at(1) },
      w东西: { recognise: at(2.9) },
      c三: { recognise: at(30) },
      r61: { recognise: at(0) },
    };
    const f = forecast(book, now, 7);
    assert.equal(f.length, 7);
    assert.deepEqual(
      f.map((d) => d.due),
      [2, 1, 0, 1, 0, 0, 0],
    );
  });
});
