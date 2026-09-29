import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAll, newSave } from './save';
import { combos, verbsOf } from './verbs';

const ctx = { now: 1 };

describe('items that do something (Y4)', () => {
  it('shows the verbs an item’s kind allows, or its own', () => {
    assert.deepEqual(verbsOf({ id: 'baozi', name: '包子', en: '', kind: 'food' }), ['eat', 'give']);
    assert.deepEqual(verbsOf({ id: 'doujiang', name: '豆浆', en: '', kind: 'drink' }), ['drink', 'give']);
    assert.deepEqual(verbsOf({ id: 'huzhao', name: '护照', en: '', kind: 'key' }), ['use', 'look']);
    assert.deepEqual(verbsOf({ id: 'yusan', name: '雨伞', en: '', kind: 'tool', verbs: ['open', 'give'] }), ['open', 'give']);
  });

  it('eating takes one from the bag and the diary says so', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'give', item: 'baozi', count: 2 }, { do: 'eat', item: 'baozi' }], ctx);
    assert.equal(s.bag.items.baozi, 1);
    assert.ok(s.diary['1']?.includes('e:baozi'));
    assert.equal(applyAll(s, [{ do: 'eat', item: 'nothing' }], ctx).bag, s.bag);
  });

  it('two things make a third, only when both are in the bag', () => {
    const hongzhi = { id: 'hongzhi', name: '红纸', en: '', combine: [{ with: 'maobi', makes: 'chunlian' }] };
    let s = applyAll(newSave('d', 0), [{ do: 'give', item: 'hongzhi' }], ctx);
    assert.deepEqual(combos(hongzhi, s.bag.items), []);
    s = applyAll(s, [{ do: 'give', item: 'maobi' }], ctx);
    assert.equal(combos(hongzhi, s.bag.items).length, 1);
    s = applyAll(s, [{ do: 'combine', a: 'hongzhi', b: 'maobi', makes: 'chunlian' }], ctx);
    assert.deepEqual(s.bag.items, { chunlian: 1 });
  });
});
