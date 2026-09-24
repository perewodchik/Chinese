import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library, SyllabusWord } from '../data/types';
import { asserted } from './memory';
import {
  collectedItems,
  firstOpenBand,
  nextMark,
  splitMarks,
  standingOf,
  sweepOf,
  type SweepMark,
} from './sweep';

const word = (w: string, hsk: number): SyllabusWord => ({ w, py: '', d: '', hsk });
const words = [word('我', 1), word('东西', 1), word('不好意思', 2), word('机场', 2)];
const lib = { words, byWord: new Map(words.map((w) => [w.w, w])) } as unknown as Library;
const NOW = 1_700_000_000_000;

describe('the word sweep', () => {
  it('goes round known, not sure, new', () => {
    const seen: SweepMark[] = ['know'];
    for (let i = 0; i < 3; i++) seen.push(nextMark(seen[seen.length - 1]));
    assert.deepEqual(seen, ['know', 'unsure', 'new', 'know']);
  });

  it('knows where a word stands from the memory and the collections alone', () => {
    const recall = {
      'w我': { recognise: asserted(NOW, 9) },
      'w东西': { recognise: { ...asserted(NOW, 1), s: 0.5 } },
    };
    const collected = new Set(['w机场']);
    assert.equal(standingOf('w我', recall, collected), 'known');
    assert.equal(standingOf('w东西', recall, collected), 'reviewing');
    assert.equal(standingOf('w机场', recall, collected), 'to-learn');
    assert.equal(standingOf('w不好意思', recall, collected), 'unsorted');
  });

  it('offers a band only its unsorted words, and moves on once a band is done', () => {
    const recall = { 'w我': { recognise: asserted(NOW, 9) } };
    const collected = collectedItems([{ items: ['w东西'] }] as never);
    const one = sweepOf(lib, 1, recall, collected);
    assert.deepEqual(one.unsorted, []);
    assert.deepEqual(one.counts, { known: 1, reviewing: 0, 'to-learn': 1, unsorted: 0 });
    assert.equal(firstOpenBand(lib, recall, collected), 2);
    assert.deepEqual(
      sweepOf(lib, 2, recall, collected).unsorted.map((w) => w.w),
      ['不好意思', '机场'],
    );
  });

  it('turns a page of marks into word ids by answer', () => {
    const marks = new Map<string, SweepMark>([
      ['我', 'know'],
      ['东西', 'unsure'],
      ['机场', 'new'],
    ]);
    assert.deepEqual(splitMarks(marks), { know: ['w我'], unsure: ['w东西'], new: ['w机场'] });
  });
});
