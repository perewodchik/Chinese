import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayOf } from './clock';
import { diaryLines } from './diary';
import { merge } from './merge';
import { readSave } from './migrate';
import { applyAll, newSave, WORLD_SAVE_VERSION } from './save';

const ctx = { now: 1 };
const names = {
  npc: () => undefined,
  item: (id: string) => (id === 'baozi' ? { zh: '包子', en: 'steamed buns' } : undefined),
  spirit: () => undefined,
};

describe('the ledger, freshness and the money diary (Y7)', () => {
  it('buying brings the thing, remembers the day, and the diary says what it cost', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'money', amount: -6 }, { do: 'buy', item: 'baozi', count: 2, price: 6 }], ctx);
    assert.deepEqual([s.bag.money, s.bag.items.baozi, s.fresh.baozi], [194, 2, dayOf(s.clock)]);
    const day = s.diary[String(dayOf(s.clock))]!;
    assert.deepEqual(diaryLines(day, names).map((l) => l.zh), ['我花了六块钱买包子。']);
  });

  it('earning goes into 余额 and the 账单, and the diary says so', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'earn', amount: 10 }, { do: 'earn', amount: 10 }], ctx);
    assert.equal(s.bag.money, 220);
    assert.deepEqual(s.bills.map((b) => [b.id, b.amount]), [['d:420', 10], ['d:420:2', 10]]);
    assert.deepEqual(diaryLines(s.diary[String(dayOf(s.clock))]!, names).map((l) => l.zh), ['我挣了十块钱，是我自己挣的！']);
    // 三块五 has no 钱 after it
    const half = applyAll(newSave('d', 0), [{ do: 'earn', amount: 3.5 }], ctx);
    assert.deepEqual(diaryLines(half.diary[String(dayOf(half.clock))]!, names).map((l) => l.zh), ['我挣了三块五，是我自己挣的！']);
  });

  it('two phones’ 账单 merge, each payment once, in time order; freshness keeps the later day', () => {
    const base = newSave('a', 0);
    const a = applyAll(base, [{ do: 'money', amount: -3 }, { do: 'buy', item: 'baozi', price: 3 }], { now: 5, deviceId: 'a' });
    const b = applyAll({ ...base, deviceId: 'b', clock: base.clock + 1440 }, [{ do: 'earn', amount: 10 }, { do: 'buy', item: 'baozi', price: 0 }], { now: 9, deviceId: 'b' });
    const m = merge(a, b);
    assert.deepEqual(m.bills.map((x) => x.amount), [-3, 10]);
    assert.equal(merge(m, a).bills.length, 2, 'merging again adds nothing');
    assert.equal(m.fresh.baozi, dayOf(base.clock + 1440));
  });

  it('a version 8 save gains ids on its 账单 and an empty freshness list', () => {
    const v8 = { ...newSave('d', 0), version: 8, bills: [{ at: 5, who: 'x', amount: -3 }], fresh: undefined };
    const r = readSave(v8);
    assert.ok(r.ok);
    assert.deepEqual(r.save.bills, [{ id: 'old:0', at: 5, who: 'x', amount: -3 }]);
    assert.deepEqual(r.save.fresh, {});
    assert.equal(r.save.version, WORLD_SAVE_VERSION);
  });
});
