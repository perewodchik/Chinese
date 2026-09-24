import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Library } from '../../data/types';
import { grade, type RecallBook } from '../memory';
import { weakSpots } from './weakSpots';

const lib = { characters: [], byChar: new Map([['了', {}], ['地', {}]]) } as unknown as Library;
const tally = (...recent: number[]) => ({ tries: recent.length, recent });

describe('weakSpots', () => {
  it('lists what is going wrong, worst first, and leaves out what is fine or too new to judge', () => {
    const r = weakSpots(
      {
        'pair:3-3': tally(0, 0, 1, 0),
        'pair:2-4': tally(1, 0, 1, 1, 0),
        'tone:1': tally(1, 1, 1, 1),
        'hear:jqx': tally(0, 1),
      },
      {},
      lib,
    );
    assert.deepEqual(
      r.weak.map((s) => s.id),
      ['pair:3-3', 'pair:2-4'],
    );
    assert.equal(r.weak[0]!.score, 0.25);
    assert.deepEqual(r.weak[0]!.target, { kind: 'practice', set: 'pair-3-3' });
    assert.ok(r.judged);
    assert.ok(!r.untried.some((s) => s.id === 'hear:jqx' || s.id === 'tone:1'));
    assert.equal(r.untried[0]!.id, 'tone:2');
  });

  it('adds the characters whose readings keep being missed in review', () => {
    let s = grade(undefined, 'good', 0, 'sound');
    s = grade(s, 'again', 1, 'sound');
    s = grade(s, 'again', 2, 'sound');
    const book: RecallBook = { c了: { sound: s }, c地: { sound: grade(undefined, 'good', 0, 'sound') } };
    const r = weakSpots({}, book, lib);
    const chars = r.weak.find((w) => w.id === 'chars');
    assert.deepEqual(chars?.chars, ['了']);
    assert.deepEqual(chars?.target, { kind: 'drill', drill: 'tone' });
    assert.equal(r.judged, false);
  });
});
