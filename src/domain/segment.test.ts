import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { segment } from './segment';

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
