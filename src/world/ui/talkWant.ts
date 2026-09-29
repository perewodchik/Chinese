/**
 * What this person wants from you right now, in one short English line for
 * the dialogue box's nameplate (in place of their role): the order so far
 * and the money you have at a shop, the recycler's offer, the price on the
 * table at a stall, what to do at the phone. Nothing it says is an answer —
 * that stays with 兔儿爷's hint; it only says what the talk is about.
 */

import type { DialogueState } from '../core/dialogue/source';
import type { DialogueNode } from '../core/types';

export const yuan = (n: number) => `¥${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function wantOf(state: DialogueState, node: DialogueNode | undefined, money: number, itemName: (id: string) => string): string | null {
  if (state.ended) return null;
  if (state.due) {
    return state.due.mode === 'scan'
      ? `You have ${yuan(money)} · pay ${state.due.name} the amount you heard`
      : `You have ${yuan(money)} · check what the cashier rang up, then pay`;
  }
  if (state.offer) return `He offers ${yuan(state.offer.price)} for ${state.offer.name} — 好 to sell, 不要 to keep it`;
  if (state.haggle) return `You have ${yuan(money)} · on the table: ${yuan(state.haggle.price)} — bargain, or say 好`;
  if (!node) return null;
  if (node.order) {
    const cart = state.cart ?? [];
    const so = cart.length ? ` · ordered ${cart.map((c) => `${itemName(c.item)}×${c.n}`).join(' ')}` : ' · order: what, and how many';
    return `You have ${yuan(state.wallet ?? money)}${so}`;
  }
  if (node.sell) {
    const can = state.sellable ?? [];
    return can.length ? `He buys old things — you have ${can.map((s) => s.name).join('、')}` : 'He buys old things — there is nothing in your bag he wants';
  }
  if (node.bargain) return `You have ${yuan(money)} · ask the price, then bargain`;
  if (node.choose) return 'Do what they say: pick the one they mean';
  if (node.trace) return 'Write it with your finger, stroke by stroke';
  if (node.key) return 'A key line — it is pinned to your tasks';
  return null;
}
