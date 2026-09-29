import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCutscene, cutsceneLines, cutsceneScene, cutscenesDue, durationMs, MAX_MS, seenInChapter, type Cutscene } from './cutscene';
import { gridFromRows } from './grid';
import { merge } from './merge';
import { readSave } from './migrate';
import { applyAll, newSave, WORLD_SAVE_VERSION } from './save';
import { cutsceneSchema } from './content';
import type { MapObject, Quest } from './types';

// a yard: walls round the edge, a pillar at 4,2
const grid = gridFromRows(['########', '#......#', '#...#..#', '#......#', '########']);
const objects: MapObject[] = [{ kind: 'npc', id: 'wang', npc: 'wang-ayi', tile: [2, 1] }];
const ctx = { grid, objects, npcs: new Set(['wang-ayi', 'xiaoming']), spirits: new Set(['shishizi']) };

const lantern: Cutscene = {
  id: 'lantern-breaks',
  map: 'siheyuan-yard',
  chapter: 1,
  letterbox: true,
  cast: [{ actor: 'spirit:shishizi', at: [6, 3] }],
  steps: [
    { camera: [3, 2], ms: 800 },
    { together: [{ move: 'hero', to: [3, 3] }, { move: 'wang-ayi', to: [2, 3] }] },
    { say: 'wang-ayi', zh: '灯笼坏了！', en: 'The lantern is broken!' },
    { fx: 'sparkle', at: 'spirit:shishizi', n: 12 },
    { say: 'rabbit', en: 'They ran off into the city…' },
    { spawn: 'xiaoming', at: [1, 1] },
    { move: 'xiaoming', to: [[1, 2], [1, 3]] },
    { despawn: 'spirit:shishizi' },
  ],
  then: [{ do: 'flag', flag: 'lantern-broken' }],
};

describe('cutscenes (§13 K1)', () => {
  it('a good script passes the schema and the map check', () => {
    assert.ok(cutsceneSchema.safeParse(lantern).success);
    assert.deepEqual(checkCutscene(lantern, ctx), []);
  });

  it('finds walls, the edge of the map, strangers and people not there', () => {
    const bad: Cutscene = {
      id: 'bad',
      map: 'siheyuan-yard',
      steps: [
        { move: 'hero', to: [4, 2] },
        { move: 'hero', to: [[9, 9]] },
        { say: 'laowang', zh: '你好', en: 'Hello' },
        { face: 'xiaoming', dir: 'up' },
        { say: 'rabbit', zh: '你好', en: 'Hi' },
        { say: 'wang-ayi', en: 'no Chinese' },
        { camera: [3, 2], zoom: 3 },
      ],
    };
    const e = checkCutscene(bad, ctx);
    assert.ok(e.some((x) => x.includes('4,2 is not walkable')));
    assert.ok(e.some((x) => x.includes('9,9 is off the map')));
    assert.ok(e.some((x) => x.includes('unknown speaker "laowang"')));
    assert.ok(e.some((x) => x.includes('"xiaoming" is not on the map')));
    assert.ok(e.some((x) => x.includes('兔儿爷 speaks English')));
    assert.ok(e.some((x) => x.includes('needs its Chinese')));
  });

  it('a despawned actor cannot act again; a spawned one can', () => {
    const cs: Cutscene = { id: 'x', map: 'm', steps: [{ spawn: 'xiaoming', at: [1, 1] }, { emote: 'xiaoming', kind: 'happy' }, { despawn: 'xiaoming' }, { emote: 'xiaoming', kind: 'sulky' }] };
    const e = checkCutscene(cs, ctx);
    assert.equal(e.length, 1);
    assert.match(e[0]!, /steps\[3\].*not on the map/);
  });

  it('times a script, and holds it to 40 s (a finale to 90)', () => {
    const ms = durationMs(lantern, grid);
    assert.ok(ms > 3000 && ms < MAX_MS, `${ms}`);
    const long: Cutscene = { id: 'long', map: 'm', steps: [{ wait: 10_000 }, { wait: 10_000 }, { wait: 10_000 }, { wait: 10_000 }, { wait: 5_000 }] };
    assert.ok(checkCutscene(long, ctx).some((x) => x.includes('at most 40 s')));
    assert.deepEqual(checkCutscene({ ...long, finale: true }, ctx), []);
  });

  it('gives its Chinese lines as a scene for the word budget; 兔儿爷’s English stays out', () => {
    assert.deepEqual(cutsceneLines(lantern).map((l) => l.actor), ['wang-ayi', 'rabbit']);
    const sc = cutsceneScene(lantern);
    assert.equal(sc.nodes.length, 1);
    assert.equal(sc.nodes[0]!.say, '灯笼坏了！');
    assert.equal(sc.nodes[0]!.speaker, 'wang-ayi');
  });

  it('a step done with onDone starts its cutscene once; one seen does not play again', () => {
    const quests: Quest[] = [
      { id: 'ch1', title: 'x', chapter: 1, kind: 'main', steps: [{ id: 'a', now: 'n', past: 'p', onDone: 'lantern-breaks' }, { id: 'b', now: 'n', past: 'p', onDone: 'ch1-finale' }] },
    ];
    const q = new Map(quests.map((x) => [x.id, x]));
    const s0 = applyAll(newSave('d', 0), [{ do: 'quest', quest: 'ch1', step: 'a' }], { now: 1, quests: q });
    const s1 = applyAll(s0, [{ do: 'quest', quest: 'ch1', step: 'b' }], { now: 2, quests: q });
    assert.deepEqual(cutscenesDue(s0, s1, quests), ['lantern-breaks']);
    const s2 = applyAll(s1, [{ do: 'quest_done', quest: 'ch1' }], { now: 3 });
    assert.deepEqual(cutscenesDue(s0, s2, quests), ['lantern-breaks', 'ch1-finale']);
    const watched = applyAll(s2, [{ do: 'watched', id: 'lantern-breaks' }], { now: 4 });
    assert.deepEqual(cutscenesDue(s0, watched, quests), ['ch1-finale']);
    assert.deepEqual(cutscenesDue(s0, s0, quests), []);
  });

  it('the save keeps what was watched (v13): upgrade, merge, the journal’s replays', () => {
    assert.equal(WORLD_SAVE_VERSION, 13);
    const old = { ...JSON.parse(JSON.stringify(newSave('d', 0))), version: 12 };
    delete old.cutscenes;
    const r = readSave(old);
    assert.ok(r.ok && r.upgraded);
    assert.deepEqual(r.ok && r.save.cutscenes, []);
    assert.equal(readSave({ version: 13 }, undefined, 12).ok, false);
    const a = applyAll(newSave('a', 0), [{ do: 'watched', id: 'x' }, { do: 'watched', id: 'x' }], { now: 5 });
    assert.deepEqual(a.cutscenes, ['x']);
    const b = applyAll(newSave('b', 0), [{ do: 'watched', id: 'lantern-breaks' }], { now: 6 });
    assert.deepEqual(merge(a, b).cutscenes, ['lantern-breaks', 'x']);
    assert.deepEqual(seenInChapter(merge(a, b), [lantern], 1).map((c) => c.id), ['lantern-breaks']);
    assert.deepEqual(seenInChapter(a, [lantern], 1), []);
  });
});
