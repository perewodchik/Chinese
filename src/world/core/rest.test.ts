import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayOf } from './clock';
import { contentNames, diaryLines } from './diary';
import { bedScene, canWaitHere, sleepTarget, stepWait } from './rest';
import { applyAll, newSave } from './save';
import type { Quest, Scene } from './types';

const quests: Quest[] = [
  { id: 'side-moon', title: 'Mooncakes', chapter: 1, kind: 'side', blurb: 'b', steps: [{ id: 'make', now: 'Make mooncakes at 中秋.', past: 'p', done: { scene: 'mooncake' } }] },
  { id: 'side-dance', title: 'Dance', chapter: 1, kind: 'side', blurb: 'b', steps: [{ id: 'do', now: 'Dance in the evening.', past: 'p', done: { scene: 'dance' } }] },
];
const talk = (id: string, when: Scene['when']): Scene => ({ id, map: 'siheyuan-yard', npc: 'wang-ayi', trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '好', translate: 'ok' }], ...(when ? { when } : {}) });
const scenes = [talk('mooncake', { festival: 'zhongqiu' }), talk('dance', { hours: [17, 22] })];
const bed: Scene = {
  id: 'bed',
  map: 'siheyuan-room',
  object: 'bed',
  trigger: 'look',
  start: 'a',
  nodes: [{ id: 'a', say: '睡觉吗？', translate: 'Go to sleep?', speaker: 'hero', expect: [{ intent: 'yes', match: [['睡觉', '好']], go: 'b', actions: [{ do: 'sleep' }] }] }, { id: 'b', say: '好', translate: 'ok' }],
};
const q = { now: 1, quests: new Map(quests.map((x) => [x.id, x])) };
const follow = (quest: string) => applyAll(newSave('d', 0), [{ do: 'quest', quest, step: quests.find((x) => x.id === quest)!.steps[0]!.id }, { do: 'track', quest, rev: 1 }], q);

describe('waiting without walking in circles (§13 Q2)', () => {
  it('the bed offers to sleep till the festival the followed step waits for', () => {
    const s = follow('side-moon');
    assert.equal(dayOf(s.clock), 1);
    const t = sleepTarget(s, { quests, scenes });
    assert.deepEqual(t && { day: t.day, zh: t.zh }, { day: 3, zh: '睡到中秋节' });
    const b = bedScene(bed, t);
    assert.equal(b.nodes[0]!.say, '睡觉吗？还是睡到中秋节？');
    assert.deepEqual(b.nodes[0]!.expect![0]!.actions, [{ do: 'sleep', until: 3 }]);
    // plain 睡觉 still works
    assert.equal(b.nodes[0]!.expect![1]!.intent, 'yes');
    // nothing to wait for: the bed as it was
    assert.equal(bedScene(bed, sleepTarget(follow('side-dance'), { quests, scenes })), bed);
    // on the festival itself: nothing to sleep till
    assert.equal(sleepTarget({ ...s, clock: 2 * 1440 + 600 }, { quests, scenes }), null);
  });

  it('sleeping till a day wakes you at 7:00 on it, and the days between are in the diary', () => {
    const s = applyAll(follow('side-moon'), [{ do: 'sleep', until: 5 }], q);
    assert.equal(dayOf(s.clock), 5);
    assert.equal(s.clock % 1440, 7 * 60);
    assert.deepEqual(s.diary['2'], ['q']);
    assert.deepEqual(s.diary['4'], ['q']);
    assert.equal(diaryLines(s.diary['3']!, contentNames([]))[0]!.zh, '这一天我在家休息。');
    // an until already past sleeps as usual
    const again = applyAll(s, [{ do: 'sleep', until: 2 }], q);
    assert.equal(dayOf(again.clock), 6);
  });

  it('a step waiting for an hour says so; you can wait where there is a seat', () => {
    const noon = { ...follow('side-dance'), clock: 12 * 60 };
    assert.deepEqual(stepWait(noon, { quests, scenes }), { from: 17, text: 'after 17:00' });
    assert.equal(stepWait({ ...noon, clock: 18 * 60 }, { quests, scenes }), null);
    assert.ok(canWaitHere('chaguan', [{ kind: 'prop', id: 's', tile: [1, 1], frame: 'stool/wood' }]));
    assert.ok(canWaitHere('tiantan-park', []));
    assert.ok(!canWaitHere('subway-lane', []));
  });
});
