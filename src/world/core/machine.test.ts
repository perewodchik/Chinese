import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gateCheck, isMachine, machineScene } from './machine';
import { apply, newSave } from './save';
import type { WorldSave } from './types';

const withBag = (money: number, card: number | null): WorldSave => {
  const s = newSave('test', 0);
  return { ...s, bag: { ...s.bag, money, card } };
};
const buy = (s: WorldSave) => {
  const yes = machineScene(s).nodes[0]!.expect!.find((e) => e.intent === 'yes')!;
  return yes.actions!.reduce((acc, a) => apply(acc, a, { now: 0 }), s);
};

describe('the ticket machine', () => {
  it('is any ticket-machine prop', () => {
    assert.ok(isMachine({ kind: 'prop', frame: 'ticket-machine/blue' }));
    assert.ok(!isMachine({ kind: 'prop', frame: 'street-sign/blue' }));
    assert.ok(!isMachine({ kind: 'sign' }));
  });

  it('sells the card for 40, with 20 on it', () => {
    const s = buy(withBag(60, null));
    assert.equal(s.bag.money, 20);
    assert.equal(s.bag.card, 20);
    assert.ok(s.flags.includes('has-card'));
  });

  it('says so when the money is short', () => {
    assert.equal(machineScene(withBag(30, null)).nodes[0]!.expect, undefined);
  });

  it('tops up by 50 once there is a card', () => {
    const s = buy(withBag(70, 5));
    assert.equal(s.bag.money, 20);
    assert.equal(s.bag.card, 55);
  });

  it('lets you out always, and in with money on the card; else sells a card at the gate', () => {
    assert.equal(gateCheck(withBag(0, null), false), null);
    assert.equal(gateCheck(withBag(0, 12), true), null);
    const sell = gateCheck(withBag(60, null), true)!;
    assert.match(sell.nodes[0]!.say, /你没有交通卡。买交通卡吗/);
    assert.ok(sell.nodes[0]!.expect?.some((e) => e.actions?.some((a) => a.do === 'card')));
    assert.match(gateCheck(withBag(60, 0), true)!.nodes[0]!.say, /卡里没有钱了/);
  });
});
