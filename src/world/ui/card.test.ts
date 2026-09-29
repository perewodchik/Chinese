import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAll, newSave } from '../core/save';
import { cardView, later } from './card';

describe('the /play card', () => {
  it('says Start, with the real clock\'s banner, before a game', () => {
    const v = cardView(null, new Date(2026, 8, 29, 22, 0));
    assert.equal(v.started, false);
    assert.equal(v.time, 'night');
    assert.equal(cardView(newSave('d', 0)).started, false);
  });

  it('says where you stopped and how far you are', () => {
    const s = applyAll(
      { ...newSave('d', 0), district: 'gulou', clock: 18 * 60 + 5 },
      [{ do: 'spirit', spirit: 'shishizi' }, { do: 'idiom', idiom: '马马虎虎' }, { do: 'stamp', stamp: 'a' }, { do: 'stamp', stamp: 'b' }],
      { now: 5 },
    );
    const v = cardView(s);
    assert.equal(v.started, true);
    assert.equal(v.time, 'evening');
    assert.deepEqual([v.spirits, v.idioms, v.stamps], [1, 1, 2]);
    assert.equal(v.where, '鼓楼 · 南锣鼓巷 · 9月6日 18:05');
    assert.deepEqual([v.snow, v.festival], [false, null]);
  });

  it('shows a festival and snow on their days (X4)', () => {
    // day 3 is 中秋, day 23 春节 with snow
    const on = (day: number) => cardView({ ...newSave('d', 0), updatedAt: 5, clock: (day - 1) * 1440 + 9 * 60 });
    assert.equal(on(3).festival, '中秋节');
    assert.deepEqual([on(23).festival, on(23).snow], ['春节', true]);
  });

  it('takes the copy changed last', () => {
    const a = { ...newSave('d', 0), updatedAt: 5 };
    const b = { ...newSave('d', 0), updatedAt: 9 };
    assert.equal(later(a, b), b);
    assert.equal(later(b, a), b);
    assert.equal(later(null, a), a);
    assert.equal(later(a, null), a);
  });
});
