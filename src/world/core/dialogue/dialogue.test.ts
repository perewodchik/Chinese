import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../../data/types';
import { newSave } from '../save';
import type { Expect, NpcCard, Scene } from '../types';
import { libraryLexicon } from './lexicon';
import { heardNote, matchIntent, normalize } from './match';
import { clean, pinyinSyllables, readingSyllables, splitRun } from './normalize';
import { explanationLine, ScriptedDialogue } from './scripted';
import type { Utterance } from './source';

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

describe('normalising input', () => {
  it('cleans punctuation and full width', () => {
    assert.equal(clean('  请问，地铁站在哪儿？ '), '请问 地铁站在哪儿');
    assert.equal(clean('ｎｉｈａｏ！'), 'nihao');
  });

  it('splits joined pinyin, tone numbers and marks, erhua dropped', () => {
    assert.deepEqual(splitRun('ditie'), ['di', 'tie']);
    assert.deepEqual(splitRun('nar'), ['na']);
    assert.deepEqual(splitRun('er'), ['er']);
    assert.deepEqual(pinyinSyllables('ditie zai nar'), ['di', 'tie', 'zai', 'na']);
    assert.deepEqual(pinyinSyllables('di4tie3 zai4 na3r'), ['di', 'tie', 'zai', 'na']);
    assert.deepEqual(pinyinSyllables('dìtiě zài nǎr?'), ['di', 'tie', 'zai', 'na']);
    assert.deepEqual(pinyinSyllables("xi'an"), ['xi', 'an']);
    assert.deepEqual(pinyinSyllables('nv3 lv4'), ['nv', 'lv']);
    assert.deepEqual(readingSyllables('nǎ r'), ['na']);
  });

  it('knows English is not pinyin', () => {
    assert.equal(pinyinSyllables('where is the subway'), null);
    assert.equal(pinyinSyllables('hello'), null);
    assert.equal(normalize('Where is the subway?', lex).kind, 'other');
    assert.equal(normalize('？', lex).kind, 'empty');
  });
});

describe('matching an intent', () => {
  const expects: Expect[] = [
    { intent: 'ask_subway', match: [['地铁', '地铁站'], ['在哪儿', '在哪里', '怎么走']], go: 'directions' },
    { intent: 'buy', match: [['买', '要'], ['苹果', '香蕉', '西瓜']], go: 'fruit' },
  ];
  const intent = (s: string) => matchIntent(expects, normalize(s, lex), lex)?.expect.intent ?? null;

  it('the brief\'s four ways of asking for the subway', () => {
    assert.equal(intent('请问地铁站怎么走'), 'ask_subway');
    assert.equal(intent('地铁在哪儿'), 'ask_subway');
    assert.equal(intent('ditie zai nar'), 'ask_subway');
    assert.equal(intent('di4tie3 zai4 na3r'), 'ask_subway');
  });

  it('ignores order and extra words', () => {
    assert.equal(intent('你好，请问一下，在哪里坐地铁？'), 'ask_subway');
    assert.equal(intent('我要两个苹果'), 'buy');
    assert.equal(intent('wo yao pingguo'), 'buy');
  });

  it('needs every group', () => {
    assert.equal(intent('地铁'), null);
    assert.equal(intent('我要'), null);
  });

  it('keeps a match by sound, with a note, when the recogniser wrote 卖 for 买', () => {
    const m = matchIntent(expects, normalize('我卖苹果', lex), lex)!;
    assert.equal(m.expect.intent, 'buy');
    assert.equal(m.via, 'sound');
    assert.deepEqual(m.heard, [{ said: '卖', meant: '买' }]);
    assert.equal(heardNote(m.heard[0]!, lex), 'I heard 卖 (mài, sell) — did you mean 买 (mǎi, buy)?');
  });

  it('prefers the intent with more groups matched', () => {
    const ex: Expect[] = [
      { intent: 'one', match: [['地铁']] },
      { intent: 'two', match: [['地铁'], ['在哪儿']] },
    ];
    assert.equal(matchIntent(ex, normalize('地铁在哪儿', lex), lex)?.expect.intent, 'two');
    assert.equal(matchIntent(ex, normalize('地铁', lex), lex)?.expect.intent, 'one');
  });
});

