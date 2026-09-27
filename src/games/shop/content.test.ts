import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { testContext } from '../kit/fixture.test';
import { buildShop, priceZh, ROUNDS } from './content';

describe('the shop', () => {
  it('says prices as they are said', () => {
    assert.equal(priceZh(2), '两块');
    assert.equal(priceZh(15), '十五块');
    assert.equal(priceZh(40), '四十块');
  });

  it('keeps prices to twenty at HSK 1, and only pays', () => {
    const rounds = buildShop(testContext(1, 's'));
    assert.equal(rounds.length, ROUNDS);
    for (const r of rounds) {
      assert.equal(r.kind, 'pay');
      if (r.kind === 'pay') assert.ok(r.price >= 1 && r.price <= 20);
    }
  });

  it('compares two different prices at HSK 2', () => {
    const cheaper = buildShop(testContext(2, 's')).filter((r) => r.kind === 'cheaper');
    assert.ok(cheaper.length >= 1);
    for (const r of cheaper) if (r.kind === 'cheaper') assert.notEqual(r.pa, r.pb);
  });
});
