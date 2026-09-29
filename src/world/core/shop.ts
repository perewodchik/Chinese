/**
 * Shops as data (prompt Y1). A shop is a seller and a list of things with
 * prices (`content/world/<district>/shops.json`); talking to the seller
 * opens one generic conversation, generated here like the ticket machine's:
 *
 *   「你好！你要什么？」 — 「两个包子，一杯豆浆。」
 *   「两个包子，一杯豆浆，一共九块。还要什么？」 — 「不要了。」
 *   「一共九块。谢谢！」
 *
 * Quantities with 一/两/二…十 (or digits) and the usual measure words;
 * 「多少钱？」 always works — for one thing, or for what is in the order so
 * far; out-of-season things get 「现在没有……」; not enough money gets a
 * kind 「钱没有了吗？没关系。」, never a shop that silently disappears. The
 * lines are HSK 1 apart from the things' own names (checked by a test).
 */

import { holds } from './flags';
import type { Condition, Item, Scene, WorldSave } from './types';

export interface ShopStock {
  item: string;
  /** yuan: whole, or x.5 (五毛 is the only small unit) */
  price: number;
  /** the measure word said with it: 个 杯 瓶 本 张 串 斤 块 盒 包 把 支 条 … (个 by default) */
  measure?: string;
  /** only sometimes (红包 in winter) */
  when?: Condition;
}

export interface Shop {
  id: string;
  /** the seller */
  npc: string;
  map: string;
  /** e.g. 李阿姨小卖部 */
  name: string;
  /** how you pay (Y2): scan the shop's code, or show yours */
  pay?: 'scan' | 'code';
  /** game hours [from, to) it is open */
  hours?: readonly [number, number];
  when?: Condition;
  stock: ShopStock[];
  /** below story scenes (lower first), above one-liners (5) */
  priority?: number;
}

export interface CartLine {
  item: string;
  n: number;
}

const DIGITS = '零一二三四五六七八九';
export const MEASURES = ['个', '杯', '瓶', '本', '张', '串', '斤', '块', '盒', '包', '把', '支', '条', '份', '碗', '双', '件', '根', '副', '盆', '幅'];

/** 一 … 九十九 from Chinese numerals or digits; null when it is not a number. */
export function readNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  const t = s.replace(/两/g, '二');
  if (!/^[零一二三四五六七八九十]+$/.test(t)) return null;
  const i = t.indexOf('十');
  if (i < 0) return t.length === 1 ? DIGITS.indexOf(t) : null;
  const tens = i === 0 ? 1 : DIGITS.indexOf(t[0]!);
  const ones = t.length > i + 1 ? DIGITS.indexOf(t[i + 1]!) : 0;
  return tens * 10 + ones;
}

/** A count in Chinese: 两 for 2 before a measure word, 十二, 二十. */
export function numZh(n: number, count = true): string {
  if (n === 2 && count) return '两';
  if (n < 10) return DIGITS[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens === 1 ? '' : DIGITS[tens]}十${ones ? DIGITS[ones] : ''}`;
}

/** 3 → 三块, 2 → 两块, 3.5 → 三块五, 0.5 → 五毛, 12 → 十二块. */
export function priceZh(p: number): string {
  const yuan = Math.floor(p);
  const mao = Math.round((p - yuan) * 10);
  if (!yuan) return `${numZh(mao, false)}毛`;
  return `${numZh(yuan)}块${mao ? numZh(mao, false) : ''}`;
}

export const priceEn = (p: number) => `${p % 1 ? p.toFixed(1) : p} 元`;

/** 两个包子 / 一杯豆浆: each thing of the stock named in the text, with the number before it (1 when none). */
export function parseOrder(text: string, stock: readonly { item: string; name: string }[]): CartLine[] {
  const out: CartLine[] = [];
  // longer names first, so 糖葫芦 is not read as 葫芦
  const names = [...stock].sort((a, b) => b.name.length - a.name.length);
  let rest = text;
  for (const s of names) {
    const re = new RegExp(`((?:\\d+|[零一二两三四五六七八九十]+))?\\s*(${MEASURES.join('|')})?\\s*${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      const n = m[1] ? (readNumber(m[1]) ?? 1) : 1;
      const cur = out.find((c) => c.item === s.item);
      if (cur) cur.n += n;
      else out.push({ item: s.item, n });
    }
    rest = rest.replace(re, ' ');
  }
  return out.filter((c) => c.n > 0).map((c) => ({ ...c, n: Math.min(c.n, 20) }));
}

/** The lines a seller says (the word budget apart from the names; checked by a test). */
export const SHOP_LINES = {
  hello: { zh: '你好！你要什么？', en: 'Hello! What would you like?' },
  more: { zh: '还要什么？', en: 'Anything else?' },
  bye: { zh: '好，再见！', en: 'All right — bye!' },
  thanks: { zh: '谢谢！', en: 'Thank you!' },
  short: { zh: '钱没有了吗？没关系。', en: 'Out of money? That’s all right.' },
  none: { zh: '对不起，这个我们没有。', en: 'Sorry, we don’t have that.' },
  soon: { zh: '现在没有。', en: 'Not at the moment.' },
};

/** Words that end an order. */
export const DONE_WORDS = ['不要了', '没有了', '就这些', '就这样', '好了', '够了', '没了', '不要', '不用了', '就要这些'];

export interface Named extends ShopStock {
  name: string;
  en: string;
  measure: string;
}

/** The stock with the things' names, and whether each is there today. */
export function stockOf(shop: Shop, items: ReadonlyMap<string, Item>, s: WorldSave): (Named & { now: boolean })[] {
  return shop.stock.map((x) => {
    const it = items.get(x.item);
    return { ...x, name: it?.name ?? x.item, en: it?.en ?? x.item, measure: x.measure ?? '个', now: holds(x.when, s) };
  });
}

/** 两个包子，一杯豆浆 */
export function cartZh(cart: readonly CartLine[], stock: readonly Named[]): string {
  return cart
    .map((c) => {
      const s = stock.find((x) => x.item === c.item)!;
      return `${numZh(c.n)}${s.measure}${s.name}`;
    })
    .join('，');
}

export const cartTotal = (cart: readonly CartLine[], stock: readonly Named[]) =>
  cart.reduce((t, c) => t + (stock.find((x) => x.item === c.item)?.price ?? 0) * c.n, 0);

/** A shop's conversation: one line that takes orders (the talk engine does the rest). */
export function shopScene(shop: Shop, items: ReadonlyMap<string, Item>): Scene {
  const when: Condition | undefined =
    shop.hours && shop.when ? { all: [{ hours: shop.hours }, shop.when] } : shop.hours ? { hours: shop.hours } : shop.when;
  const menu = shop.stock.map((x) => `${items.get(x.item)?.name ?? x.item} ${priceEn(x.price)}`).join(' · ');
  return {
    id: `shop-${shop.id}`,
    map: shop.map,
    npc: shop.npc,
    trigger: 'talk',
    priority: shop.priority ?? 4,
    ...(when ? { when } : {}),
    start: 'a',
    nodes: [
      {
        id: 'a',
        say: SHOP_LINES.hello.zh,
        translate: SHOP_LINES.hello.en,
        order: { shop: shop.id },
        why: `${shop.name}: ${menu}. Say what you want and how many — 「两个包子」, 「一瓶水」 — ask 「多少钱？」 any time, and say 「不要了」 when that is all.`,
      },
    ],
  };
}