describe('a scripted conversation', () => {
  const uncle: NpcCard = {
    id: 'fruit-uncle',
    name: '卖水果的大叔',
    role: 'fruit seller',
    look: { sprite: 'uncle' },
    character: 'Cheerful.',
    knows: ['where the subway is'],
    wants: ['to sell fruit'],
    actions: ['give', 'money'],
    routine: [],
    explains: { 附近: '就是不远的地方' },
    misses: ['啊？', '你说什么？'],
  };
  const scene: Scene = {
    id: 'ask-way',
    map: 'nanluo-main',
    npc: 'fruit-uncle',
    trigger: 'talk',
    start: 'hello',
    stamp: 'asked-way',
    nodes: [
      {
        id: 'hello',
        say: '你好！买水果吗？',
        simpler: '你要水果吗？',
        translate: 'Hi! Buying fruit?',
        expect: [
          { intent: 'ask_subway', match: [['地铁', '地铁站'], ['在哪儿', '在哪里', '怎么走']], go: 'directions' },
          { intent: 'buy', match: [['买', '要'], ['苹果', '香蕉']], go: 'fruit', actions: [{ do: 'money', amount: -5 }, { do: 'give', item: 'apple' }] },
        ],
        hint: { word: '地铁', frame: '请问，___在哪儿？', full: '请问，地铁站在哪儿？' },
      },
      { id: 'directions', say: '地铁站在附近，往东走。', key: true, translate: 'The station is nearby, walk east.', next: 'bye' },
      { id: 'fruit', say: '五块。给你！', translate: 'Five kuai. Here you go!' },
      { id: 'bye', say: '慢走！', translate: 'Take care!' },
    ],
    words: [{ w: '往东', explain: '去东边', en: 'towards the east' }],
  };
  const talk = new ScriptedDialogue({ scenes: [scene], npcs: [uncle] }, lex);
  const say = (text: string, via: Utterance['via'] = 'keyboard'): Utterance => ({ text, via });
  const save = newSave('d', 0);

  it('starts with the first line and meets the NPC', () => {
    const t = talk.start(scene, save);
    assert.equal(t.say?.zh, '你好！买水果吗？');
    assert.deepEqual(t.actions, [{ do: 'meet', npc: 'fruit-uncle' }]);
    assert.equal(t.state.node, 'hello');
  });

  it('moves along the graph, pins the key line, finishes with the stamp', () => {
    const t0 = talk.start(scene, save);
    const t1 = talk.reply(t0.state, say('请问地铁站怎么走？'));
    assert.equal(t1.kind, 'match');
    assert.equal(t1.intent, 'ask_subway');
    assert.equal(t1.say?.key, true);
    assert.deepEqual(t1.actions, [{ do: 'pin', riddle: 'ask-way/directions' }]);
    assert.equal(t1.end, undefined);
    const t2 = talk.proceed(t1.state);
    assert.equal(t2.say?.zh, '慢走！');
    assert.equal(t2.end, true);
    assert.deepEqual(t2.actions, [{ do: 'scene_done', scene: 'ask-way' }, { do: 'stamp', stamp: 'asked-way' }, { do: 'talked', npc: 'fruit-uncle' }]);
  });

  it('gives the expect\'s actions on the way', () => {
    const t = talk.reply(talk.start(scene, save).state, say('wo yao pingguo'));
    assert.equal(t.intent, 'buy');
    assert.equal(t.end, true);
    assert.deepEqual(t.actions.slice(0, 2), [{ do: 'money', amount: -5 }, { do: 'give', item: 'apple' }]);
  });

  it('answers the universal requests without moving', () => {
    const s = talk.start(scene, save).state;
    const again = talk.reply(s, say('请再说一遍'));
    assert.equal(again.kind, 'repeat');
    assert.equal(again.say?.zh, '你好！买水果吗？');
    const slow = talk.reply(s, say('慢一点'));
    assert.equal(slow.kind, 'slower');
    assert.equal(slow.say?.zh, '你要水果吗？');
    assert.equal(slow.say?.slow, true);
    assert.equal(talk.reply(s, say('我听不懂')).say?.zh, '你要水果吗？');
    assert.equal(talk.reply(s, say('谢谢')).say?.zh, '不客气！');
    const bye = talk.reply(s, say('再见'));
    assert.equal(bye.end, true);
    assert.deepEqual(bye.actions, []);
    assert.equal(again.state, s);
  });

  it('explains a word from the NPC\'s card or the scene\'s situation words', () => {
    const s = talk.start(scene, save).state;
    const t = talk.reply(s, say('附近是什么意思？'));
    assert.equal(t.kind, 'explain');
    assert.equal(t.say?.zh, '“附近”就是不远的地方。');
    assert.equal(talk.reply(s, say('“附近”什么意思')).say?.zh, '“附近”就是不远的地方。');
    assert.equal(talk.reply(s, say('fujin shi shenme yisi')).say?.zh, '“附近”就是不远的地方。');
    assert.equal(talk.reply(s, say('往东是什么意思')).say?.zh, '“往东”就是去东边。');
    const unknown = talk.reply(s, say('熊猫是什么意思'));
    assert.equal(unknown.say?.zh, '这个……我不知道怎么说。');
    assert.deepEqual(unknown.companion, { kind: 'explain', word: '熊猫', py: 'xióngmāo', en: 'panda' });
  });

  it('a greeting in front of a question is still the question', () => {
    const t = talk.reply(talk.start(scene, save).state, say('你好，请问地铁在哪里？'));
    assert.equal(t.intent, 'ask_subway');
  });

  it('English gets 听不懂 and the companion offers the Chinese', () => {
    const t = talk.reply(talk.start(scene, save).state, say('Where is the subway?'));
    assert.equal(t.kind, 'not_chinese');
    assert.deepEqual(t.companion, { kind: 'not_chinese', text: '请问，地铁站在哪儿？' });
  });

  it('misses: the NPC asks again, the companion hints from the second, full sentence by the fourth', () => {
    const s0 = talk.start(scene, save).state;
    const m1 = talk.reply(s0, say('我喜欢猫'));
    assert.equal(m1.kind, 'miss');
    assert.equal(m1.say?.zh, '啊？');
    assert.equal(m1.companion, undefined);
    const m2 = talk.reply(m1.state, say('我喜欢猫'));
    assert.equal(m2.say?.zh, '你说什么？');
    assert.deepEqual(m2.companion, { kind: 'hint', step: 1, text: '地铁' });
    const m3 = talk.reply(m2.state, say('猫'));
    assert.deepEqual(m3.companion, { kind: 'hint', step: 2, text: '请问，___在哪儿？' });
    const m4 = talk.reply(m3.state, say('猫'));
    assert.deepEqual(m4.companion, { kind: 'hint', step: 3, text: '请问，地铁站在哪儿？' });
    const m5 = talk.reply(m4.state, say('猫'));
    assert.equal(m5.state.hint, 3);
    // …and the full hint works.
    assert.equal(talk.reply(m5.state, say('请问，地铁站在哪儿？')).intent, 'ask_subway');
  });

  it('a heard-as note rides along with a sound match', () => {
    const t = talk.reply(talk.start(scene, save).state, say('我卖苹果', 'voice'));
    assert.equal(t.intent, 'buy');
    assert.equal(t.note, 'I heard 卖 (mài, sell) — did you mean 买 (mǎi, buy)?');
  });

  it('builds explanation lines', () => {
    assert.equal(explanationLine('附近', '不远的地方'), '“附近”就是不远的地方。');
    assert.equal(explanationLine('附近', '就是不远的地方。'), '“附近”就是不远的地方。');
  });
});
