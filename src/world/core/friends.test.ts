import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLexicon } from './dialogue/lexicon';
import { nameFrom, ScriptedDialogue } from './dialogue/scripted';
import { holds } from './flags';
import { readSave } from './migrate';
import { merge } from './merge';
import { applyAll, newSave } from './save';
import type { Scene } from './types';
import { hintWithName, spoken, withName } from './voice';

const read = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = {
  characters: chars,
  themes: [],
  components: {},
  strokes: {},
  byChar: new Map(chars.map((c) => [c.c, c])),
  words,
  byWord: new Map(words.map((w) => [w.w, w])),
};
const lex = libraryLexicon(lib);
const ctx = { now: 1 };

const askName: Scene = {
  id: 'ask',
  map: 'yard',
  npc: 'wang',
  trigger: 'talk',
  start: 'a',
  nodes: [
    {
      id: 'a',
      say: '你叫什么名字？',
      translate: "What's your name?",
      expect: [{ intent: 'name', match: [['叫', '名字', '是']], go: 'b', capture: 'name' }],
      hint: { word: '我叫', frame: '我叫___。', full: '我叫{name}。' },
    },
    { id: 'b', say: '{name}，好名字！', translate: '{name} — a good name!' },
  ],
};

describe('names (X2)', () => {
  it('finds the name after 我叫 / 我是 / 我的名字是', () => {
    assert.equal(nameFrom('我叫大卫。'), '大卫');
    assert.equal(nameFrom('你好，我是 Anna！'), 'Anna');
    assert.equal(nameFrom('我的名字是小白吧'), '小白');
    assert.equal(nameFrom('名字'), null);
    assert.equal(nameFrom('我叫' + '长'.repeat(30))!.length, 12);
  });

  it('puts the name in its slot, drops the slot while unknown, and the voice never says it', () => {
    assert.equal(withName('{name}，你来了！', '大卫'), '大卫，你来了！');
    assert.equal(withName('{name}，你来了！', ''), '你来了！');
    assert.equal(withName('谢谢你，{name}。', 'Anna'), '谢谢你，Anna。');
    assert.equal(withName('谢谢你，{name}。', ''), '谢谢你。');
    assert.equal(spoken('谢谢你，{name}。'), '谢谢你。');
    assert.equal(spoken('{name}，你来了！'), '你来了！');
    assert.equal(spoken('你好！'), '你好！');
    assert.equal(hintWithName({ word: '我叫', frame: '我叫___。', full: '我叫{name}。' }, 'Anna').full, '我叫Anna。');
    assert.equal(hintWithName({ word: '我叫', frame: '我叫___。', full: '我叫{name}。' }, '').full, '我叫大卫。');
  });

  it('a talk keeps the name told and says it from then on', () => {
    const d = new ScriptedDialogue({ scenes: [askName], npcs: [] }, lex);
    let s = newSave('d', 0);
    const t0 = d.start(askName, s);
    s = applyAll(s, t0.actions, ctx);
    const t1 = d.reply(t0.state, { text: '我叫小白。', via: 'keyboard' });
    assert.deepEqual(t1.actions[0], { do: 'name', name: '小白' });
    assert.equal(t1.say?.zh, '小白，好名字！');
    assert.equal(t1.say?.tpl, '{name}，好名字！');
    s = applyAll(s, t1.actions, ctx);
    assert.equal(s.name, '小白');
    // the next talk starts knowing it
    const again = d.start(askName, s);
    assert.equal(again.state.name, '小白');
  });
});

describe('friendship (X2)', () => {
  it('a finished talk warms it by one heart a game day, up to five', () => {
    let s = newSave('d', 0);
    s = applyAll(s, [{ do: 'talked', npc: 'wang' }, { do: 'talked', npc: 'wang' }], ctx);
    assert.equal(s.npcs.wang?.hearts, 1);
    for (let day = 1; day < 8; day++) s = applyAll({ ...s, clock: s.clock + 24 * 60 }, [{ do: 'talked', npc: 'wang' }], ctx);
    assert.equal(s.npcs.wang?.hearts, 5);
  });

  it('conditions on hearts and on what someone remembers', () => {
    let s = applyAll(newSave('d', 0), [{ do: 'hearts', npc: 'wang', delta: 3 }, { do: 'remember', npc: 'wang', note: 'knows your name' }], ctx);
    assert.ok(holds({ hearts: 'wang', min: 3 }, s));
    assert.ok(!holds({ hearts: 'wang', min: 4 }, s));
    assert.ok(holds({ remembers: 'wang', note: 'knows your name' }, s));
    assert.ok(!holds({ remembers: 'li', note: 'knows your name' }, s));
    s = applyAll(s, [{ do: 'hearts', npc: 'wang', delta: -9 }], ctx);
    assert.equal(s.npcs.wang?.hearts, 0);
  });

  it('fresh: someone not talked to yet today (X9, one story a day)', () => {
    let s = newSave('d', 0);
    assert.ok(holds({ fresh: 'teller' }, s));
    s = applyAll(s, [{ do: 'talked', npc: 'teller' }], ctx);
    assert.ok(!holds({ fresh: 'teller' }, s));
    assert.ok(holds({ fresh: 'teller' }, { ...s, clock: s.clock + 24 * 60 }));
  });

  it('a version 2 save gains a name and talk days', () => {
    const v2 = { ...newSave('d', 0), version: 2, name: undefined, npcs: { wang: { met: 3, notes: [], hearts: 2, gift: 1 } } };
    const r = readSave(v2);
    assert.ok(r.ok);
    assert.equal(r.ok && r.save.name, '');
    assert.deepEqual(r.ok && r.save.npcs.wang, { met: 3, notes: [], hearts: 2, gift: 1, talk: 0 });
  });

  it('the merge keeps a name told on either device and the later talk day', () => {
    const a = { ...applyAll(newSave('a', 0), [{ do: 'talked', npc: 'wang' }], { now: 5 }), name: '小白' };
    const b = applyAll(newSave('b', 0), [{ do: 'hearts', npc: 'wang', delta: 2 }], { now: 9 });
    const m = merge(a, b);
    assert.equal(m.name, '小白');
    assert.equal(merge(b, a).name, '小白');
    assert.equal(m.npcs.wang?.hearts, 2);
    assert.equal(m.npcs.wang?.talk, 1);
  });
});
