import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { mergeContent } from '../ui/content';
import { goalMaps } from './goal';
import { checkJournal, conditionMaps, directions, journal, leads, MAX_LEADS, npcHome, stepTargets, story, trackedQuest } from './journal';
import type { MapLinks } from './places';
import { whatNow } from './quests';
import { merge } from './merge';
import { readSave } from './migrate';
import { applyAll, newSave } from './save';
import type { NpcCard, Quest, Scene, WorldSave } from './types';

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

// --- J2 on the real content -------------------------------------------------

const built = (() => {
  const ids = JSON.parse(readFileSync('public/world/content/index.json', 'utf8')) as string[];
  return mergeContent(ids.map((id) => JSON.parse(readFileSync(`public/world/content/${id}.json`, 'utf8'))));
})();
const index = JSON.parse(readFileSync('public/world/maps/index.json', 'utf8')) as MapLinks;
const at = (map: string, card: number | null = 20): WorldSave => ({ ...newSave('j', 0), place: { map, tile: [3, 3], facing: 'down' }, bag: { items: {}, money: 100, card } });
const ctxQ = { now: 1, quests: new Map(built.quests.map((q) => [q.id, q])) };

describe('the journal: targets and directions (J2)', () => {
  it('every main step has somewhere to go, or says it is anywhere', () => {
    for (const q of built.quests.filter((x) => x.kind === 'main')) {
      for (const st of q.steps) {
        const s = applyAll(newSave('j', 0), [{ do: 'quest', quest: q.id, step: st.id }], ctxQ);
        const t = stepTargets(s, q, built);
        assert.ok(t.length || st.where === 'anywhere', `${q.id}/${st.id} has no target`);
        for (const x of t) assert.ok(index[x.map], `${q.id}/${st.id}: ${x.map} is not a built map`);
      }
    }
  });

  it('chapter 1’s ride: walk to 南锣鼓巷站, line 8 to 王府井, change to line 1, one stop, walk out to the square', () => {
    const d = directions(at('nanluo-main'), 'tiananmen-square', index);
    assert.equal(d.kind, 'ride');
    assert.deepEqual(
      d.legs.map((l) => (l.kind === 'walk' ? `walk ${l.maps.at(0)}→${l.maps.at(-1)}` : l.kind === 'ride' ? `${l.line} ${l.from}→${l.to} ${l.stops.length - 1}` : `change ${l.at} ${l.line}`)),
      ['walk nanluo-main→station-nanluoguxiang', 'l8 nanluoguxiang→wangfujing 3', 'change wangfujing l1', 'l1 wangfujing→tiananmendong 1', 'walk station-tiananmendong→tiananmen-square'],
    );
    const ride = d.legs[1]!;
    assert.ok(ride.kind === 'ride' && /^往.+方向$/.test(ride.direction));
    assert.equal(d.fare, 3);
    assert.ok(d.hasCard && d.enough);
  });

  it('on foot when the doors and lanes lead there; "here" when you are there', () => {
    const d = directions(at('nanluo-main'), 'zaodian', index);
    assert.deepEqual(d, { kind: 'walk', legs: [{ kind: 'walk', maps: ['nanluo-main', 'zaodian'] }], fare: 0, hasCard: true, enough: true });
    assert.equal(directions(at('zaodian'), 'zaodian', index).kind, 'here');
  });

  it('says when there is no card, or not enough on it', () => {
    const none = directions(at('nanluo-main', null), 'tiananmen-square', index);
    assert.equal(none.kind, 'ride');
    assert.deepEqual([none.hasCard, none.enough], [false, false]);
    const low = directions(at('nanluo-main', 1), 'tiananmen-square', index);
    assert.deepEqual([low.hasCard, low.enough], [true, false]);
  });
});

