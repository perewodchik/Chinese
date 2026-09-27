import type { SyllabusWord } from '../../data/types';
import { wordId } from '../../domain/ids';
import { plain, plainPy } from '../kit/numbers';
import { pictureWords } from '../kit/pool';
import type { GameContext } from '../types';

/**
 * 多少钱 — at the shop.
 *
 * Two kinds of prompt. Pay: a price tag in Chinese (苹果：十五块) and a tray to
 * put the money in, coin by coin, until it is right. Cheaper (HSK 2, where
 * 便宜 is): two things with their prices — 哪个便宜？ The price is only ever
 * written in characters; the money is only ever numerals, as it is on real
 * notes, so the game is reading the price, not doing the sum.
 */

export const MONEY = [1, 5, 10, 20, 50] as const;

/** Things one buys, from the list: food, drink, a few things for school. */
const GOODS = new Set([
  '苹果', '牛奶', '面包', '鸡蛋', '茶', '咖啡', '饺子', '包子', '水果', '米饭', '面条儿', '菜', '肉', '鱼',
  '书', '本子', '笔', '手表', '衣服', '裤子', '票', '花', '杯子', '奶茶', '绿茶', '红茶', '书包', '药',
]);

export type ShopRound =
  | { kind: 'pay'; thing: SyllabusWord; price: number }
  | { kind: 'cheaper'; a: SyllabusWord; b: SyllabusWord; pa: number; pb: number };

export const ROUNDS = 6;

export const goods = (ctx: GameContext) => pictureWords(ctx, (w) => GOODS.has(w.w));

export function buildShop(ctx: GameContext, n = ROUNDS): ShopRound[] {
  const things = goods(ctx);
  const max = ctx.band === 1 ? 20 : 99;
  const price = () => 1 + ctx.rng.int(max);
  const out: ShopRound[] = [];
  let i = 0;
  while (out.length < n && things.length) {
    const t = things[i++ % things.length];
    // every third prompt at HSK 2 compares two prices
    if (ctx.band === 2 && out.length % 3 === 2) {
      const other = things[i++ % things.length];
      let pa = price();
      let pb = price();
      while (pb === pa) pb = price();
      out.push({ kind: 'cheaper', a: t, b: other, pa, pb });
    } else {
      out.push({ kind: 'pay', thing: t, price: price() });
    }
  }
  return out;
}

/** 十五块 */
export const priceZh = (n: number) => `${n === 2 ? '两' : plain(n)}块`;
export const pricePy = (n: number) => `${n === 2 ? 'liǎng' : plainPy(n)} kuài`;

export const total = (coins: number[]) => coins.reduce((a, b) => a + b, 0);

export const itemsOf = (r: ShopRound) =>
  r.kind === 'pay'
    ? [wordId(r.thing.w), wordId('块')]
    : [wordId(r.a.w), wordId(r.b.w), wordId('便宜'), wordId('块')];
