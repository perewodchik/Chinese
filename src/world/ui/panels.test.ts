import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { districtInfo } from '../core/districts';
import { applyAll, newSave } from '../core/save';
import type { Idiom, NpcCard, Quest, Scene, Stamp } from '../core/types';
import { bagRows, friendRows, idiomRows, mapHint, riddleRows, stampRows, taskRows } from './panelRows';

const ctx = { now: 1 };
const fresh = () => newSave('d', 0);

const quests: Quest[] = [
  { id: 'arrive', title: 'A new home', chapter: 1, steps: [{ id: 'meet', now: 'Say hello to 王阿姨.' }, { id: 'eat', now: 'Find breakfast.' }] },
  { id: 'done-one', title: 'Old', chapter: 1, steps: [{ id: 'x', now: 'x' }] },
];
const scene: Scene = {
  id: 'rumour',
  map: 'm',
  npc: 'grandpa',
  trigger: 'talk',
  start: 'k',
  nodes: [{ id: 'k', say: '在城墙的西北角附近。', translate: 'Near the north-west corner of the wall.', key: true }],
};

describe('the panels', () => {
  it('lists quests under way with what now, then the finished ones', () => {
    const s = applyAll(fresh(), [{ do: 'quest', quest: 'arrive', step: 'eat' }, { do: 'quest_done', quest: 'done-one' }], { ...ctx, quests: new Map(quests.map((q) => [q.id, q])) });
    const rows = taskRows(s, quests);
    assert.deepEqual(rows.map((r) => [r.quest.id, r.done, r.now]), [
      ['arrive', false, 'Find breakfast.'],
      ['done-one', true, ''],
    ]);
  });

  it('shows pinned key lines with their text, unsolved first', () => {
    const s = applyAll(fresh(), [{ do: 'pin', riddle: 'rumour/k' }], ctx);
    assert.deepEqual(riddleRows(s, [scene]), [
      { id: 'rumour/k', zh: '在城墙的西北角附近。', en: 'Near the north-west corner of the wall.', solved: false, npc: 'grandpa' },
    ]);
    const solved = applyAll(s, [{ do: 'solve', riddle: 'rumour/k' }], ctx);
    assert.equal(riddleRows(solved, [scene])[0]?.solved, true);
  });

  it('the bag holds only what there is, with names', () => {
    const s = applyAll(fresh(), [{ do: 'give', item: 'baozi', count: 2 }, { do: 'give', item: 'x' }, { do: 'take', item: 'x' }], ctx);
    assert.deepEqual(bagRows(s, [{ id: 'baozi', name: '包子', en: 'steamed bun' }]), [{ id: 'baozi', name: '包子', en: 'steamed bun', count: 2 }]);
  });

  it('the map says the way, and asks for a 交通卡 first', () => {
    const s = { ...fresh(), district: 'gulou' };
    const to = districtInfo('tiananmen')!;
    const noCard = mapHint(s, to);
    assert.equal(noCard.kind, 'no-card');
    assert.match('text' in noCard ? noCard.text : '', /交通卡/);
    const withCard = mapHint({ ...s, bag: { ...s.bag, card: 20 } }, to);
    assert.equal(withCard.kind, 'route');
    assert.match('text' in withCard ? withCard.text : '', /天安门东/);
    assert.equal(mapHint(s, districtInfo('gulou')!).kind, 'here');
  });

  it('the 成语 book: plain ones before stories', () => {
    const idiom = (id: string, tier: Idiom['tier']): Idiom => ({ id, pinyin: '', parts: [{ c: id, gloss: '' }], meaning: '', story: { zh: '好', en: '' }, tier });
    const s = applyAll(fresh(), [{ do: 'idiom', idiom: '狐假虎威' }, { do: 'idiom', idiom: '马马虎虎' }], ctx);
    assert.deepEqual(idiomRows(s, [idiom('狐假虎威', 'story'), idiom('马马虎虎', 'basic')]).map((r) => r.idiom.id), ['马马虎虎', '狐假虎威']);
  });

  it('stamps: landmark seals first, the missing ones as frames', () => {
    const st = (id: string, landmark = false): Stamp => ({ id, name: id, en: id, place: 'p', design: id, ...(landmark ? { landmark } : {}) });
    const s = applyAll(fresh(), [{ do: 'stamp', stamp: 'ticket' }], ctx);
    assert.deepEqual(stampRows(s, [st('ticket'), st('鼓楼', true)]).map((r) => [r.stamp.id, r.got]), [
      ['鼓楼', false],
      ['ticket', true],
    ]);
  });

  it('lists the people met, warmest first, with what they remember (X2)', () => {
    const card = (id: string, name: string): NpcCard => ({ id, name, role: 'r', look: { sprite: 'x' }, character: '', knows: [], wants: [], actions: [], routine: [], explains: {} });
    const s = applyAll(fresh(), [
      { do: 'meet', npc: 'wang' },
      { do: 'meet', npc: 'ghost' },
      { do: 'meet', npc: 'zhao' },
      { do: 'hearts', npc: 'zhao', delta: 2 },
      { do: 'remember', npc: 'zhao', note: 'brought his bird back' },
    ], ctx);
    const rows = friendRows(s, [card('wang', '王阿姨'), card('zhao', '赵爷爷')]);
    assert.deepEqual(rows.map((r) => [r.name, r.hearts, r.notes]), [
      ['赵爷爷', 2, ['brought his bird back']],
      ['王阿姨', 0, []],
    ]);
  });
});
