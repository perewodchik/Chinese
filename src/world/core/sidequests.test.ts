import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyAll, newSave } from './save';
import { arrivalNudge, chapterHoods, hoodCounts, markedMaps, markOf, nudgeKey, openBeforeFinale, questMarks, sideQuests, whenText, whoWhere } from './sidequests';
import type { NpcCard, Quest, Scene } from './types';

const card = (id: string, name: string): NpcCard => ({ id, name, role: 'r', look: { sprite: 'kid' }, character: '', knows: [], wants: [], actions: [], routine: [], explains: {} });
const line = (id: string, map: string, npc: string, extra: Partial<Scene> = {}, onEnter: Scene['nodes'][number]['onEnter'] = []): Scene => ({
  id,
  map,
  npc,
  trigger: 'talk',
  start: 'a',
  nodes: [{ id: 'a', say: '你好', translate: 'hi', onEnter }],
  ...extra,
});
const quests: Quest[] = [
  { id: 'ch1', title: 'A new home', chapter: 1, kind: 'main', steps: [{ id: 'breakfast', now: 'Have breakfast.', past: 'p', done: { scene: 'breakfast' } }] },
  { id: 'side-kite', title: '小明’s kite', chapter: 1, kind: 'side', giver: 'xiaoming', blurb: 'b', steps: [{ id: 'pole', now: 'Find a long pole.', past: 'p', done: { flag: 'pole' } }], reward: [{ do: 'hearts', npc: 'xiaoming', delta: 1 }] },
  { id: 'side-bird', title: '赵爷爷’s bird', chapter: 1, kind: 'side', giver: 'zhao-yeye', blurb: 'b', steps: [{ id: 'find', now: 'Look for the bird.', past: 'p', done: { flag: 'bird' } }] },
  { id: 'side-later', title: 'Later', chapter: 3, kind: 'side', blurb: 'b', steps: [{ id: 'x', now: 'x', past: 'p' }] },
];
const scenes: Scene[] = [
  line('breakfast', 'zaodian', 'zaodian-shifu'),
  line('kite', 'nanluo-main', 'xiaoming', { when: { hours: [6, 10] } }, [{ do: 'quest', quest: 'side-kite', step: 'pole' }]),
  line('bird', 'nanluo-main', 'zhao-yeye', {}, [{ do: 'quest', quest: 'side-bird', step: 'find' }]),
  line('pole', 'xiaomaibu', 'li-ayi', {}, [{ do: 'flag', flag: 'pole' }]),
];
const content = {
  quests,
  scenes,
  npcs: [card('xiaoming', '小明'), card('zhao-yeye', '赵爷爷'), card('li-ayi', '李阿姨'), card('zaodian-shifu', '师傅')],
  items: [],
  idioms: [],
};
const q = { now: 1, quests: new Map(quests.map((x) => [x.id, x])) };
const at = (h: number) => ({ ...applyAll(newSave('d', 0), [{ do: 'quest', quest: 'ch1', step: 'breakfast' }, { do: 'enter', map: 'nanluo-main', tile: [3, 9], facing: 'down', district: 'gulou' }], q), clock: 1440 + h * 60 });

describe('side quests you cannot miss (§13 Q1)', () => {
  it('lists every side quest of the chapters reached: who, where, the first thing, what it gives, and when', () => {
    const noon = sideQuests(at(12), content);
    assert.deepEqual(noon.map((e) => [e.quest.id, e.state, e.when]), [
      ['side-bird', 'new', null],
      ['side-kite', 'new', 'mornings 6:00–10:00'],
    ]);
    const kite = noon[1]!;
    assert.equal(kite.first, 'Find a long pole.');
    assert.deepEqual(kite.gives, ['♥ 小明']);
    assert.equal(kite.map, 'nanluo-main');
    assert.match(whoWhere(kite), /^小明 at /);
    // in the morning both can start; the one under way comes first
    const morning = applyAll(at(8), [{ do: 'quest', quest: 'side-bird', step: 'find' }], q);
    assert.deepEqual(sideQuests(morning, content).map((e) => [e.quest.id, e.state, e.when]), [
      ['side-bird', 'on', null],
      ['side-kite', 'new', null],
    ]);
  });

  it('says plainly when a quest can start', () => {
    const s = at(12);
    assert.equal(whenText({ festival: 'zhongqiu' }, s), 'at 中秋节');
    assert.equal(whenText({ all: [{ chapter: 3 }, { hours: [18, 22] }] }, s), 'from chapter 3 · evenings 18:00–22:00');
    assert.equal(whenText({ weather: 'rain' }, s), 'on a rainy day');
    assert.equal(whenText({ hearts: 'xiaoming', min: 2 }, s, content), 'once 小明 is a friend (♥2)');
    assert.equal(whenText({ flag: 'something' }, s), 'later in the story');
  });

  it('marks people: red for the story, gold for a side quest to start now, … for a step under way', () => {
    const s = at(8);
    const objs = [
      { kind: 'npc' as const, id: 'cook', npc: 'zaodian-shifu', tile: [1, 1] as const },
      { kind: 'npc' as const, id: 'kid', npc: 'xiaoming', tile: [2, 1] as const },
      { kind: 'npc' as const, id: 'shop', npc: 'li-ayi', tile: [3, 1] as const },
    ];
    assert.deepEqual(questMarks(s, content, objs), { cook: 'main', kid: 'side' });
    // at noon 小明's kite scene cannot start: no mark
    assert.deepEqual(questMarks(at(12), content, objs), { cook: 'main' });
    const on = applyAll(s, [{ do: 'quest', quest: 'side-kite', step: 'pole' }], q);
    assert.deepEqual(questMarks(on, content, objs), { cook: 'main', shop: 'next' });
    assert.equal(markOf(null, s, quests), null);
  });

  it('counts per neighbourhood and marks maps for the minimap', () => {
    const s = at(8);
    const maps = markedMaps(s, content);
    assert.equal(maps.get('zaodian'), 'main');
    assert.equal(maps.get('nanluo-main'), 'side');
    const counts = hoodCounts(s, content);
    const [hood, n] = [...counts][0]!;
    assert.ok(hood);
    assert.deepEqual(n, { new: 2, on: 0 });
  });

  it('兔儿爷 nudges once per neighbourhood per chapter, and lists what is open before a finale', () => {
    const s = at(12);
    const hood = sideQuests(s, content)[0]!.hood!;
    assert.match(arrivalNudge(s, content, hood) ?? '', /^Someone here could use a hand — 赵爷爷/);
    const told = applyAll(s, [{ do: 'seen', key: nudgeKey(hood, s.chapter), at: 1 }], q);
    assert.equal(arrivalNudge(told, content, hood), null);
    assert.deepEqual(openBeforeFinale(s, content, new Set([hood])).map((e) => e.quest.id), ['side-bird']);
    assert.deepEqual(openBeforeFinale(s, content, new Set()), []);
    assert.ok(chapterHoods(content, 1).has(hood));
  });
});
