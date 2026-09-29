import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emoteFor, hatFor } from './rabbit';
import { applyAll, newSave } from './save';

const day = (d: number) => (d - 1) * 1440 + 9 * 60;
const ctx = { now: 1 };

describe('兔儿爷 alive (X7)', () => {
  it('dresses for the calendar', () => {
    assert.equal(hatFor(day(1)), 'none');
    assert.equal(hatFor(day(3)), 'armour'); // 中秋
    assert.equal(hatFor(day(5)), 'flower'); // 国庆
    assert.equal(hatFor(day(18)), 'snow'); // January
    assert.equal(hatFor(day(23)), 'flower'); // 春节 is a festival first
  });

  it('cheers at a spirit, sulks at 守株待兔, is glad of a stamp or a new friend', () => {
    const s = newSave('d', 0);
    const run = (actions: Parameters<typeof applyAll>[1]) => emoteFor(s, applyAll(s, actions, ctx));
    assert.equal(run([{ do: 'spirit', spirit: 'shishizi' }, { do: 'stamp', stamp: 'x' }]), 'proud');
    assert.equal(run([{ do: 'idiom', idiom: '守株待兔' }]), 'sulky');
    assert.equal(run([{ do: 'stamp', stamp: 'x' }]), 'happy');
    assert.equal(run([{ do: 'hearts', npc: 'wang-ayi', delta: 3 }]), 'happy');
    assert.equal(run([{ do: 'money', amount: -3 }]), null);
  });
});
