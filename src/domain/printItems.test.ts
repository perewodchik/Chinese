import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import { charId, wordId } from './ids';
import { itemsNoun, printItems } from './printItems';

const char = (c: string, py: string, def: string): CharacterEntry =>
  ({ c, py: [py], def, words: [], sent: null, parts: [], conf: [] }) as unknown as CharacterEntry;

const chars = [char('朋', 'péng', 'friend'), char('友', 'yǒu', 'friend'), char('男', 'nán', 'male'), char('好', 'hǎo', 'good')];
const words: SyllabusWord[] = [
  { w: '朋友', py: 'péng you', d: 'friend', hsk: 1, cl: ['个'], ex: [{ zh: '我是朋友。', py: 'wǒ shì péng you', en: "I'm a friend." }] },
  { w: '男朋友', py: 'nán péng you', d: 'boyfriend', hsk: 1 },
  { w: '好', py: 'hǎo', d: 'good', hsk: 1 },
];
const lib = {
  characters: chars,
  byChar: new Map(chars.map((c) => [c.c, c])),
  words,
  byWord: new Map(words.map((w) => [w.w, w])),
  components: {},
} as unknown as Library;

describe('printItems', () => {
  it('prints a word whole, with its syllabus reading and sense', () => {
    const [it] = printItems(lib, [wordId('朋友')]);
    assert.equal(it.kind, 'word');
    if (it.kind !== 'word') return;
    assert.equal(it.w.py, 'péngyou');
    assert.equal(it.w.d, 'friend');
    assert.deepEqual(it.w.cl, ['个']);
    assert.deepEqual(it.w.chars.map((c) => c.c), ['朋', '友']);
    assert.deepEqual(it.w.also.map((a) => a.w), ['男朋友']);
  });

  it('gives every item one block, so a word after a word that shares its characters still prints', () => {
    const items = printItems(lib, [wordId('朋友'), wordId('男朋友'), charId('好')]);
    assert.deepEqual(
      items.map((i) => i.kind),
      ['word', 'word', 'char'],
    );
    assert.equal(itemsNoun(items), 'Items');
  });

  it('prints a one-character word as that character, once', () => {
    const items = printItems(lib, [wordId('好'), charId('好')]);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'char');
    assert.equal(itemsNoun(items), 'Characters');
  });
});
