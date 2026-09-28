import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLeveler } from './budget';
import { GIFT_LINES, giveTo, NOTHING_HAPPENS } from './gifts';
import { readSave } from './migrate';
import { merge } from './merge';
import { applyAll, newSave } from './save';
import { sceneFor } from './scenes';
import type { Item, NpcCard, Scene } from './types';

const card: NpcCard = { id: 'wang', name: '王阿姨', role: '', look: { sprite: 'auntie' }, character: '', knows: [], wants: [], actions: [], routine: [], explains: {}, likes: ['tanghulu'], dislikes: ['doujiang'] };
const item = (id: string, gift = true): Item => ({ id, name: id, en: id, ...(gift ? { gift } : {}) });
const ctx = { now: 1 };

describe('presents', () => {
  it('a liked present warms friendship, once a day', () => {
    let s = applyAll(newSave('d', 0), [{ do: 'give', item: 'tanghulu', count: 2 }], ctx);
    const r = giveTo(card, item('tanghulu'), s);
    assert.equal(r.kind, 'like');
    s = applyAll(s, r.actions, ctx);
    assert.equal(s.npcs.wang?.hearts, 1);
    assert.equal(s.bag.items.tanghulu, 1);
    assert.equal(giveTo(card, item('tanghulu'), s).kind, 'today');
    s = { ...s, clock: s.clock + 24 * 60 };
    assert.equal(giveTo(card, item('tanghulu'), s).kind, 'like');
  });

  it('disliked and plain presents are taken without hearts; a passport is not a present', () => {
    const s = applyAll(newSave('d', 0), [{ do: 'give', item: 'doujiang' }], ctx);
    const r = giveTo(card, item('doujiang'), s);
    assert.equal(r.kind, 'dislike');
    assert.equal(applyAll(s, r.actions, ctx).npcs.wang?.hearts, 0);
    assert.equal(giveTo(card, item('baozi'), s).kind, 'neutral');
    const no = giveTo(card, item('huzhao', false), s);
    assert.equal(no.kind, 'not-a-gift');
    assert.deepEqual(no.actions, []);
  });

  it('hearts stay between 0 and 5, and merge by the higher', () => {
    let s = newSave('d', 0);
    for (let i = 0; i < 9; i++) s = applyAll(s, [{ do: 'hearts', npc: 'wang', delta: 1 }], ctx);
    assert.equal(s.npcs.wang?.hearts, 5);
    const other = applyAll(newSave('e', 0), [{ do: 'meet', npc: 'wang' }], { now: 2 });
    assert.equal(merge(s, other).npcs.wang?.hearts, 5);
  });

  it('a version 1 save gains hearts and gift days', () => {
    const v1 = { ...newSave('d', 0), version: 1, npcs: { wang: { met: 3, notes: ['hi'] } } };
    const r = readSave(v1);
    assert.ok(r.ok);
    assert.deepEqual(r.ok && r.save.npcs.wang, { met: 3, notes: ['hi'], hearts: 0, gift: 0 });
  });

  it('the lines are HSK 1', () => {
    const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
    const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
    const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
    const lib: Library = { characters: chars, themes: [], components: {}, strokes: {}, byChar: new Map(chars.map((c) => [c.c, c])), words, byWord: new Map(words.map((w) => [w.w, w])) };
    const lv = libraryLeveler(lib);
    for (const l of [...Object.values(GIFT_LINES), NOTHING_HAPPENS]) {
      const hard = lv(l.zh, new Set()).filter((w) => w.level !== 1);
      assert.deepEqual(hard.map((w) => `${w.w}:${w.level}`), [], l.zh);
    }
  });
});

describe('scenes for a used item', () => {
  const scenes: Scene[] = [
    { id: 'talk', map: 'm', npc: 'kid', trigger: 'talk', start: 'a', nodes: [{ id: 'a', say: '你好', translate: '' }] },
    { id: 'kite', map: 'm', npc: 'kid', trigger: 'talk', use: 'fengzheng', start: 'a', nodes: [{ id: 'a', say: '谢谢', translate: '' }] },
  ];
  it('answer only to their item', () => {
    const s = newSave('d', 0);
    assert.equal(sceneFor(scenes, s, { npc: 'kid' })?.id, 'talk');
    assert.equal(sceneFor(scenes, s, { npc: 'kid', use: 'fengzheng' })?.id, 'kite');
    assert.equal(sceneFor(scenes, s, { npc: 'kid', use: 'baozi' }), null);
  });
});
