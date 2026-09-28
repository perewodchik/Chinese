import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { holds } from './flags';
import { activeQuests, advanceQuests, whatNow } from './quests';
import { apply, applyAll, newSave, type ApplyContext } from './save';
import { hoursText, isOpen, npcsOnMap, opensAt, whereIs } from './schedule';
import type { NpcCard, Quest } from './types';

const at = (h: number, m = 0) => h * 60 + m;
const ctx: ApplyContext = { now: 1 };

describe('conditions', () => {
  const s = applyAll(
    { ...newSave('d', 0), clock: at(8) },
    [
      { do: 'flag', flag: 'lantern_broken' },
      { do: 'give', item: 'baozi', count: 2 },
      { do: 'scene_done', scene: 'arrival' },
      { do: 'spirit', spirit: 'lion' },
      { do: 'meet', npc: 'wang' },
      { do: 'station', station: 'nlgx' },
      { do: 'idiom', idiom: '马马虎虎' },
    ],
    ctx,
  );

  it('reads each kind', () => {
    assert.equal(holds(undefined, s), true);
    assert.equal(holds({ flag: 'lantern_broken' }, s), true);
    assert.equal(holds({ flag: 'nope' }, s), false);
    assert.equal(holds({ item: 'baozi', count: 2 }, s), true);
    assert.equal(holds({ item: 'baozi', count: 3 }, s), false);
    assert.equal(holds({ money: s.bag.money }, s), true);
    assert.equal(holds({ money: s.bag.money + 1 }, s), false);
    assert.equal(holds({ hours: [6, 10] }, s), true);
    assert.equal(holds({ hours: [10, 6] }, s), false);
    assert.equal(holds({ chapter: 1 }, s), true);
    assert.equal(holds({ chapter: 2 }, s), false);
    assert.equal(holds({ scene: 'arrival' }, s), true);
    assert.equal(holds({ spirit: 'lion' }, s), true);
    assert.equal(holds({ idiom: '马马虎虎' }, s), true);
    assert.equal(holds({ station: 'nlgx' }, s), true);
    assert.equal(holds({ met: 'wang' }, s), true);
    assert.equal(holds({ met: 'li' }, s), false);
  });

  it('combines all / any / not', () => {
    assert.equal(holds({ all: [{ flag: 'lantern_broken' }, { hours: [6, 10] }] }, s), true);
    assert.equal(holds({ all: [{ flag: 'lantern_broken' }, { hours: [10, 12] }] }, s), false);
    assert.equal(holds({ any: [{ flag: 'x' }, { scene: 'arrival' }] }, s), true);
    assert.equal(holds({ not: { any: [{ flag: 'x' }, { flag: 'y' }] } }, s), true);
    assert.equal(holds({ all: [] }, s), true);
    assert.equal(holds({ any: [] }, s), false);
  });

  it('reads quest states', () => {
    const q: Quest = { id: 'q', title: 'Q', chapter: 1, steps: [{ id: 'a', now: 'A' }, { id: 'b', now: 'B' }] };
    const c = { now: 1, quests: new Map([['q', q]]) };
    let t = apply(s, { do: 'quest', quest: 'q', step: 'b' }, c);
    assert.equal(holds({ quest: 'q' }, t), true);
    assert.equal(holds({ quest: 'q', step: 'b' }, t), true);
    assert.equal(holds({ quest: 'q', step: 'a' }, t), false);
    assert.equal(holds({ quest: 'q', done: false }, t), true);
    assert.equal(holds({ quest: 'q', done: true }, t), false);
    assert.equal(holds({ quest: 'other' }, t), false);
    t = apply(t, { do: 'quest_done', quest: 'q' }, c);
    assert.equal(holds({ quest: 'q', done: true }, t), true);
    assert.equal(holds({ quest: 'q', step: 'b' }, t), false);
  });
});

describe('quests', () => {
  const breakfast: Quest = {
    id: 'breakfast',
    title: 'Breakfast',
    chapter: 1,
    steps: [
      { id: 'go', now: 'Find the 早点铺 in the lane.', done: { scene: 'breakfast-order' } },
      { id: 'eat', now: 'Eat your 包子.', done: { not: { item: 'baozi' } } },
      { id: 'back', now: 'Tell 王阿姨.', done: { flag: 'told_wang' } },
    ],
    reward: [{ do: 'stamp', stamp: 'breakfast' }],
  };
  const lantern: Quest = { id: 'lantern', title: 'The lantern', chapter: 1, steps: [{ id: 'look', now: 'Look at the lantern.' }] };
  const all = [breakfast, lantern];
  const c: ApplyContext = { now: 1, quests: new Map(all.map((q) => [q.id, q])) };

  it('moves on as far as the conditions allow, then rewards', () => {
    let s = apply(newSave('d', 0), { do: 'quest', quest: 'breakfast', step: 'go' }, c);
    assert.equal(advanceQuests(s, all, c), s);
    s = apply(s, { do: 'scene_done', scene: 'breakfast-order' }, c);
    s = advanceQuests(s, all, c);
    assert.equal(s.quests.breakfast.step, 'back', 'no 包子 in the bag, so eating is done too');
    s = advanceQuests(apply(s, { do: 'flag', flag: 'told_wang' }, c), all, c);
    assert.equal(s.quests.breakfast.done, true);
    assert.ok('breakfast' in s.stamps);
  });

  it('says what now — the latest quest under way', () => {
    let s = newSave('d', 0);
    assert.match(whatNow(s, all), /Walk around/);
    s = apply(s, { do: 'quest', quest: 'breakfast', step: 'go' }, c);
    assert.equal(whatNow(s, all), 'Find the 早点铺 in the lane.');
    s = apply(s, { do: 'quest', quest: 'lantern', step: 'look' }, c);
    assert.equal(whatNow(s, all), 'Look at the lantern.');
    assert.equal(activeQuests(s, all).length, 2);
  });
});

describe('schedule', () => {
  it('opens and closes places by the hour', () => {
    assert.equal(isOpen('breakfast', at(6)), true);
    assert.equal(isOpen('breakfast', at(10)), false);
    assert.equal(isOpen('bank', at(16, 59)), true);
    assert.equal(isOpen('bank', at(17)), false);
    assert.equal(isOpen('snack_street', at(1)), true);
    assert.equal(isOpen('shop', at(22)), false);
    assert.equal(isOpen('convenience', at(3)), true);
    assert.equal(opensAt('breakfast', at(12)), 6);
    assert.equal(opensAt('breakfast', at(7)), null);
    assert.equal(hoursText('bank'), '9:00–17:00');
    assert.equal(hoursText('convenience'), '24小时');
  });

  it('finds people by their routine', () => {
    const npc = {
      id: 'owner',
      routine: [
        { hours: [6, 10], map: 'breakfast-shop', tile: [3, 2] },
        { hours: [10, 20], map: 'lane', tile: [8, 4] },
      ],
    } as unknown as NpcCard;
    assert.equal(whereIs(npc, at(7))?.map, 'breakfast-shop');
    assert.equal(whereIs(npc, at(12))?.map, 'lane');
    assert.equal(whereIs(npc, at(22)), null);
    assert.equal(npcsOnMap([npc], 'lane', at(12)).length, 1);
    assert.equal(npcsOnMap([npc], 'lane', at(7)).length, 0);
  });
});
