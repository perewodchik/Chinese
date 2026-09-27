import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkedRating, requeueAt, selfRating } from './grading';

test('self-graded: forgot is again, and the clock decides the rest', () => {
  assert.equal(selfRating(false, 500), 'again');
  assert.equal(selfRating(true, 1000), 'easy');
  assert.equal(selfRating(true, 5000), 'good');
  assert.equal(selfRating(true, 15_000), 'hard');
});

test('a first answer is never easy', () => {
  assert.equal(selfRating(true, 500, true), 'good');
  assert.equal(checkedRating({ ok: true, misses: 0, ms: 500, tier: 'type', first: true }), 'good');
});

test('checked answers: a slip makes it hard, only quick typing is easy', () => {
  assert.equal(checkedRating({ ok: false, misses: 2, ms: 900, tier: 'pick' }), 'again');
  assert.equal(checkedRating({ ok: true, misses: 1, ms: 900, tier: 'pick' }), 'hard');
  assert.equal(checkedRating({ ok: true, misses: 0, ms: 900, tier: 'pick' }), 'good');
  assert.equal(checkedRating({ ok: true, misses: 0, ms: 900, tier: 'type' }), 'easy');
  assert.equal(checkedRating({ ok: true, misses: 0, ms: 9000, tier: 'type' }), 'good');
});

test('a missed card goes a few on, or to the end', () => {
  assert.equal(requeueAt(0, 10), 4);
  assert.equal(requeueAt(8, 10), 10);
});
