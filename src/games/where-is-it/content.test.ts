import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { ANCHORS, buildWhere, placesAt, PLACES, ROUNDS, sentence, zonesOf } from './content';

describe('where is it', () => {
  const table = ANCHORS.table;
  const home = ANCHORS.home;

  it('tells on from under, and beside from far away', () => {
    assert.ok(zonesOf({ x: 0.5, y: 0.4 }, table).has('on'));
    assert.ok(zonesOf({ x: 0.5, y: 0.7 }, table).has('under'));
    assert.ok(!zonesOf({ x: 0.5, y: 0.7 }, table).has('on'));
    assert.ok(zonesOf({ x: 0.2, y: 0.6 }, table).has('beside'));
    assert.ok(zonesOf({ x: 0.2, y: 0.6 }, table).has('left'));
    assert.ok(!zonesOf({ x: 0.02, y: 0.6 }, table).has('beside'));
    assert.ok(zonesOf({ x: 0.9, y: 0.6 }, table).has('right'));
  });

  it('tells inside the house from outside it', () => {
    assert.ok(zonesOf({ x: 0.5, y: 0.65 }, home).has('in'));
    assert.ok(zonesOf({ x: 0.1, y: 0.65 }, home).has('out'));
    assert.ok(zonesOf({ x: 0.5, y: 0.1 }, home).has('out'));
  });

  it('uses 上 下 里 外边 at HSK 1 and the 面/边 words at HSK 2', () => {
    assert.deepEqual(placesAt(testContext(1)).map((p) => p.w).sort(), ['上', '下', '外边', '里'].sort());
    assert.ok(placesAt(testContext(2)).some((p) => p.w === '旁边'));
  });

  it('writes the sentence the way it is said', () => {
    const r = buildWhere(testContext(2, 'w'))[0];
    const under = PLACES.find((p) => p.w === '下面')!;
    const right = PLACES.find((p) => p.w === '右边')!;
    assert.equal(sentence({ ...r, anchor: ANCHORS.table, place: under }), `${r.mover.w}在桌子下面。`);
    assert.equal(sentence({ ...r, anchor: ANCHORS.bed, place: right }), `${r.mover.w}在床的右边。`);
  });

  it('has a full game at both bands, with sentences to pick at HSK 2', () => {
    assert.equal(buildWhere(testContext(1)).length, ROUNDS);
    const two = buildWhere(testContext(2, 'p'));
    assert.equal(two.length, ROUNDS);
    assert.ok(two.some((r) => r.kind === 'pick'));
  });
});
