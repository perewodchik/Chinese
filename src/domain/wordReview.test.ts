import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Collection } from './collection';
import { asserted, DAY, grade, type RecallBook } from './memory';
import { introducedToday, planWordSitting, summariseWords, wordPool } from './wordReview';

const NOW = new Date(2026, 8, 24, 15, 0).getTime();

const collection = (id: string, items: string[], createdAt: number, presetId?: string): Collection =>
  ({ id, name: id, items, createdAt, updatedAt: createdAt, presetId }) as Collection;

describe('reviewing words', () => {
  const collections = [
    collection('mine', ['w挂号', 'c挂'], 1),
    collection('hsk2', ['w机场', 'w出门'], 3, 'words-hsk-2'),
    collection('hsk1', ['w东西', 'w一点儿', 'w机场'], 2, 'words-hsk-1'),
  ];

  it('takes new words from the band collections first, lowest band first, each once', () => {
    const { waiting } = wordPool({}, collections);
    assert.deepEqual(waiting, ['w东西', 'w一点儿', 'w机场', 'w出门', 'w挂号']);
  });

  it('leaves out of the waiting list a word that already has a record', () => {
    const book: RecallBook = { 'w东西': { recognise: grade(undefined, 'hard', NOW - DAY) } };
    const pool = wordPool(book, collections);
    assert.deepEqual(pool.reviewed, ['w东西']);
    assert.ok(!pool.waiting.includes('w东西'));
  });

  it('counts only collected words begun today towards the day’s new words — not a sweep’s claims', () => {
    const book: RecallBook = {
      'w东西': { recognise: grade(undefined, 'hard', NOW - 3600_000) },
      'w一点儿': { recognise: grade(undefined, 'good', NOW - 2 * DAY) },
      'w我': { recognise: asserted(NOW, 9) },
    };
    assert.equal(introducedToday(book, collections, NOW), 1);
  });

  it('stops bringing in new words once the day’s are used up', () => {
    const book: RecallBook = { 'w东西': { recognise: grade(undefined, 'hard', NOW - 3600_000) } };
    assert.equal(summariseWords(book, collections, 1, NOW).fresh, 0);
    assert.equal(summariseWords(book, collections, 3, NOW).fresh, 2);
    const sitting = planWordSitting(book, collections, 30, 3, NOW);
    assert.equal(sitting.fresh, 2);
    assert.deepEqual(sitting.ids.filter((id) => !book[id]), ['w一点儿', 'w机场']);
  });

  it('asks about a word once it falls due', () => {
    const book: RecallBook = { 'w东西': { recognise: grade(undefined, 'hard', NOW - 2 * DAY) } };
    assert.equal(summariseWords(book, collections, 0, NOW).due, 1);
    assert.deepEqual(planWordSitting(book, collections, 30, 0, NOW).ids, ['w东西']);
  });
});
