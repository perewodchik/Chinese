import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { merge } from './merge';
import { readSave } from './migrate';
import { isAway, RECAP_AFTER_MS, recapOf, rememberWords, wordsOfScene } from './recap';
import { applyAll, newSave, WORLD_SAVE_VERSION } from './save';
import type { Quest, Scene } from './types';

const quests: Quest[] = [
  {
    id: 'ch1',
    title: 'A new home',
    chapter: 1,
    kind: 'main',
    steps: [
      { id: 'meet', now: 'Say hello to 王阿姨.', past: 'Met 王阿姨 in the courtyard.' },
      { id: 'breakfast', now: 'Have breakfast at the 早点铺.', past: 'Had breakfast.' },
    ],
  },
];
const q = { now: 1, quests: new Map(quests.map((x) => [x.id, x])) };
const scene: Scene = {
  id: 'breakfast',
  map: 'zaodian',
  npc: 'zaodian-shifu',
  trigger: 'talk',
  start: 'a',
  words: [{ w: '包子', explain: 'x', en: 'bun' }, { w: '豆浆', explain: 'x', en: 'soy milk' }],
  nodes: [
    { id: 'a', say: '要什么？', translate: 'What would you like?', hint: { word: '包子', frame: '我要___。', full: '我要一个包子。' } },
    { id: 'b', say: '好。', translate: 'OK.', hint: { word: '一杯', frame: '___豆浆', full: '一杯豆浆' } },
  ],
};

describe('"last time…" (§13 Q3)', () => {
  it('a talk teaches its situation words and key words; the save keeps the last eight, newest last', () => {
    assert.deepEqual(wordsOfScene(scene), ['包子', '豆浆', '一杯']);
    assert.deepEqual(rememberWords(['a', 'b', '包子'], ['包子', '豆浆']), ['a', 'b', '包子', '豆浆']);
    assert.equal(rememberWords([], '一二三四五六七八九十'.split('')).length, 8);
    const s = applyAll(newSave('d', 0), [{ do: 'heard', words: ['包子', '豆浆'] }, { do: 'heard', words: ['茶'] }], q);
    assert.deepEqual(s.lastWords, ['包子', '豆浆', '茶']);
  });

  it('tells the story so far, what is next and last time’s words, newest first', () => {
    let s = applyAll(newSave('d', 0), [{ do: 'quest', quest: 'ch1', step: 'meet' }, { do: 'quest', quest: 'ch1', step: 'breakfast' }], q);
    s = applyAll(s, [{ do: 'heard', words: ['王阿姨', '包子'] }], q);
    const r = recapOf(s, { quests, scenes: [], npcs: [] })!;
    assert.deepEqual(r.lines, ['Last time: met 王阿姨 in the courtyard.', 'Next: Have breakfast at the 早点铺.', 'And a few words from last time:']);
    assert.deepEqual(r.words, ['包子', '王阿姨']);
  });

  it('shows after twelve real hours away', () => {
    const s = { ...newSave('d', 1000), updatedAt: 1000 };
    assert.ok(!isAway(s, 1000 + RECAP_AFTER_MS - 1));
    assert.ok(isAway(s, 1000 + RECAP_AFTER_MS));
    assert.ok(!isAway({ ...s, updatedAt: 0 }, 1e12));
  });

  it('the save keeps them (v14): upgrade, merge by the later device', () => {
    assert.ok(WORLD_SAVE_VERSION >= 14);
    const old = { ...JSON.parse(JSON.stringify(newSave('d', 0))), version: 13 };
    delete old.lastWords;
    const r = readSave(old);
    assert.deepEqual(r.ok && r.save.lastWords, []);
    const a = { ...applyAll(newSave('a', 0), [{ do: 'heard', words: ['茶'] }], { now: 5 }) };
    const b = { ...applyAll(newSave('b', 0), [{ do: 'heard', words: ['包子'] }], { now: 9 }) };
    assert.deepEqual(merge(a, b).lastWords, ['包子']);
  });
});
