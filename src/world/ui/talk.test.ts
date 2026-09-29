import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { libraryLexicon } from '../core/dialogue/lexicon';
import { ScriptedDialogue } from '../core/dialogue/scripted';
import { newSave } from '../core/save';
import type { Idiom, Scene } from '../core/types';
import { mergeContent, wordsOf } from './content';
import { readLine } from './pinyin';
import { afterTurn, smallTalk, type TalkView } from './useTalk';

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

const scene: Scene = {
  id: 'ask',
  map: 'm',
  npc: 'auntie',
  trigger: 'talk',
  start: 'hi',
  nodes: [
    {
      id: 'hi',
      say: '你好！你要去哪儿？',
      translate: 'Hello! Where are you going?',
      expect: [{ intent: 'subway', match: [['地铁']], go: 'way' }],
      hint: { word: '地铁', frame: '我去___。', full: '我去地铁站。' },
    },
    { id: 'way', say: '一直走，就到了。', translate: 'Go straight on.', next: 'bye' },
    { id: 'bye', say: '再见！', translate: 'Bye!' },
  ],
};

const open = (s: Scene): { src: ScriptedDialogue; v: TalkView } => {
  const src = new ScriptedDialogue({ scenes: [s], npcs: [] }, lex);
  const t = src.start(s, newSave('d', 0));
  const empty: TalkView = { scene: s, npc: null, sprite: 'auntie', history: [], state: t.state, mode: 'reply', misses: 0 };
  return { src, v: afterTurn(empty, t) };
};

describe('a conversation in the bubble', () => {
  it('asks for an answer, then taps on, then is over', () => {
    const { src, v } = open(scene);
    assert.equal(v.mode, 'reply');
    assert.equal(v.history.length, 1);
    const a = afterTurn(v, src.reply(v.state, { text: '地铁站', via: 'keyboard' }), '地铁站');
    assert.deepEqual(a.history.map((h) => h.who), ['npc', 'you', 'npc']);
    assert.equal(a.mode, 'tap');
    const b = afterTurn(a, src.proceed(a.state));
    assert.equal(b.mode, 'over');
    assert.equal(b.history.at(-1)?.line?.zh, '再见！');
  });

  it('counts misunderstood lines in a row for the companion, and forgets them on a match', () => {
    const { src, v } = open(scene);
    const m1 = afterTurn(v, src.reply(v.state, { text: '苹果', via: 'keyboard' }), '苹果');
    const m2 = afterTurn(m1, src.reply(m1.state, { text: 'hello there', via: 'keyboard' }), 'hello there');
    assert.equal(m2.misses, 2);
    const ok = afterTurn(m2, src.reply(m2.state, { text: '我去地铁站', via: 'keyboard' }), '我去地铁站');
    assert.equal(ok.misses, 0);
  });

  it('small talk with someone who has no card says hello and is over', () => {
    const { v } = open(smallTalk('grandpa', null));
    assert.equal(v.mode, 'over');
    assert.equal(v.history[0]?.line?.zh, '你好！');
  });

  it('a one-line talk is finished by the script when closed, so it counts as done', () => {
    const s = smallTalk('grandpa', null);
    const { src, v } = open(s);
    const t = src.proceed(v.state);
    assert.ok(t.actions.some((a) => a.do === 'scene_done' && a.scene === s.id));
  });
});

describe('lines on screen', () => {
  it('cuts a line into words with readings, punctuation apart', () => {
    const p = readLine('你要去哪儿？', lib);
    assert.deepEqual(
      p.filter((x) => x.word).map((x) => x.text),
      ['你', '要', '去', '哪儿'],
    );
    assert.equal(p.at(-1)?.word, false);
    assert.equal(p.find((x) => x.text === '要')?.py, 'yào');
  });

  it('keeps the game\'s own 成语 whole, with their own reading', () => {
    const own = wordsOf({ idioms: [{ id: '马马虎虎', pinyin: 'mǎmǎhūhū' } as Idiom] });
    const p = readLine('我也马马虎虎！', lib, own);
    assert.deepEqual(p.filter((x) => x.word).map((x) => [x.text, x.py]), [['我', 'wǒ'], ['也', 'yě'], ['马马虎虎', 'mǎmǎhūhū']]);
  });

  it('joins the districts\' content into one', () => {
    const d = (id: string) => ({
      district: { id, name: id, en: id, chapter: 1, maps: [], stations: [], names: [] },
      npcs: [],
      scenes: [{ ...scene, id: `s-${id}` }],
      quests: [],
      spirits: [],
      idioms: [],
      stamps: [],
      items: [],
      pinyin: { [id]: id },
    });
    const c = mergeContent([d('a'), d('b')]);
    assert.deepEqual(c.scenes.map((s) => s.id), ['s-a', 's-b']);
    assert.deepEqual(c.pinyin, { a: 'a', b: 'b' });
  });
});
