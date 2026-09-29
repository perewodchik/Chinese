import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { merge } from './merge';
import { readSave } from './migrate';
import { apply, newSave } from './save';
import type { WorldSave } from './types';

const played = (): WorldSave => {
  let s = newSave('ipad', 1000);
  for (const a of [
    { do: 'flag', flag: 'has-card' },
    { do: 'stamp', stamp: 'card' },
    { do: 'money', amount: 30 },
    { do: 'settings', patch: { pinyin: false } },
  ] as const)
    s = apply(s, a, { now: 2000 });
  return s;
};

describe('starting over', () => {
  it('begins a new game but keeps the settings', () => {
    const old = played();
    const fresh = apply(old, { do: 'reset', born: 5000 }, { now: 5000 });
    assert.equal(fresh.born, 5000);
    assert.deepEqual(fresh.flags, []);
    assert.deepEqual(fresh.stamps, {});
    assert.equal(fresh.bag.money, newSave('x', 0).bag.money);
    assert.equal(fresh.settings.pinyin, false);
  });

  it('wins over the old game in a merge, whichever device changed last', () => {
    const fresh = apply(played(), { do: 'reset', born: 5000 }, { now: 5000 });
    // the other device kept playing the old game, and saved later
    const other = apply({ ...played(), deviceId: 'mac' }, { do: 'flag', flag: 'late' }, { now: 9000 });
    for (const m of [merge(fresh, other), merge(other, fresh)]) {
      assert.equal(m.born, 5000);
      assert.deepEqual(m.flags, []);
    }
    // two saves of the new game still merge as usual
    const more = apply(fresh, { do: 'flag', flag: 'again' }, { now: 6000 });
    assert.deepEqual(merge(more, fresh).flags, ['again']);
  });

  it('survives a trip through the server', () => {
    const fresh = apply(played(), { do: 'reset', born: 5000 }, { now: 5000 });
    const read = readSave(JSON.parse(JSON.stringify(fresh)));
    assert.ok(read.ok && read.save.born === 5000);
  });
});
