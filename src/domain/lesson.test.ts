import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library, SyllabusWord } from '../data/types';
import type { Collection } from './collection';
import { charId, wordId } from './ids';
import { lessonRating, pickLesson, throttleFor } from './lesson';
import { DAY, grade, type RecallBook } from './memory';

const read = <T,>(path: string): T => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const chars = read<{ items: CharacterEntry[] }>('public/data/characters.json').items;
const words = read<{ items: SyllabusWord[] }>('public/data/words.json').items;
const lib: Library = {
  characters: chars,
  components: {},
  themes: [],
  strokes: {},
  byChar: new Map(chars.map((c) => [c.c, c])),
  words,
  byWord: new Map(words.map((w) => [w.w, w])),
};

const NOW = new Date(2026, 8, 27, 10).getTime();
const learned = (...cs: string[]): RecallBook =>
  Object.fromEntries(cs.map((c) => [charId(c), { recognise: grade(grade(undefined, 'good', NOW - 5 * DAY, 'recognise'), 'good', NOW - 2 * DAY, 'recognise') }]));

const wordsCollection = (ws: string[]): Collection =>
  ({ id: 'w1', name: 'HSK 1 — new words', presetId: 'words-hsk-1', items: ws.map(wordId), createdAt: 1, updatedAt: 1 }) as unknown as Collection;

describe('the day’s lesson', () => {
  it('meets a word’s new characters just before the word', () => {
    const book = learned('火');
    const pick = pickLesson(lib, book, [wordsCollection(['火车', '你好'])], 5, 0, 1);
    assert.deepEqual(pick.ids.slice(0, 2), [charId('车'), wordId('火车')]);
    assert.ok(pick.ids.length <= 5 + 2);
  });

  it('meets a one-character word as its character', () => {
    const pick = pickLesson(lib, {}, [wordsCollection(['的', '火车'])], 5, 0, 1);
    assert.equal(pick.ids[0], charId('的'));
    assert.ok(!pick.ids.includes(wordId('的')));
  });

  it('never picks something that already has a record', () => {
    const book = { ...learned('火'), [wordId('火车')]: { recognise: grade(undefined, 'hard', NOW, 'recognise') } };
    const pick = pickLesson(lib, book, [wordsCollection(['火车'])], 3, 0, 1);
    assert.ok(!pick.ids.includes(wordId('火车')));
    assert.equal(pick.ids.length, 3);
  });

  it('falls back to the band’s characters when no words are waiting', () => {
    const pick = pickLesson(lib, {}, [], 4, 0, 1);
    assert.equal(pick.ids.length, 4);
    for (const id of pick.ids) assert.equal(lib.byChar.get(id.slice(1))!.hsk, 1);
  });

  it('holds new items back when reviews pile up', () => {
    assert.equal(throttleFor(10), 'none');
    assert.equal(throttleFor(80), 'half');
    assert.equal(throttleFor(200), 'stop');
    assert.equal(pickLesson(lib, {}, [], 6, 80, 1).ids.length, 3);
    assert.equal(pickLesson(lib, {}, [], 6, 200, 1).ids.length, 0);
  });

  it('grades from the check, with a clean practice making it good', () => {
    assert.equal(lessonRating({ misses: 0, knew: false, check: 'right' }), 'good');
    assert.equal(lessonRating({ misses: 2, knew: false, check: 'right' }), 'hard');
    assert.equal(lessonRating({ misses: 0, knew: false, check: 'wrong' }), 'again');
    assert.equal(lessonRating({ misses: 0, knew: true, check: null }), 'good');
  });
});
