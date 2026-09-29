import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkJournal, conditionMaps, npcHome } from './journal';
import { merge } from './merge';
import { readSave } from './migrate';
import { applyAll, newSave } from './save';
import type { NpcCard, Quest, Scene } from './types';

const scene = (id: string, map: string, npc?: string): Scene => ({ id, map, ...(npc ? { npc } : {}), trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '你好', translate: 'Hi' }] });
const card = (id: string, routine: NpcCard['routine'] = []): NpcCard => ({ id, name: id, role: 'r', look: { sprite: 'x' }, character: '', knows: [], wants: [], actions: [], routine, explains: {} });

describe('the journal: step stamps in the save (J1)', () => {
  const q: Quest = { id: 'q', title: 'Q', chapter: 1, kind: 'main', steps: ['a', 'b', 'c'].map((id) => ({ id, now: id, past: id })) };
  const ctx = { now: 1, quests: new Map([['q', q]]) };

  it('stamps each step reached and the finish, keeps the first stamp, and merges by the earlier minute', () => {
    let a = applyAll(newSave('a', 0), [{ do: 'quest', quest: 'q', step: 'a' }, { do: 'tick', minutes: 600 }, { do: 'quest', quest: 'q', step: 'b' }, { do: 'quest', quest: 'q', step: 'b' }], ctx);
    assert.deepEqual(a.quests.q!.at, { a: 420, b: 600 });
    let b = applyAll(newSave('b', 0), [{ do: 'quest', quest: 'q', step: 'a' }, { do: 'tick', minutes: 500 }, { do: 'quest', quest: 'q', step: 'b' }, { do: 'tick', minutes: 700 }, { do: 'quest_done', quest: 'q' }], ctx);
    assert.deepEqual(b.quests.q!.at, { a: 420, b: 500, $done: 700 });
    const m = merge(a, b);
    assert.deepEqual(m.quests.q, { step: 'c', index: 2, done: true, at: { $done: 700, a: 420, b: 500 } });
    assert.deepEqual(merge(b, a).quests, m.quests);
    // an old save without stamps merges without inventing any
    a = { ...a, quests: { q: { step: 'a', index: 0, done: false } } };
    b = { ...b, quests: { q: { step: 'b', index: 1, done: false } } };
    assert.deepEqual(merge(a, b).quests.q, { step: 'b', index: 1, done: false });
  });

  it('a version 9 save reads as version 10 with its quests as they were', () => {
    const r = readSave({ ...newSave('d', 0), version: 9, quests: { q: { step: 'b', index: 1, done: false } } });
    assert.ok(r.ok);
    assert.equal(r.save.version, 10);
    assert.deepEqual(r.save.quests, { q: { step: 'b', index: 1, done: false } });
  });
});

describe('the journal: places (J1)', () => {
  const content = {
    scenes: [scene('tea', 'chaguan', 'liu'), scene('tea-2', 'chaguan', 'liu'), scene('walk', 'nanluo-main', 'liu')],
    npcs: [card('liu'), card('zhao', [{ hours: [6, 9], map: 'gulou-square', tile: [1, 1] }])],
    shops: [{ id: 'li', npc: 'li', map: 'xiaomaibu', name: '小卖部', stock: [{ item: 'yuer', price: 5 }] }],
  };

  it('a person is where their day starts, else where people talk to them most', () => {
    assert.equal(npcHome('zhao', content), 'gulou-square');
    assert.equal(npcHome('liu', content), 'chaguan');
    assert.equal(npcHome('nobody', content), undefined);
  });

  it('reads places from scenes, stations, people, photos, shops and the cat', () => {
    const maps = conditionMaps(
      { all: [{ scene: 'walk' }, { station: 'wangfujing' }, { met: 'zhao' }, { photo: 'gulou-square:drum-tower' }, { item: 'yuer' }, { cat: 'trusts' }, { flag: 'x' }] },
      content,
    );
    assert.deepEqual(maps.sort(), ['gulou-square', 'hutong-home', 'nanluo-main', 'station-wangfujing', 'xiaomaibu']);
  });

  it('the content check wants a blurb on side quests, a place for main steps and real maps', () => {
    const quests: Quest[] = [
      { id: 'm', title: 'M', chapter: 1, kind: 'main', steps: [{ id: 'a', now: '', past: '', done: { flag: 'x' } }, { id: 'b', now: '', past: '', done: { flag: 'y' }, where: 'chaguan' }, { id: 'c', now: '', past: '', where: 'anywhere' }] },
      { id: 's', title: 'S', chapter: 1, kind: 'side', giver: 'ghost', steps: [{ id: 'a', now: '', past: '', where: 'moon' }] },
    ];
    assert.deepEqual(checkJournal({ ...content, quests }, new Set(['chaguan'])), [
      'quest m/a: a main step needs a place (a scene, station, person … or where)',
      'quest s: a side quest needs a blurb',
      'quest s: unknown giver ghost',
      'quest s/a: where "moon" is not a map',
    ]);
  });
});