describe('the journal: tracked, story and leads (J2)', () => {
  it('follows the tracked quest while it is under way, else the story', () => {
    let s = applyAll(newSave('j', 0), [{ do: 'quest', quest: 'ch1', step: 'breakfast' }, { do: 'quest', quest: 'side-kite', step: 'pole' }], ctxQ);
    assert.equal(trackedQuest(s, built.quests)?.quest.id, 'ch1');
    s = applyAll(s, [{ do: 'track', quest: 'side-kite', rev: 5 }], ctxQ);
    assert.equal(trackedQuest(s, built.quests)?.quest.id, 'side-kite');
    assert.match(whatNow(s, built.quests), /kite/);
    assert.deepEqual(goalMaps(s, built.quests, built.scenes, built.npcs, built.shops), ['hutong-home']);
    assert.equal(journal(s, built).tracked?.quest.id, 'side-kite');
    assert.deepEqual(journal(s, built).active.map((a) => a.quest.id), ['ch1']);
    // an older choice does not undo a newer one; finished, it falls back to the story
    assert.equal(applyAll(s, [{ do: 'track', quest: '', rev: 4 }], ctxQ).tracked?.quest, 'side-kite');
    s = applyAll(s, [{ do: 'quest_done', quest: 'side-kite' }], ctxQ);
    assert.equal(trackedQuest(s, built.quests)?.quest.id, 'ch1');
  });

  it('merges the tracked quest by the later choice', () => {
    const a = applyAll(newSave('a', 0), [{ do: 'track', quest: 'side-kite', rev: 10 }], ctxQ);
    const b = applyAll(newSave('b', 0), [{ do: 'track', quest: 'side-bird', rev: 20 }], ctxQ);
    assert.deepEqual(merge(a, b).tracked, { quest: 'side-bird', rev: 20 });
    assert.deepEqual(merge(b, a).tracked, { quest: 'side-bird', rev: 20 });
    assert.equal(merge(newSave('a', 0), newSave('b', 0)).tracked, undefined);
  });

  it('tells the story by chapter, side quests under the chapter they were finished in, in day order', () => {
    const day = 24 * 60;
    let s = applyAll(newSave('j', 0), [{ do: 'quest', quest: 'ch1', step: 'meet-wang' }, { do: 'quest', quest: 'side-haircut', step: 'cut' }], ctxQ);
    s = applyAll(s, [{ do: 'tick', minutes: day + 480 }, { do: 'quest', quest: 'ch1', step: 'breakfast' }], ctxQ);
    s = applyAll(s, [{ do: 'tick', minutes: 2 * day + 480 }, { do: 'quest_done', quest: 'ch1' }, { do: 'quest', quest: 'ch2', step: 'go-houhai' }], ctxQ);
    s = applyAll(s, [{ do: 'tick', minutes: 3 * day + 480 }, { do: 'quest_done', quest: 'side-haircut' }], ctxQ);
    const st = story(s, built);
    assert.deepEqual(st.map((c) => [c.chapter, c.done]), [[1, true], [2, false]]);
    assert.deepEqual(st[0]!.entries.slice(0, 2).map((e) => [e.step, e.day]), [['meet-wang', 2], ['breakfast', 3]]);
    // the haircut was finished on day 4, while chapter 2 was the story's
    assert.deepEqual(st[1]!.side.map((x) => [x.quest.id, x.day]), [['side-haircut', 4]]);
    assert.deepEqual(st[0]!.days, [2, 3]);
    // an old save without stamps: steps show as "earlier", side quests go under their own chapter
    const old = { ...s, quests: Object.fromEntries(Object.entries(s.quests).map(([k, q]) => [k, { step: q.step, index: q.index, done: q.done }])) };
    const st2 = story(old, built);
    assert.equal(st2[0]!.entries[0]!.day, undefined);
    assert.deepEqual(st2[0]!.side.map((x) => x.quest.id), ['side-haircut']);
  });

  it('leads: none before meeting anyone, never a started quest, five at most, nearest first', () => {
    const s0 = newSave('j', 0);
    assert.deepEqual(leads(s0, built), []);
    let s = applyAll(s0, [{ do: 'meet', npc: 'zhao-yeye' }], ctxQ);
    const l1 = leads(s, built).map((l) => l.quest.id);
    assert.ok(l1.length > 0 && l1.every((id) => built.quests.find((q) => q.id === id)?.giver === 'zhao-yeye'), l1.join());
    s = applyAll(s, [{ do: 'quest', quest: l1[0]!, step: built.quests.find((q) => q.id === l1[0])!.steps[0]!.id }], ctxQ);
    assert.ok(!leads(s, built).some((l) => l.quest.id === l1[0]));
    // walking the whole city: still five, the ones here first, never a main quest
    const everywhere = { ...s, place: { map: 'nanluo-main', tile: [3, 3] as const, facing: 'down' as const }, visited: Object.keys(index), chapter: 8 };
    const all = leads(everywhere, built);
    assert.equal(all.length, MAX_LEADS);
    assert.ok(all.every((l) => l.quest.kind === 'side' && !everywhere.quests[l.quest.id]));
    assert.equal(all[0]!.hood, 'nanluoguxiang');
    assert.ok(all.every((l) => l.text && !l.text.includes('undefined')));
  });

  it('the golden saves read into a journal without trouble', () => {
    for (let n = 1; n <= 9; n++) {
      const r = readSave(JSON.parse(readFileSync(`content/world/test-saves/chapter-${n}.json`, 'utf8')));
      assert.ok(r.ok);
      const j = journal(r.save, built);
      assert.ok(j.story.length >= Math.min(n, 8) - 1, `chapter ${n}`);
      if (n > 1 && n < 9) assert.ok(j.tracked, `chapter ${n} follows something`);
    }
  });
});
