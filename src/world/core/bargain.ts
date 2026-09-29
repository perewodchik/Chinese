/**
 * Bargaining 砍价 (Y6): one generic talk for a market stall. The seller has
 * an asking price and a lowest price (data on the scene's `bargain` line);
 * you answer with numbers and the market's phrases —
 *
 *   「太贵了！」「便宜一点吧。」 → 「好吧，四十。」 (twice; then 「不能再少了。」)
 *   「三十块行吗？」 / 「最多三十」 → 「三十太少了。四十吧！」, and the second
 *   time a fair offer is taken: 「好，三十！」
 *   「算了。」 (walk away) → once, the seller calls you back at the lowest:
 *   「等一下！三十，好吗？」
 *   「好」 / 「行」 / 「买」 → the deal, paid by Y2's 扫一扫 at that price.
 *
 * Hot and cold are in the seller’s words: 「不可以！」 for an offer far
 * below, 「太少了」 for one on its way. Selling (`sell: true`, the buyer
 * opens low and goes up to a highest) is the same talk the other way round.
 * The lines are HSK 1–2 (checked by a test); the numbers are Y2's pieces.
 */

import { priceFrom } from './numbers';
import { priceZh } from './shop';

export interface Bargain {
  /** what is sold (or bought from you); none for a thing that is not an item (the clay 年兽) */
  item?: string;
  /** the first price named */
  open: number;
  /** the seller's lowest (the buyer's highest when `sell`) */
  limit: number;
  /** you sell, they buy */
  sell?: boolean;
  /** the line after the deal is paid; none ends the talk */
  go?: string;
}

export interface Haggle {
  /** the price on the table now */
  price: number;
  /** counters and drops so far */
  rounds: number;
  /** 便宜一点 answered so far (two at most) */
  drops: number;
  /** walked away once and called back */
  called: boolean;
}

export type HaggleKind = 'price' | 'counter' | 'cold' | 'drop' | 'firm' | 'deal' | 'called' | 'gone';

export interface HaggleTurn {
  kind: HaggleKind;
  zh: string;
  en: string;
  haggle: Haggle;
}

export const startHaggle = (b: Bargain): Haggle => ({ price: b.open, rounds: 0, drops: 0, called: false });

/** The seller's own words around the numbers (HSK 1–2). */
export const BARGAIN_LINES = {
  cold: { zh: '不可以！', en: 'No, no — not at that price!' },
  few: { zh: '太少了', en: 'is too little' },
  many: { zh: '太多了', en: 'is too much' },
  ok: { zh: '好吧', en: 'All right' },
  firmBuy: { zh: '不能再少了', en: 'I can’t go any lower' },
  firmSell: { zh: '不能再多了', en: 'I can’t go any higher' },
  wait: { zh: '等一下', en: 'Wait a moment' },
  deal: { zh: '好', en: 'Deal' },
  bye: { zh: '好，再见！', en: 'All right — bye!' },
};

const CHEAPER = /太贵|便宜|贵了|少一点|少点/;
const DEARER = /太少|多一点|多给|再多|少了/;
const AWAY = /算了|不要了|不买了|不卖了|走了|再见/;
const YES = /^(好|好的|行|可以|要|买|卖|成交|没问题|对)/;

/** A nice number near v: whole yuan below 20, fives above; up for a seller, down for a buyer. */
function nice(v: number, up: boolean): number {
  const step = v >= 20 ? 5 : 1;
  return (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
}

/** One line of yours at the stall: the seller's answer and the price after it (null: not bargaining words). */
export function haggle(b: Bargain, h: Haggle, text: string): HaggleTurn | null {
  const t = text.trim();
  // the seller's direction: down for a seller, up for a buyer
  const sell = !!b.sell;
  const better = (x: number, y: number) => (sell ? x > y : x < y);
  const p = (n: number) => priceZh(n).replace(/块$/, '');
  const pe = (n: number) => `${n} 元`;
  const turn = (kind: HaggleKind, zh: string, en: string, next: Partial<Haggle> = {}): HaggleTurn => ({ kind, zh, en, haggle: { ...h, ...next } });
  const deal = (price: number) => turn('deal', `${BARGAIN_LINES.deal.zh}，${p(price)}！`, `${BARGAIN_LINES.deal.en} — ${pe(price)}!`, { price });
  const x = priceFrom(t);

  if (x !== null && !/多少/.test(t)) {
    // as good as the price on the table: taken at once, at the table's price
    if (!better(x, h.price)) return deal(h.price);
    const far = sell ? x > b.limit / 0.6 : x < b.limit * 0.6;
    if (far) return turn('cold', `${p(x)}？${BARGAIN_LINES.cold.zh}${p(h.price)}。`, `${pe(x)}? ${BARGAIN_LINES.cold.en} ${pe(h.price)}.`, { rounds: h.rounds + 1 });
    const fair = !better(x, b.limit);
    const close = Math.abs(h.price - x) <= Math.max(1, Math.round(b.open * 0.1));
    if (fair && (h.rounds >= 1 || close)) return deal(x);
    const mid = nice((x + h.price) / 2, !sell);
    const c = sell ? Math.min(mid, b.limit) : Math.max(mid, b.limit);
    if (c === h.price) return turn('firm', `${sell ? BARGAIN_LINES.firmSell.zh : BARGAIN_LINES.firmBuy.zh}，${p(h.price)}。`, `${sell ? BARGAIN_LINES.firmSell.en : BARGAIN_LINES.firmBuy.en} — ${pe(h.price)}.`, { rounds: h.rounds + 1 });
    const w = sell ? BARGAIN_LINES.many : BARGAIN_LINES.few;
    return turn('counter', `${p(x)}${w.zh}。${p(c)}吧！`, `${pe(x)} ${w.en}. Say ${pe(c)}!`, { price: c, rounds: h.rounds + 1 });
  }
  if (/多少/.test(t)) return turn('price', `${p(h.price)}。`, `${pe(h.price)}.`);
  if (AWAY.test(t)) {
    if (!h.called && h.price !== b.limit) {
      return turn('called', `${BARGAIN_LINES.wait.zh}！${p(b.limit)}，好吗？`, `${BARGAIN_LINES.wait.en}! ${pe(b.limit)} — all right?`, { price: b.limit, called: true });
    }
    return turn('gone', BARGAIN_LINES.bye.zh, BARGAIN_LINES.bye.en);
  }
  if ((sell ? DEARER : CHEAPER).test(t)) {
    const firm = sell ? BARGAIN_LINES.firmSell : BARGAIN_LINES.firmBuy;
    if (h.drops >= 2 || h.price === b.limit) return turn('firm', `${firm.zh}，${p(h.price)}。`, `${firm.en} — ${pe(h.price)}.`);
    const gap = Math.abs(h.price - b.limit);
    const c = sell ? Math.min(b.limit, h.price + nice(gap / 2, true)) : Math.max(b.limit, h.price - nice(gap / 2, true));
    return turn('drop', `${BARGAIN_LINES.ok.zh}，${p(c)}。`, `${BARGAIN_LINES.ok.en} — ${pe(c)}.`, { price: c, drops: h.drops + 1, rounds: h.rounds + 1 });
  }
  if (YES.test(t) && !/不/.test(t)) return deal(h.price);
  return null;
}

/** What a patient player says at a stall: their fair offer (the limit), twice — the second time it is taken. */
export const bargainAnswer = (b: Bargain) => `${priceZh(b.limit)}行吗？`;
