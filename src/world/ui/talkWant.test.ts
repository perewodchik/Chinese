import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DialogueState } from '../core/dialogue/source';
import type { DialogueNode } from '../core/types';
import { wantOf, yuan } from './talkWant';

const state: DialogueState = { scene: 's', node: 'n', misses: 0, hint: 0, ended: false };
const node = (x: Partial<DialogueNode>): DialogueNode => ({ id: 'n', say: '你好', translate: 'Hello', ...x });
const names = (id: string) => ({ youtiao: '油条', doujiang: '豆浆' })[id] ?? id;

describe('what they want', () => {
  it('money reads as money', () => {
    assert.equal(yuan(12), '¥12');
    assert.equal(yuan(2.5), '¥2.50');
  });

  it('a shop: the order so far and the money you came with', () => {
    const s = { ...state, wallet: 20, cart: [{ item: 'youtiao', n: 2 }] };
    assert.equal(wantOf(s, node({ order: { shop: 'x' } }), 99, names), 'You have ¥20 · ordered 油条×2');
    assert.equal(wantOf({ ...state }, node({ order: { shop: 'x' } }), 8, names), 'You have ¥8 · order: what, and how many');
  });

  it('paying comes before everything, by how the shop is paid', () => {
    const due = { total: 5, charged: 5, mode: 'scan' as const, name: '早点铺', cart: [] };
    assert.match(wantOf({ ...state, due }, node({ order: { shop: 'x' } }), 200, names)!, /^You have ¥200 · pay 早点铺 the amount you heard/);
    assert.match(wantOf({ ...state, due: { ...due, mode: 'code' } }, undefined, 200, names)!, /cashier/);
  });

  it('the recycler: what he could buy, then his offer', () => {
    assert.equal(wantOf({ ...state, sellable: [{ item: 'a', name: '旧手机', price: 30 }, { item: 'b', name: '旧书', price: 2 }] }, node({ sell: { share: 0.3 } }), 0, names), 'He buys old things — you have 旧手机、旧书');
    assert.match(wantOf({ ...state }, node({ sell: { share: 0.3 } }), 0, names)!, /nothing in your bag/);
    assert.match(wantOf({ ...state, offer: { item: 'a', name: '旧手机', price: 30 } }, node({ sell: { share: 0.3 } }), 0, names)!, /offers ¥30 for 旧手机/);
  });

  it('a stall: the price on the table', () => {
    assert.match(wantOf({ ...state, haggle: { price: 15, rounds: 1, drops: 0, called: false } }, undefined, 40, names)!, /You have ¥40 · on the table: ¥15/);
  });

  it('a plain line says nothing (the role stays); an ended talk neither', () => {
    assert.equal(wantOf(state, node({}), 0, names), null);
    assert.match(wantOf(state, node({ key: true }), 0, names)!, /key line/);
    assert.equal(wantOf({ ...state, ended: true }, node({ order: { shop: 'x' } }), 0, names), null);
  });
});
