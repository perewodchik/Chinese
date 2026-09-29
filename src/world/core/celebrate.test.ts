import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autoCutscenes, litFigures, rewardLine, sealsFor, spiritReturn, spiritsHome } from './celebrate';
import { checkCutscene, type Cutscene } from './cutscene';
import { cutsceneSchema } from './content';
import { holds } from './flags';
import { gridFromRows } from './grid';
import { applyAll, newSave } from './save';
import type { Quest } from './types';

const quests: Quest[] = [
  {
    id: 'ch1',
    title: 'A new home in the hutong',
    chapter: 1,
    kind: 'main',
    steps: [
      { id: 'meet', now: 'n', past: 'Met 王阿姨 in the courtyard.' },
      { id: 'lion', now: 'n', past: 'Woke the stone lion.' },
    ],
    reward: [{ do: 'give', item: 'tanghulu' }, { do: 'idiom', idiom: '马马虎虎' }, { do: 'hearts', npc: 'wang-ayi', delta: 1 }],
  },
];
const names = { items: [{ id: 'tanghulu', name: '糖葫芦', en: 'candied haws' }], idioms: [{ id: '马马虎虎' }], npcs: [{ id: 'wang-ayi', name: '王阿姨' }] };
const q = { now: 1, quests: new Map(quests.map((x) => [x.id, x])) };

describe('you did it (§13 K2)', () => {
  it('a seal for each step done, and a bigger one with the reward when the quest ends', () => {
    const s0 = applyAll(newSave('d', 0), [{ do: 'quest', quest: 'ch1', step: 'meet' }], q);
    const s1 = applyAll(s0, [{ do: 'quest', quest: 'ch1', step: 'lion' }], q);
    assert.deepEqual(sealsFor(s0, s1, quests, names), [{ kind: 'step', quest: 'ch1', step: 'meet', past: 'Met 王阿姨 in the courtyard.' }]);
    const s2 = applyAll(s1, [{ do: 'quest_done', quest: 'ch1' }], q);
    const seals = sealsFor(s1, s2, quests, names);
    assert.equal(seals.length, 2);
    assert.deepEqual(seals[1], { kind: 'quest', quest: 'ch1', title: 'A new home in the hutong', main: true, reward: ['🎁 糖葫芦', '成语 马马虎虎', '♥ 王阿姨'] });
    assert.deepEqual(sealsFor(s2, s2, quests, names), []);
    // starting a quest is no seal
    assert.deepEqual(sealsFor(newSave('d', 0), s0, quests, names), []);
  });

  it('names rewards simply, and leaves out what is not a gift', () => {
    assert.deepEqual(rewardLine([{ do: 'money', amount: 20 }, { do: 'flag', flag: 'x' }, { do: 'hearts', npc: 'nobody', delta: -1 }], names), ['20 元']);
    assert.deepEqual(rewardLine(undefined, names), []);
  });

  it('a spirit come home flies off from where it stood, and lights its figure on the lantern', () => {
    const s0 = newSave('d', 0);
    const s1 = applyAll(s0, [{ do: 'spirit', spirit: 'shishizi' }], q);
    assert.deepEqual(spiritsHome(s0, s1), ['shishizi']);
    assert.deepEqual(litFigures(s1), ['shishizi']);
    const grid = gridFromRows(['..........', '..........', '..........', '..........']);
    const cs = spiritReturn('shishizi', 'gulou-square', [{ kind: 'spirit', id: 'lion', spirit: 'shishizi', tile: [3, 2] }], [5, 3]);
    assert.ok(cutsceneSchema.safeParse(cs).success);
    assert.deepEqual(cs.cast, [{ actor: 'spirit:shishizi', at: [3, 2] }]);
    assert.deepEqual(checkCutscene(cs, { grid, objects: [], npcs: new Set(), spirits: new Set(['shishizi']) }), []);
    // no spirit object on the map: beside you
    assert.deepEqual(spiritReturn('long', 'm', [], [5, 3]).cast, [{ actor: 'spirit:long', at: [6, 3] }]);
  });

  it('a memory plays at home once its spirit is back, and only once', () => {
    const memory: Cutscene = { id: 'memory-1', map: 'siheyuan-yard', auto: { spirit: 'shishizi' }, steps: [{ wait: 100 }] };
    const other: Cutscene = { id: 'x', map: 'siheyuan-yard', steps: [{ wait: 100 }] };
    const s0 = newSave('d', 0);
    const s1 = applyAll(s0, [{ do: 'spirit', spirit: 'shishizi' }], q);
    const at = (s: typeof s0, map: string) => autoCutscenes(s, [memory, other], map, (c) => holds(c, s)).map((c) => c.id);
    assert.deepEqual(at(s0, 'siheyuan-yard'), []);
    assert.deepEqual(at(s1, 'siheyuan-yard'), ['memory-1']);
    assert.deepEqual(at(s1, 'hutong-home'), []);
    assert.deepEqual(at(applyAll(s1, [{ do: 'watched', id: 'memory-1' }], q), 'siheyuan-yard'), []);
  });
});
