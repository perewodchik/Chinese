import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { bySense, segment, writerHints, writerWords } from './segment';

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
  entry('能', 1),
  entry('活', 3),
  entry('多', 1),
  entry('少', 1),
  entry('年', 1),
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
  word('能', 1),
  word('多', 1),
  word('少', 1),
  word('年', 1),
  word('多少', 1),
  word('少年', 4),
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

  it('takes the commoner words when two cuts have as many pieces: 多少 | 年, not 多 | 少年', () => {
    assert.deepEqual(cut('能活多少年'), ['能', '活', '多少', '年']);
  });

  it('counts a lone character’s band as well, so it is not taken for the commonest word', () => {
    // 研究 | 生命 (4 + 4) and not 研究生 | 命 (4 + 5): 命 alone is HSK 5.
    const science: Library = {
      ...lib,
      words: [...words, word('研究', 4), word('生命', 4), word('研究生', 4), word('命', 5)],
      byWord: new Map([...words, word('研究', 4), word('生命', 4), word('研究生', 4), word('命', 5)].map((w) => [w.w, w])),
    };
    assert.deepEqual(
      segment('研究生命', science).map((t) => t.text),
      ['研究', '生命'],
    );
  });

  it('puts a sentence back together by sense only when asked (the reader asks, the game does not)', () => {
    const words = (o?: { bySense?: boolean }) => segment('能活多少年', lib, undefined, o).filter((t) => t.word).map((t) => t.text);
    assert.deepEqual(words({ bySense: true }), ['能', '活', '多少', '年']);
    const counted = (o?: { bySense?: boolean }) => segment('一个人', { ...lib, byChar: new Map([...lib.byChar, ['个', entry('个', 1)], ['人', entry('人', 1)]]) }, undefined, o).map((t) => t.text);
    assert.deepEqual(counted({ bySense: true }), ['一个人']);
    assert.deepEqual(counted(), ['一', '个', '人']);
  });

  it('puts back together what is one thing to a reader', () => {
    const glue = (...ws: string[]) => bySense(ws.map((w) => [...w])).map((p) => p.join(''));
    assert.deepEqual(glue('冥王', '们', '来', '了'), ['冥王们', '来', '了']);
    assert.deepEqual(glue('每', '个人', '能', '活'), ['每个人', '能', '活']);
    assert.deepEqual(glue('一', '个', '人'), ['一个人']);
    assert.deepEqual(glue('我', '买', '两', '杯', '咖啡'), ['我', '买', '两杯', '咖啡']);
    assert.deepEqual(glue('这', '本', '书'), ['这本', '书']);
    assert.deepEqual(glue('第三', '次'), ['第三次']);
    assert.deepEqual(glue('吃', '了', '三', '十', '个', '饺子'), ['吃', '了', '三十个', '饺子']);
    assert.deepEqual(glue('贵', '一', '百', '块'), ['贵', '一百块']);
    // what is not counting is left alone
    assert.deepEqual(glue('他', '个人', '的', '事'), ['他', '个人', '的', '事']);
    assert.deepEqual(glue('我们', '走'), ['我们', '走']);
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
