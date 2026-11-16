import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { chaptersOf, isPasted, linesOf, looksTraditional, pastedTexts, summarize } from './pastedText';

const entry = (c: string, py: string, def = '', trad: string | null = null): CharacterEntry => ({
  c, i: 0, py: [py], def, rad: null, radNum: null, sc: null, ids: null, parts: [], leaves: [], ety: null, trad,
  hsk: 1, freq: 1, layer: 0, words: [], sent: null, conf: [],
});
const characters = [
  entry('我', 'wǒ', 'I; me'),
  entry('饿', 'è', 'hungry', '餓'),
  entry('了', 'le'),
  entry('吃', 'chī', 'eat'),
  entry('饭', 'fàn', 'rice; meal', '飯'),
  entry('们', 'men', 'plural', '們'),
  entry('说', 'shuō', 'speak', '說'),
];
const words: SyllabusWord[] = [{ w: '吃饭', py: 'chī fàn', d: 'have a meal', hsk: 1 }, { w: '我们', py: 'wǒ men', d: 'we', hsk: 1 }];
const lib = {
  characters, themes: [], components: {}, strokes: {},
  byChar: new Map(characters.map((c) => [c.c, c])),
  words, byWord: new Map(words.map((w) => [w.w, w])),
} as unknown as Library;
const knows = (chars: string) => (c: string) => chars.includes(c);

describe('a pasted text', () => {
  it('is cut into sentences, each new line a new paragraph', () => {
    assert.deepEqual(linesOf('我饿了。我们吃饭！\n\n吃饭了'), [
      { zh: '我饿了。', p: true },
      { zh: '我们吃饭！', p: false },
      { zh: '吃饭了', p: true },
    ]);
  });

  it('becomes one text with pinyin, no English, and its new words glossed from the dictionary', () => {
    const [t, more] = pastedTexts('我饿了。我们吃饭。', '', lib, knows('我了们'));
    assert.equal(more, undefined);
    assert.equal(t!.model, 'paste');
    assert.equal(t!.titleZh, '我饿了');
    assert.match(t!.lines[1]!.py, /^wǒ men chī fàn。$/);
    assert.equal(t!.lines[0]!.en, '');
    assert.deepEqual(t!.teach, ['饿', '吃', '饭']);
    assert.deepEqual(t!.vocab.map((w) => [w.w, w.d]), [['饿', 'hungry'], ['吃饭', 'have a meal']]);
    assert.ok(isPasted({ ...t!, lines: t!.lines }));
  });

  it('keeps the title it is given, English or Chinese', () => {
    assert.equal(pastedTexts('我饿了。', 'Lesson 3', lib, knows(''))[0]!.title, 'Lesson 3');
    assert.equal(pastedTexts('我饿了。', 'Lesson 3', lib, knows(''))[0]!.titleZh, '');
    assert.equal(pastedTexts('我饿了。', '饿', lib, knows(''))[0]!.titleZh, '饿');
  });

  it('past the limit, becomes chapters at its blank lines, a long paragraph split between sentences', () => {
    assert.deepEqual(chaptersOf('我饿了。\n\n我们吃饭。\n\n吃饭了。', 6), ['我饿了。', '我们吃饭。', '吃饭了。']);
    assert.deepEqual(chaptersOf('我饿了。我饿了。我饿了。', 6), ['我饿了。我饿了。', '我饿了。']);
    const parts = pastedTexts('我饿了。\n\n我们吃饭。', 'Day', lib, knows(''));
    assert.equal(parts.length, 1);
  });

  it('says how much of it is known before it is added', () => {
    assert.deepEqual(summarize('我饿了。我们吃饭。', lib, knows('我了们')), { chars: 7, distinct: 6, known: 3, newWords: 2, chapters: 1 });
  });

  it('notices traditional characters', () => {
    assert.equal(looksTraditional('我們吃飯，說餓了。', lib), true);
    assert.equal(looksTraditional('我们吃饭，说饿了。', lib), false);
  });
});
