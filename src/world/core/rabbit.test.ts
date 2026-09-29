import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gridFromRows } from './grid';
import { emoteFor, hatFor, rabbitSpot } from './rabbit';
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

describe('兔儿爷 finds a free tile beside you', () => {
  const g = gridFromRows(['#####', '#...#', '#...#', '#####']);
  it('stays off walls: against the back wall facing up he goes beside you, not into it', () => {
    assert.deepEqual(rabbitSpot(g, [2, 1], 'up', null), [1, 0]);
    assert.deepEqual(rabbitSpot(g, [3, 1], 'up', null), [-1, 0]);
  });
  it('keeps his side while it is free, never the tile ahead', () => {
    assert.deepEqual(rabbitSpot(g, [2, 2], 'right', [-1, 0]), [-1, 0]);
    assert.deepEqual(rabbitSpot(g, [2, 2], 'right', [1, 0]), [0, -1]);
  });
  it('steps round people, and rides on your shoulder when boxed in', () => {
    assert.deepEqual(rabbitSpot(g, [2, 1], 'up', null, new Set(['3,1'])), [-1, 0]);
    assert.deepEqual(rabbitSpot(gridFromRows(['###', '#.#', '###']), [1, 1], 'down', null), [0, 0]);
  });
});
