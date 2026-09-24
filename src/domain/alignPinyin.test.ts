import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library } from '../data/types';
import { alignPinyin } from './reading';

const entry = (c: string, ...py: string[]): CharacterEntry => ({
  c,
  i: 0,
  py,
  def: '',
  rad: null,
  radNum: null,
  sc: null,
  ids: null,
  parts: [],
  leaves: [],
  ety: null,
  trad: null,
  hsk: 1,
  freq: 1,
  layer: 0,
  words: [],
  sent: null,
  conf: [],
});

const lib = (entries: CharacterEntry[]): Library =>
  ({ characters: entries, byChar: new Map(entries.map((e) => [e.c, e])) }) as unknown as Library;

const L = lib([
  entry('火', 'huǒ'),
  entry('车', 'chē', 'jū'),
  entry('站', 'zhàn'),
  entry('在', 'zài'),
  entry('那', 'nà', 'nèi', 'nǎ'),
  entry('儿', 'ér'),
  entry('坐', 'zuò'),
  entry('下', 'xià'),
  entry('来', 'lái'),
  entry('我', 'wǒ'),
  entry('的', 'de', 'dí', 'dì'),
  entry('座', 'zuò'),
  entry('位', 'wèi'),
  entry('号', 'hào'),
  entry('是', 'shì'),
  entry('三', 'sān'),
  entry('西', 'xī'),
  entry('安', 'ān'),
  entry('女', 'nǚ'),
]);

const align = (zh: string, py: string) => alignPinyin({ zh, py }, L);

describe('alignPinyin with pinyin grouped by word', () => {
  it('cuts each word over its characters', () => {
    assert.deepEqual(align('我的座位号是三号。', 'Wǒ de zuòwèi hào shì sān hào.'), [
      'wǒ', 'de', 'zuò', 'wèi', 'hào', 'shì', 'sān', 'hào',
    ]);
  });

  it('gives an erhua 儿 the r folded into the syllable before it', () => {
    assert.deepEqual(align('火车站在那儿。', 'Huǒchē zhàn zài nàr.'), ['huǒ', 'chē', 'zhàn', 'zài', 'nà', 'r']);
  });

  it('keeps a neutral tone the writer wrote, rather than the dictionary’s', () => {
    assert.deepEqual(align('坐下来', 'zuò xiàlai'), ['zuò', 'xià', 'lai']);
  });

  it('splits at an apostrophe, and reads ü', () => {
    assert.deepEqual(align('西安', "Xī'ān"), ['xī', 'ān']);
    assert.deepEqual(align('女儿', 'nǚ’ér'), ['nǚ', 'ér']);
  });

  it('lets one word it cannot cut cost only its own characters', () => {
    assert.deepEqual(align('火车站在那儿', 'huǒchāi zhàn zài nàr'), ['huǒ', 'chē', 'zhàn', 'zài', 'nà', 'r']);
  });

  it('trusts a single syllable over a single character the library has no such reading for', () => {
    assert.deepEqual(align('我在', 'wǒ zāi'), ['wǒ', 'zāi']);
  });

  it('without a library, uses the writer’s syllables only when there is one per character', () => {
    assert.deepEqual(alignPinyin({ zh: '我在', py: 'wǒ zài' }), ['wǒ', 'zài']);
    assert.deepEqual(alignPinyin({ zh: '火车', py: 'huǒchē' }), ['', '']);
  });
});
