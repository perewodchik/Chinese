/** §13 S1: chapters renumbered (save v16) and deepened chapters that keep a save's place. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { story } from './journal';
import { readSave, renumberChapter } from './migrate';
import { advanceQuests, openMissedChapters, reindexQuests } from './quests';
import { apply, newSave, WORLD_SAVE_VERSION } from './save';
import type { Quest, WorldSave } from './types';

const step = (id: string, done?: Quest['steps'][number]['done']) => ({ id, now: `now ${id}`, past: `did ${id}`, ...(done ? { done } : {}) });

/** chapter 1 as it was, and as a later chapter pass deepens it: two steps before "lion", one after */
const OLD: Quest = { id: 'ch1', title: 'A new home', chapter: 1, kind: 'main', steps: [step('meet'), step('lantern'), step('lion', { flag: 'lion' }), step('ride')] };
const NEW: Quest = { ...OLD, steps: [step('meet'), step('list'), step('lantern'), step('bell'), step('lion', { flag: 'lion' }), step('drum'), step('ride')] };

function midway(): WorldSave {
  const s = newSave('t', 0);
  return { ...s, quests: { ch1: { step: 'lion', index: 2, done: false, at: { meet: 100, lantern: 400, lion: 900 } } } };
}

describe('chapter numbers after §13 S1 (save v16)', () => {
  it('5 香火 and 9 过年 are new: 新北京 5 → 6, 故事 6 → 7, 龙 7 → 8, the epilogue 8 → 10, the end 9 → 11', () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(renumberChapter), [1, 2, 3, 4, 6, 7, 8, 10, 11]);
  });

  it('an older save moves its chapter up; a v16 save keeps its own', () => {
    assert.ok(WORLD_SAVE_VERSION >= 16);
    const old = readSave({ ...newSave('t', 0), version: 15, chapter: 7 });
    assert.ok(old.ok && old.upgraded);
    assert.equal(old.save.chapter, 8);
    const early = readSave({ ...newSave('t', 0), version: 15, chapter: 3 });
    assert.ok(early.ok);
    assert.equal(early.save.chapter, 3);
    const now = readSave({ ...newSave('t', 0), chapter: 5 });
    assert.ok(now.ok);
    assert.equal(now.save.chapter, 5);
  });
});

describe('a deepened chapter keeps a save in the middle of it', () => {
  it('reindexQuests finds the step by id; the steps put before it count as done', () => {
    const s = reindexQuests(midway(), [NEW]);
    assert.deepEqual({ step: s.quests.ch1!.step, index: s.quests.ch1!.index }, { step: 'lion', index: 4 });
    assert.equal(reindexQuests(s, [NEW]), s, 'nothing to do the second time');
  });

  it('the journal tells the new earlier steps as done, dated like skipped steps (by the next step reached)', () => {
    const s = reindexQuests(midway(), [NEW]);
    const ch = story(s, { quests: [NEW], scenes: [], npcs: [], shops: [] } as never)[0]!;
    assert.deepEqual(
      ch.entries.map((e) => [e.step, e.day]),
      [['meet', 1], ['list', 1], ['lantern', 1], ['bell', 1]],
    );
  });

  it('the new steps after it are simply ahead', () => {
    const quests = new Map([[NEW.id, NEW]]);
    const s = advanceQuests(apply(midway(), { do: 'flag', flag: 'lion' }, { now: 1, quests }), [NEW], { now: 1, quests });
    assert.equal(s.quests.ch1!.step, 'drum');
  });

  it('a scene naming an earlier step cannot take a stale save back', () => {
    const quests = new Map([[NEW.id, NEW]]);
    const s = apply(midway(), { do: 'quest', quest: 'ch1', step: 'bell' }, { now: 1, quests });
    assert.equal(s.quests.ch1!.step, 'lion');
  });

  it('a finished quest stays finished on its last step', () => {
    const s = { ...newSave('t', 0), quests: { ch1: { step: 'ride', index: 3, done: true } } };
    const r = reindexQuests(s, [NEW]);
    assert.deepEqual(r.quests.ch1, { step: 'ride', index: 6, done: true });
  });

  it('the old content still reads the save as it was', () => {
    assert.equal(reindexQuests(midway(), [OLD]).quests.ch1!.index, 2);
  });
});

describe('a chapter written after the save went past it', () => {
  const ch4: Quest = { id: 'ch4', title: 'Echo', chapter: 4, kind: 'main', steps: [step('qilin')], reward: [{ do: 'chapter', chapter: 5 }, { do: 'quest', quest: 'ch-xianghuo', step: 'go' }] };
  const xh: Quest = { id: 'ch-xianghuo', title: 'Incense', chapter: 5, kind: 'main', steps: [step('go', { flag: 'incense' })], reward: [{ do: 'chapter', chapter: 6 }, { do: 'quest', quest: 'ch5', step: 'go' }] };
  const ch5: Quest = { id: 'ch5', title: 'New Beijing', chapter: 6, kind: 'main', steps: [step('go'), step('gold', { flag: 'gold' }), step('pixiu')] };
  const quests = [ch4, xh, ch5];
  const ctx = { now: 1, quests: new Map(quests.map((q) => [q.id, q])) };
  const old = (): WorldSave => ({
    ...newSave('t', 0),
    chapter: 6,
    quests: { ch4: { step: 'qilin', index: 0, done: true }, ch5: { step: 'gold', index: 1, done: false } },
  });

  it('opens at its first step, beside the chapter under way', () => {
    const s = openMissedChapters(old(), quests, ctx);
    assert.deepEqual([s.quests['ch-xianghuo']?.step, s.quests.ch5!.step, s.chapter], ['go', 'gold', 6]);
  });

  it('finishing it later takes nothing back', () => {
    const s = advanceQuests(apply(openMissedChapters(old(), quests, ctx), { do: 'flag', flag: 'incense' }, ctx), quests, ctx);
    assert.equal(s.quests['ch-xianghuo']!.done, true);
    assert.deepEqual([s.quests.ch5!.step, s.chapter], ['gold', 6]);
  });

  it('a save that has not reached it yet does not open it', () => {
    const s = { ...newSave('t', 0), chapter: 4, quests: { ch4: { step: 'qilin', index: 0, done: false } } };
    assert.equal(openMissedChapters(s, quests, ctx), s);
  });
});
