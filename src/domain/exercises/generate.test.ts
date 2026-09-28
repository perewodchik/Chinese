import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../../data/types';
import { charId, wordId } from '../ids';
import { candidates, chooseExercise, distractorPool, makeExercise, makeMatch, type ExerciseContext } from './generate';
import { itemInfo, sentenceFor } from './items';
import { makeRng } from './rng';

const read = <T,>(path: string): T => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')) as T;

let cached: Library | null = null;
function lib(): Library {
  if (cached) return cached;
  const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
  const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
  cached = {
    characters: chars,
    components: {},
    themes: [],
    strokes: {},
    byChar: new Map(chars.map((c) => [c.c, c])),
    words,
    byWord: new Map(words.map((w) => [w.w, w])),
  };
  return cached;
}

/** A learner who knows every HSK 1 character. */
function ctx(seed = 'test'): ExerciseContext {
  const l = lib();
  return {
    lib: l,
    known: new Set(l.characters.filter((c) => c.hsk === 1).map((c) => c.c)),
    pool: distractorPool(l, 2),
    native: new Set(['火车', '你好']),
    rng: makeRng(seed),
  };
}

describe('exercises', () => {
  it('describes a word and a character the same way', () => {
    const w = itemInfo(lib(), wordId('火车'))!;
    assert.equal(w.kind, 'word');
    assert.equal(w.gloss, 'train');
    assert.deepEqual(w.chars, ['火', '车']);
    const c = itemInfo(lib(), charId('好'))!;
    assert.equal(c.kind, 'char');
    assert.equal(c.py, 'hǎo');
  });

  it('finds a sentence whose other characters are all known, or none', () => {
    const c = ctx();
    const s = sentenceFor(c.lib, itemInfo(c.lib, wordId('火车'))!, c.known);
    assert.ok(s);
    assert.ok(s.zh.includes('火车'));
    assert.equal(sentenceFor(c.lib, itemInfo(c.lib, wordId('火车'))!, new Set()), null);
  });

  it('puts the right answer among wrong ones that are not also right', () => {
    const c = ctx();
    for (let i = 0; i < 20; i++) {
      const ex = makeExercise({ ...c, rng: makeRng(`m${i}`) }, itemInfo(c.lib, wordId('火车'))!, 'recognise', 'pick-meaning');
      assert.ok(ex && ex.kind === 'pick-meaning');
      assert.equal(ex.options.length, 4);
      assert.equal(ex.options.filter((o) => o.id === '火车').length, 1);
      assert.equal(ex.options.filter((o) => o.face.en === 'train').length, 1);
    }
  });

  it('only makes a listening card when there is a native recording', () => {
    const c = ctx();
    assert.ok(makeExercise(c, itemInfo(c.lib, wordId('火车'))!, 'recognise', 'pick-listen'));
    assert.equal(makeExercise(c, itemInfo(c.lib, wordId('飞机'))!, 'recognise', 'pick-listen'), null);
  });

  it('builds a sentence out of its own words, with two spare tiles', () => {
    const c = ctx();
    const ex = makeExercise(c, itemInfo(c.lib, wordId('火车'))!, 'recognise', 'tiles-sentence');
    assert.ok(ex && ex.kind === 'tiles-sentence');
    assert.ok(ex.answer.join('').includes('火车'));
    assert.equal(ex.tiles.length, ex.answer.length + 2);
    for (const t of ex.answer) assert.ok(ex.tiles.includes(t));
  });

  it('asks a character’s tone, and a word’s tones one syllable at a time', () => {
    const c = ctx();
    const one = makeExercise(c, itemInfo(c.lib, charId('好'))!, 'sound', 'tones');
    assert.ok(one && one.kind === 'tones');
    assert.deepEqual(one.syllables.map((s) => s.tone), [3]);
    const two = makeExercise(c, itemInfo(c.lib, wordId('火车'))!, 'recognise', 'tones');
    assert.ok(two && two.kind === 'tones');
    assert.deepEqual(two.syllables.map((s) => s.tone), [3, 1]);
  });

  it('never offers a word exercise for a skill words do not have', () => {
    const c = ctx();
    assert.deepEqual(candidates(c, itemInfo(c.lib, wordId('火车'))!, 'sound'), []);
    assert.deepEqual(candidates(c, itemInfo(c.lib, wordId('火车'))!, 'write'), []);
  });

  it('chooses by stage: a pick first, tiles next, typing last', () => {
    const c = ctx();
    const item = itemInfo(c.lib, wordId('火车'))!;
    for (let i = 0; i < 10; i++) {
      const r = { ...c, rng: makeRng(`s${i}`) };
      assert.equal(chooseExercise(r, item, 'recognise', { stage: 'easy' }).tier, 'pick');
      assert.equal(chooseExercise(r, item, 'recognise', { stage: 'normal' }).tier, 'build');
      assert.match(chooseExercise(r, item, 'recognise', { stage: 'hard' }).kind, /^type-/);
      assert.match(chooseExercise(r, item, 'recognise', { stage: 'review', stability: 3, hard: true }).kind, /^type-/);
    }
  });

  it('avoids the kinds just shown', () => {
    const c = ctx();
    const item = itemInfo(c.lib, wordId('火车'))!;
    for (let i = 0; i < 10; i++) {
      const ex = chooseExercise({ ...c, rng: makeRng(`r${i}`) }, item, 'recognise', { stage: 'easy', recent: ['pick-meaning', 'pick-hanzi'] });
      assert.ok(ex.kind !== 'pick-meaning' && ex.kind !== 'pick-hanzi', ex.kind);
    }
  });

  it('makes a match board of distinct items', () => {
    const c = ctx();
    const items = ['你好', '火车', '飞机', '学生', '老师'].map((w) => itemInfo(c.lib, wordId(w))!);
    const m = makeMatch(c, items, 'meaning');
    assert.ok(m && m.kind === 'match');
    assert.equal(m.pairs.length, 5);
    assert.equal(new Set(m.pairs.map((p) => p.right.en)).size, 5);
    assert.equal(makeMatch(c, items.slice(0, 2)), null);
  });

  it('keeps a pinyin board to one word length, so syllable counts give nothing away', () => {
    const c = ctx();
    const items = [
      ...['你', '好', '大', '人'].map((x) => itemInfo(c.lib, charId(x))!),
      ...['火车', '学生'].map((w) => itemInfo(c.lib, wordId(w))!),
    ];
    const m = makeMatch(c, items, 'pinyin');
    assert.ok(m && m.kind === 'match' && m.mode === 'pinyin');
    assert.deepEqual(new Set(m.pairs.map((p) => [...p.left.hanzi!].length)), new Set([1]));
    // Meaning is not given away by length, so that board keeps everyone.
    assert.equal(makeMatch(c, items, 'meaning')!.ids.length, 6);
    // Too few of any one length for pinyin: it falls back to meaning.
    const two = makeMatch(c, [items[0]!, items[1]!, items[4]!, items[5]!], 'pinyin');
    assert.ok(two && two.kind === 'match' && two.mode === 'meaning');
  });
});
