import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { segment, writerHints, writerWords } from './segment';

const entry = (c: string, hsk: number, words: string[] = []): CharacterEntry => ({
  c,
  i: 0,
  py: [''],
  def: '',
  rad: null,
  radNum: null,
  sc: null,
  ids: null,
  parts: [],
  leaves: [],
  ety: null,
  trad: null,
  hsk,
  freq: 1,
  layer: 0,
  words: words.map((w) => ({ w, p: '', d: '', hsk: null })),
  sent: null,
  conf: [],
});

const word = (w: string, hsk: number): SyllabusWord => ({ w, py: '', d: '', hsk });

// 在家 is only among the characters' words; 家里 and 看书 are on the lists.
const characters = [
  entry('他', 1),
  entry('在', 1, ['在家']),
  entry('家', 1, ['在家']),
  entry('里', 1),
  entry('看', 1),
  entry('书', 1),
  entry('不', 1),
  entry('好', 1),
  entry('意', 2),
  entry('思', 2),
  entry('汤', 4),
];
const words = [
  word('他', 1),
  word('在', 1),
  word('里', 1),
  word('家里', 1),
  word('看书', 1),
  word('不好意思', 2),
  word('好', 1),
  word('意思', 2),
];
const lib: Library = {
  characters,
  themes: [],
  components: {},
  strokes: {},
  byChar: new Map(characters.map((c) => [c.c, c])),
  words,
  byWord: new Map(words.map((w) => [w.w, w])),
};

const cut = (zh: string, extra?: Set<string>) =>
  segment(zh, lib, extra)
    .filter((t) => t.word)
    .map((t) => t.text);

describe('cutting a sentence into words', () => {
  it('backs out of a greedy start when the syllabus reads the span better', () => {
    assert.deepEqual(cut('他在家里看书'), ['他', '在', '家里', '看书']);
  });

  it('keeps a four-character word whole', () => {
    assert.deepEqual(cut('不好意思'), ['不好意思']);
  });

  it('lets the passage’s own vocabulary win', () => {
    assert.deepEqual(cut('他在家', new Set(['在家'])), ['他', '在家']);
  });

  it('keeps punctuation out of the words, and every character where it was', () => {
    const tokens = segment('他在家里。', lib);
    assert.deepEqual(
      tokens.map((t) => [t.text, t.at, t.word]),
      [
        ['他', 0, true],
        ['在', 1, true],
        ['家里', 2, true],
        ['。', 4, false],
      ],
    );
  });

  it('gives a listed word its band, and anything else the band of its hardest character', () => {
    const [a, b] = segment('意思汤', lib).filter((t) => t.word);
    assert.equal(a!.band, 2);
    assert.equal(b!.band, 4);
  });
});

describe('the words the writer grouped in its pinyin', () => {
  const read = (c: string, py: string[], hsk = 1): CharacterEntry => ({ ...entry(c, hsk), py });
  const chars = [
    read('我', ['wǒ']),
    read('的', ['de', 'dì']),
    read('朋', ['péng']),
    read('友', ['yǒu']),
    read('在', ['zài']),
    read('食', ['shí'], 3),
    read('街', ['jiē'], 3),
    read('很', ['hěn']),
    read('多', ['duō']),
    read('深', ['shēn'], 4),
  ];
  const listed = [word('我', 1), word('的', 1), word('在', 1), word('很', 1), word('多', 1), word('朋友', 1), word('深', 4)];
  const withReadings: Library = {
    characters: chars,
    themes: [],
    components: {},
    strokes: {},
    byChar: new Map(chars.map((c) => [c.c, c])),
    words: listed,
    byWord: new Map(listed.map((w) => [w.w, w])),
  };

  it('reads each pinyin word back onto the characters it spells, the neutral tone included', () => {
    assert.deepEqual(writerWords('我的朋友在食街', 'Wǒ de péngyou zài shíjiē.', withReadings), ['朋友', '食街']);
  });

  it('lets a character the library does not have be any one syllable', () => {
    assert.deepEqual(writerWords('深圳很大', 'Shēnzhèn hěn dà', withReadings), ['深圳']);
  });

  it('stops at a word it cannot place, rather than guessing at the rest', () => {
    assert.deepEqual(writerWords('朋友很多朋友', 'péngyou hěnduó búgǎng péngyou', withReadings), ['朋友', '很多']);
  });

  it('keeps what no dictionary has and leaves runs of everyday words alone', () => {
    const hints = writerHints('我的朋友很多，在食街', 'wǒ de péngyou hěnduō, zài shíjiē', withReadings);
    assert.deepEqual(hints, ['朋友', '食街']);
  });
});
