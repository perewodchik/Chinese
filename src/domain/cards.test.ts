import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library } from '../data/types';
import { planCards, planShelf, waitingCards } from './cards';
import { charId, wordId, type ItemId } from './ids';
import { DAY, grade, type RecallBook } from './memory';
import type { TextSet } from './text';

const entry = (c: string): CharacterEntry =>
  ({ c, i: 0, py: [''], def: '', rad: null, radNum: null, sc: null, ids: null, parts: [], leaves: [], ety: null, trad: null, hsk: 1, freq: 1, layer: 0, words: [], sent: null, conf: [] }) as CharacterEntry;
const all = '火车好人大小口日月山水木天中上下左右'.split('').map(entry);
const lib = { characters: all, byChar: new Map(all.map((c) => [c.c, c])), words: [], byWord: new Map(), components: {}, themes: [], strokes: {} } as unknown as Library;

const NOW = new Date(2026, 9, 20, 10).getTime();
const held = (ago: number) => grade(grade(undefined, 'good', NOW - (ago + 3) * DAY, 'recognise'), 'good', NOW - ago * DAY, 'recognise');
const shelf = (id: string, study: ItemId[], createdAt = 1): TextSet => ({ id, name: id, createdAt, study });

/** Everything long overdue: a learner back after weeks away. */
const backlog = (): RecallBook => {
  const book: RecallBook = {};
  for (const c of all) book[charId(c.c)] = { recognise: held(40) };
  return book;
};

describe('the cards', () => {
  it('asks no more than the day’s size, however much is due', () => {
    const plan = planCards(lib, backlog(), [], NOW, { size: 10, newPerDay: 0 });
    assert.equal(plan.cards.length, 10);
    assert.ok(plan.due > 10);
  });

  it('counts what was answered today against the size', () => {
    const book = backlog();
    for (const c of all.slice(0, 4)) book[charId(c.c)] = { recognise: grade(book[charId(c.c)]!.recognise, 'good', NOW - 60_000, 'recognise') };
    const plan = planCards(lib, book, [], NOW, { size: 10, newPerDay: 0 });
    assert.equal(plan.answeredToday, 4);
    assert.equal(plan.cards.length, 6);
  });

  it('brings in new words from the shelves, a few a day, dealt in among the due ones', () => {
    const sets = [shelf('book', [wordId('火车'), wordId('大人'), wordId('小山'), charId('天')])];
    const plan = planCards(lib, backlog(), sets, NOW, { size: 12, newPerDay: 2 });
    const fresh = plan.cards.filter((c) => c.fresh);
    assert.equal(fresh.length, 2);
    assert.deepEqual(
      fresh.map((c) => c.id),
      [wordId('火车'), wordId('大人')],
    );
    assert.notEqual(plan.cards[0]?.fresh, true, 'a new card is not the very first');
    assert.equal(plan.cards.length, 12);
  });

  it('does not offer as new what has been met already, or what the library does not have', () => {
    const book: RecallBook = { [wordId('火车')]: { recognise: held(1) } };
    const sets = [shelf('a', [wordId('火车'), charId('龘'), charId('火')], 1), shelf('b', [charId('火'), wordId('人口')], 2)];
    assert.deepEqual(waitingCards(sets, book, lib), [charId('火'), wordId('人口')]);
  });

  it('practises one shelf on its own: what is being learned, soonest due first, then what is new', () => {
    const book: RecallBook = { [wordId('火车')]: { recognise: held(2) }, [wordId('大人')]: { recognise: held(30) } };
    const plan = planShelf(lib, book, shelf('s', [wordId('火车'), wordId('大人'), wordId('小山')]), NOW, 10);
    assert.deepEqual(
      plan.cards.map((c) => [c.id, c.fresh]),
      [
        [wordId('大人'), false],
        [wordId('小山'), true],
        [wordId('火车'), false],
      ],
    );
  });
});
