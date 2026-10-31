import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { ownTextForRead, pinyinOf, sentencesOf } from './ownText';

const entry = (c: string, py: string): CharacterEntry => ({
  c, i: 0, py: [py], def: '', rad: null, radNum: null, sc: null, ids: null, parts: [], leaves: [], ety: null, trad: null,
  hsk: 1, freq: 1, layer: 0, words: [], sent: null, conf: [],
});
const characters = [entry('我', 'wǒ'), entry('饿', 'è'), entry('了', 'le'), entry('吃', 'chī'), entry('饭', 'fàn')];
const words: SyllabusWord[] = [{ w: '吃饭', py: 'chī fàn', d: 'eat', hsk: 1 }, { w: '我', py: 'wǒ', d: 'I', hsk: 1 }];
const lib = {
  characters, themes: [], components: {}, strokes: {},
  byChar: new Map(characters.map((c) => [c.c, c])),
  words, byWord: new Map(words.map((w) => [w.w, w])),
} as unknown as Library;

describe('a text of the learner’s own', () => {
  it('is cut into sentences where Chinese ends them, quotes kept with theirs', () => {
    assert.deepEqual(sentencesOf('他说：“我饿了！”我们吃饭吧。\n\n好\n'), ['他说：“我饿了！”', '我们吃饭吧。', '好']);
  });

  it('gets its pinyin a word at a time', () => {
    assert.match(pinyinOf('我吃饭。', lib), /^wǒ chī fàn。$/);
  });

  it('becomes a Read text with no English and nothing to teach', () => {
    const t = ownTextForRead('饿了', ['我饿了。', '吃饭。'], lib);
    assert.equal(t.lines.length, 2);
    assert.equal(t.lines[0]!.en, '');
    assert.equal(t.lines[0]!.p, true);
    assert.deepEqual(t.teach, []);
  });
});
