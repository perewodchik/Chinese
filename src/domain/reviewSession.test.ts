import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterEntry, Library } from '../data/types';
import { charId, wordId } from './ids';
import { asserted, DAY, grade, type RecallBook } from './memory';
import { interleave, isLeech, leeches, planReview } from './reviewSession';

const entry = (c: string): CharacterEntry =>
  ({ c, i: 0, py: [''], def: '', rad: null, radNum: null, sc: null, ids: null, parts: [], leaves: [], ety: null, trad: null, hsk: 1, freq: 1, layer: 0, words: [], sent: null, conf: [] }) as CharacterEntry;
const chars = ['火', '车', '好', '人', '大', '小', '口', '日'].map(entry);
const lib = { characters: chars, byChar: new Map(chars.map((c) => [c.c, c])), words: [], byWord: new Map(), components: {}, themes: [], strokes: {} } as unknown as Library;

const NOW = new Date(2026, 8, 27, 10).getTime();
/** A record answered well `ago` days back, due `overdue` days ago. */
const held = (ago: number) => grade(grade(undefined, 'good', NOW - (ago + 3) * DAY, 'recognise'), 'good', NOW - ago * DAY, 'recognise');

describe('the daily session', () => {
  it('asks one skill per item, the one closest to being lost', () => {
    const book: RecallBook = {
      [charId('好')]: { recognise: held(10), sound: held(40), write: held(4) },
    };
    const plan = planReview(lib, book, NOW, 10);
    assert.equal(plan.targets.filter((t) => t.id === charId('好')).length, 1);
    assert.equal(plan.targets[0]!.skill, 'sound');
  });

  it('fits the budget and says what was left', () => {
    const book: RecallBook = {};
    for (const c of chars) book[charId(c.c)] = { recognise: held(20) };
    const plan = planReview(lib, book, NOW, 0.5); // thirty seconds
    assert.ok(plan.targets.length >= 1 && plan.targets.length < chars.length);
    assert.equal(plan.left, chars.length - plan.targets.length);
  });

  it('when catching up, puts claims last', () => {
    const book: RecallBook = {};
    for (const c of chars.slice(0, 4)) book[charId(c.c)] = { recognise: asserted(NOW - 30 * DAY, 2) };
    for (const c of chars.slice(4)) book[charId(c.c)] = { recognise: held(30) };
    const plan = planReview(lib, book, NOW, 0.1);
    assert.ok(plan.catchUp);
    assert.ok(!plan.targets[0]!.record!.claim);
  });

  it('brings in a character’s sound once nothing else is due', () => {
    const book: RecallBook = { [charId('好')]: { recognise: grade(held(1), 'good', NOW, 'recognise') } };
    const plan = planReview(lib, book, NOW, 10);
    assert.deepEqual(
      plan.targets.map((t) => [t.id, t.skill]),
      [[charId('好'), 'sound']],
    );
  });

  it('never puts a word straight after its own character', () => {
    const t = (id: string) => ({ id, skill: 'recognise' as const, record: null });
    const out = interleave([t(charId('火')), t(wordId('火车')), t(charId('好')), t(charId('人'))]);
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!.id.slice(1);
      const b = out[i]!.id.slice(1);
      assert.ok(!(a !== b && (a.includes(b) || b.includes(a))), `${a} then ${b}`);
    }
  });

  it('knows a leech', () => {
    let r = grade(undefined, 'good', NOW - 20 * DAY, 'recognise');
    for (let i = 0; i < 4; i++) r = grade(r, 'again', NOW - (15 - i) * DAY, 'recognise');
    assert.ok(isLeech(r));
    assert.deepEqual(leeches({ [charId('好')]: { recognise: r } }).map((l) => l.id), [charId('好')]);
  });
});
