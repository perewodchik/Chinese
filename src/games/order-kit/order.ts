import { glossaryOf } from './gloss';
import type { Brand, Coupon, Line, MenuItem, Miss, Option, OptionGroup, Order, ScreenId, Task, Want } from './types';

/**
 * The order: what is in it, what it costs, whether it is what the friend
 * asked for, and what to do next. Pure functions over plain data, so all of
 * it is tested without a screen.
 */

export const newOrder = (): Order => ({ mode: '自提', dine: null, lines: [], note: [], noteText: '' });

/** Prices as the apps keep them: to the jiao. */
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** 23 → "23", 23.5 → "23.5", 9.90 → "9.9" */
export const yuan = (n: number) => String(round1(n));

export const itemOf = (brand: Brand, id: string): MenuItem => {
  const it = brand.items.find((i) => i.id === id);
  if (!it) throw new Error(`no item ${id} at ${brand.id}`);
  return it;
};

export const groupOf = (brand: Brand, id: string): OptionGroup => {
  const g = brand.groups[id];
  if (!g) throw new Error(`no option group ${id} at ${brand.id}`);
  return g;
};

/** The item's measure word: 杯 for drinks, 个 for food. */
export const unitOf = (item: MenuItem) => (item.groups.includes('temp') ? '杯' : '个');

/** What a friend calls it: 标准美式 is 美式. */
export const callOf = (item: MenuItem) => item.call ?? item.zh;

/** The options an item offers in a group, before rules. */
export function offered(brand: Brand, item: MenuItem, group: string): Option[] {
  const g = groupOf(brand, group);
  const only = item.only?.[group];
  return only ? g.options.filter((o) => only.includes(o.id)) : g.options;
}

/** Options switched off by what else is chosen: 热 takes away the ice levels. */
export function disabled(brand: Brand, choices: Record<string, string[]>, group: string): Set<string> {
  const out = new Set<string>();
  for (const r of brand.rules) {
    if (r.disable[0] !== group) continue;
    if (choices[r.if[0]]?.includes(r.if[1])) r.disable[1].forEach((o) => out.add(o));
  }
  return out;
}

/** Drop whatever a rule has switched off. */
export function applyRules(brand: Brand, choices: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [g, ids] of Object.entries(choices)) {
    const off = disabled(brand, choices, g);
    out[g] = ids.filter((id) => !off.has(id));
  }
  return out;
}

/** What the sheet shows chosen when it opens. */
export function defaultChoices(brand: Brand, item: MenuItem): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of item.groups) {
    const opts = offered(brand, item, g);
    const d = item.defaults?.[g] ?? groupOf(brand, g).default;
    // a group with a single option has nothing to choose: 仅冰饮
    const pick = opts.length === 1 ? opts[0].id : d && opts.some((o) => o.id === d) ? d : null;
    out[g] = pick ? [pick] : [];
  }
  return applyRules(brand, out);
}

/** Tap an option: one-of groups switch, many-of groups toggle. */
export function choose(
  brand: Brand,
  choices: Record<string, string[]>,
  group: string,
  option: string,
): Record<string, string[]> {
  const g = groupOf(brand, group);
  if (disabled(brand, choices, group).has(option)) return choices;
  const cur = choices[group] ?? [];
  const next =
    g.kind === 'one' ? [option] : cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
  return applyRules(brand, { ...choices, [group]: next });
}

/** The first required group left empty — 请选择温度. */
export function missingRequired(brand: Brand, item: MenuItem, choices: Record<string, string[]>): OptionGroup | null {
  for (const g of item.groups) {
    const group = groupOf(brand, g);
    if (group.required && !(choices[g]?.length)) return group;
  }
  return null;
}

/** Whether a row gets a round + (nothing to choose) or 选规格. */
export const needsSheet = (brand: Brand, item: MenuItem) =>
  item.groups.some((g) => offered(brand, item, g).length > 1);

export function unitPrice(brand: Brand, line: Pick<Line, 'item' | 'choices'>): number {
  const item = itemOf(brand, line.item);
  let p = item.price;
  for (const [g, ids] of Object.entries(line.choices)) {
    for (const id of ids) p += groupOf(brand, g).options.find((o) => o.id === id)?.delta ?? 0;
  }
  return round1(p);
}

export const lineTotal = (brand: Brand, line: Line) => round1(unitPrice(brand, line) * line.qty);

/** Two lines with the same item and the same choices are one line. */
export function lineKey(line: Pick<Line, 'item' | 'choices'>): string {
  const parts = Object.keys(line.choices)
    .sort()
    .map((g) => `${g}=${[...line.choices[g]].sort().join('+')}`);
  return `${line.item}|${parts.join(',')}`;
}

export function addLine(lines: Line[], line: Line): Line[] {
  const k = lineKey(line);
  const i = lines.findIndex((l) => lineKey(l) === k);
  if (i < 0) return [...lines, line];
  return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + line.qty } : l));
}

export function setQty(lines: Line[], index: number, qty: number): Line[] {
  if (qty <= 0) return lines.filter((_, i) => i !== index);
  return lines.map((l, i) => (i === index ? { ...l, qty } : l));
}

export const count = (lines: Line[]) => lines.reduce((a, l) => a + l.qty, 0);

/** 冰/少甜/燕麦奶 — the grey line under an item in the cart. */
export function specText(brand: Brand, line: Pick<Line, 'item' | 'choices'>): string[] {
  const item = itemOf(brand, line.item);
  const out: string[] = [];
  for (const g of item.groups) {
    for (const id of line.choices[g] ?? []) {
      const o = groupOf(brand, g).options.find((x) => x.id === id);
      if (o) out.push(o.zh);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- pricing */

export const subtotal = (brand: Brand, lines: Line[]) => round1(lines.reduce((a, l) => a + lineTotal(brand, l), 0));

/** What a coupon takes off these lines; 0 when it cannot be used. */
export function saving(brand: Brand, lines: Line[], coupon: Coupon): number {
  const sum = subtotal(brand, lines);
  if (coupon.kind === 'off') return sum >= (coupon.min ?? 0) ? round1(coupon.value ?? 0) : 0;
  // one cup at its 预估到手 price: the cup where that saves the most
  let best = 0;
  for (const l of lines) {
    const it = itemOf(brand, l.item);
    if (it.deal !== undefined) best = Math.max(best, it.price - it.deal);
  }
  return round1(best);
}

export const usable = (brand: Brand, lines: Line[], coupon: Coupon) => saving(brand, lines, coupon) > 0;

/** The coupon the app picks by itself: the one that saves most. */
export function bestCoupon(brand: Brand, lines: Line[]): Coupon | null {
  let best: Coupon | null = null;
  let most = 0;
  for (const c of brand.coupons) {
    const s = saving(brand, lines, c);
    if (s > most) {
      most = s;
      best = c;
    }
  }
  return best;
}

export function couponOf(brand: Brand, order: Order): Coupon | null {
  if (order.coupon === null) return null;
  if (order.coupon === undefined) return bestCoupon(brand, order.lines);
  const c = brand.coupons.find((x) => x.id === order.coupon) ?? null;
  return c && usable(brand, order.lines, c) ? c : null;
}

export interface Bill {
  items: number;
  coupon: Coupon | null;
  discount: number;
  total: number;
}

export function price(brand: Brand, order: Order): Bill {
  const items = subtotal(brand, order.lines);
  const coupon = couponOf(brand, order);
  const discount = coupon ? Math.min(items, saving(brand, order.lines, coupon)) : 0;
  return { items, coupon, discount: round1(discount), total: round1(items - discount) };
}

/* --------------------------------------------------------------- checking */

const QTY = ['零', '一', '两', '三', '四', '五', '六'];
export const qtyZh = (n: number) => QTY[n] ?? String(n);
const QTY_EN = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

const optionOf = (brand: Brand, group: string, id: string) =>
  groupOf(brand, group).options.find((o) => o.id === id)!;

const en = (brand: Brand, zh: string) => glossaryOf(brand)[zh]?.en ?? zh;

function satisfies(line: Line, want: Extract<Want, { kind: 'line' }>) {
  return line.item === want.item && Object.entries(want.choices).every(([g, o]) => line.choices[g]?.includes(o));
}

/** 冰拿铁 · 少甜 · 燕麦奶 — a want as the results list shows it. */
export function wantText(brand: Brand, w: Want): string {
  if (w.kind === 'dine') return w.value;
  if (w.kind === 'note') return w.value;
  const item = itemOf(brand, w.item);
  const opts = item.groups.flatMap((g) => (w.choices[g] ? [optionOf(brand, g, w.choices[g]).zh] : []));
  return [`${w.qty > 1 ? `${qtyZh(w.qty)}${unitOf(item)}` : ''}${callOf(item)}`, ...opts].join(' · ');
}

/** The whole task in short form: 冰拿铁 · 少甜 · 燕麦奶 · 外带 */
export const shortForm = (brand: Brand, task: Task) => task.wants.map((w) => wantText(brand, w)).join(' · ');

export function lineText(brand: Brand, line: Line): string {
  const item = itemOf(brand, line.item);
  return [`${line.qty > 1 ? `${qtyZh(line.qty)}${unitOf(item)}` : ''}${item.zh}`, ...specText(brand, line)].join(' · ');
}

/**
 * Compare the order with the task. Only what the task names is checked:
 * options it does not mention may be anything, as they may in real life.
 */
export function check(brand: Brand, order: Order, task: Task): { ok: boolean; misses: Miss[] } {
  const misses: Miss[] = [];
  const lineWants = task.wants.filter((w): w is Extract<Want, { kind: 'line' }> => w.kind === 'line');
  const need = lineWants.map((w) => w.qty);
  const surplus: Line[] = [];

  for (const line of order.lines) {
    let left = line.qty;
    lineWants.forEach((w, i) => {
      if (left > 0 && need[i] > 0 && satisfies(line, w)) {
        const take = Math.min(left, need[i]);
        need[i] -= take;
        left -= take;
      }
    });
    if (left > 0) surplus.push({ ...line, qty: left });
  }

  for (const line of surplus) {
    const item = itemOf(brand, line.item);
    const i = lineWants.findIndex((w, j) => w.item === line.item && need[j] > 0);
    if (i >= 0) {
      // the right thing with a wrong option: say which
      const w = lineWants[i];
      const wrong = item.groups.find((g) => w.choices[g] && !line.choices[g]?.includes(w.choices[g]));
      if (wrong) {
        const o = optionOf(brand, wrong, w.choices[wrong]);
        const got = (line.choices[wrong] ?? []).map((id) => optionOf(brand, wrong, id).zh).join('/') || '—';
        misses.push({
          zh: `不对哦，我要的是${o.zh}～`,
          en: `Not quite — I wanted ${o.zh} (${en(brand, o.zh)}) for the ${en(brand, callOf(item))}.`,
          asked: `${callOf(item)} · ${o.zh}`,
          got: `${item.zh} · ${got}`,
        });
        need[i] = Math.max(0, need[i] - line.qty);
        continue;
      }
    }
    const wanted = lineWants.filter((w) => w.item === line.item).reduce((a, w) => a + w.qty, 0);
    if (wanted > 0) {
      misses.push({
        zh: `我只要${qtyZh(wanted)}${unitOf(item)}${callOf(item)}～`,
        en: `I only wanted ${QTY_EN[wanted] ?? wanted} ${en(brand, callOf(item))}.`,
        asked: `${qtyZh(wanted)}${unitOf(item)}${callOf(item)}`,
        got: `${qtyZh(wanted + line.qty)}${unitOf(item)}${item.zh}`,
      });
    } else {
      misses.push({
        zh: `我没要${callOf(item)}哦～`,
        en: `I didn't ask for ${callOf(item)} (${en(brand, callOf(item))}).`,
        asked: '—',
        got: lineText(brand, line),
      });
    }
  }

  lineWants.forEach((w, i) => {
    if (need[i] <= 0) return;
    const item = itemOf(brand, w.item);
    const some = order.lines.some((l) => l.item === w.item);
    misses.push(
      some
        ? {
            zh: `我要${qtyZh(w.qty)}${unitOf(item)}${callOf(item)}～`,
            en: `I wanted ${QTY_EN[w.qty] ?? w.qty} ${en(brand, callOf(item))}.`,
            asked: wantText(brand, w),
            got: order.lines.filter((l) => l.item === w.item).map((l) => lineText(brand, l)).join('；'),
          }
        : {
            zh: `我要的是${callOf(item)}～`,
            en: `I wanted ${callOf(item)} (${en(brand, callOf(item))}).`,
            asked: wantText(brand, w),
            got: '—',
          },
    );
  });

  for (const w of task.wants) {
    if (w.kind === 'dine' && order.dine !== w.value) {
      misses.push({
        zh: `不对哦，我要的是${w.value}～`,
        en: `Not quite — I wanted ${w.value} (${en(brand, w.value)}).`,
        asked: w.value,
        got: order.dine ?? '—',
      });
    }
    if (w.kind === 'note' && !order.note.includes(w.value)) {
      misses.push({
        zh: `备注里要写${w.value}～`,
        en: `Put ${w.value} (${en(brand, w.value)}) in the note (备注).`,
        asked: `备注 ${w.value}`,
        got: order.note.length ? `备注 ${order.note.join('，')}` : '—',
      });
    }
  }
  return { ok: misses.length === 0, misses };
}

/* ---------------------------------------------------------------- hinting */

/** Where the learner is: the screen, and what is open over it. */
export interface View {
  screen: 'chat' | 'home' | 'menu' | 'checkout' | 'pickup' | 'orders' | 'me';
  sheet: null | { kind: 'spec'; item: string; choices: Record<string, string[]> } | { kind: 'cart' } | { kind: 'pay' } | { kind: 'coupon' } | { kind: 'note' };
}

/** The flow step a view is on, for the guide's map. */
export function stepOf(view: View): ScreenId {
  if (view.sheet?.kind === 'spec') return 'spec';
  if (view.sheet?.kind === 'cart') return 'cart';
  if (view.sheet?.kind === 'pay') return 'pay';
  if (view.screen === 'orders' || view.screen === 'me') return 'home';
  return view.screen;
}

export interface Hint {
  en: string;
  /** the data-hint mark of the control to press */
  target: string;
}

/**
 * 下一步: one line of English and the control to press. The first thing the
 * order still lacks, or the next screen in the flow.
 */
export function nextHint(brand: Brand, order: Order, task: Task | null, view: View): Hint {
  const gl = glossaryOf(brand);
  const g = (zh: string) => gl[zh]?.en ?? '';
  if (view.screen === 'chat') return { en: `Open the mini-program: tap the ${brand.name} card under the message.`, target: 'chat-card' };
  if (view.screen === 'home') return { en: '到店取 is "pick up in store" — tap it to see the menu.', target: 'home-pickup' };
  if (view.screen === 'pickup') return { en: '完成 — you are done. Tap it for the next order.', target: 'pickup-done' };
  if (view.sheet?.kind === 'pay') return { en: 'Tap any six digits to pay (this is practice), then 完成 (done).', target: 'pay-pad' };
  if (view.screen === 'orders' || view.screen === 'me') return { en: 'Nothing to do here — 点单 (order) is the tab for the menu.', target: 'tab:menu' };

  const lineWants = task ? task.wants.filter((w): w is Extract<Want, { kind: 'line' }> => w.kind === 'line') : [];
  const result = task ? check(brand, order, task) : { ok: false, misses: [] };
  // which wanted lines are still missing, and which lines are not wanted
  const need = lineWants.map((w) => w.qty);
  const extra: number[] = [];
  order.lines.forEach((line, li) => {
    if (!task) return;
    let left = line.qty;
    lineWants.forEach((w, i) => {
      if (left > 0 && need[i] > 0 && satisfies(line, w)) {
        const t = Math.min(left, need[i]);
        need[i] -= t;
        left -= t;
      }
    });
    if (left > 0) extra.push(li);
  });
  const missing = lineWants.findIndex((_, i) => need[i] > 0);

  if (view.sheet?.kind === 'spec') {
    const sheet = view.sheet;
    const item = itemOf(brand, sheet.item);
    const w = missing >= 0 && lineWants[missing].item === sheet.item ? lineWants[missing] : null;
    if (!task) {
      const req = missingRequired(brand, item, sheet.choices);
      if (req) return { en: `Choose the ${g(req.zh).toLowerCase() || req.zh}: ${req.zh} is required.`, target: `group:${req.id}` };
      return { en: 'Tap 加入购物车 (add to cart).', target: 'spec-add' };
    }
    if (!w) return { en: `${item.zh} is not what this order needs — close the sheet with ×.`, target: 'spec-close' };
    for (const gid of item.groups) {
      const want = w.choices[gid];
      if (want && !sheet.choices[gid]?.includes(want)) {
        const o = optionOf(brand, gid, want);
        const group = groupOf(brand, gid);
        return { en: `Choose the ${g(group.zh).toLowerCase() || group.zh}: ${o.zh} is ${g(o.zh) || o.zh}.`, target: `opt:${gid}:${want}` };
      }
    }
    const req = missingRequired(brand, item, sheet.choices);
    if (req) return { en: `${req.zh} (${g(req.zh).toLowerCase()}) must be chosen — the order does not say, so any is fine.`, target: `group:${req.id}` };
    return { en: 'Everything asked for is chosen. Tap 加入购物车 (add to cart).', target: 'spec-add' };
  }

  if (view.sheet?.kind === 'coupon' || view.sheet?.kind === 'note') {
    const noteWant = task?.wants.find((w) => w.kind === 'note' && !order.note.includes(w.value));
    if (view.sheet.kind === 'note' && noteWant && noteWant.kind === 'note')
      return { en: `Tap ${noteWant.value} (${g(noteWant.value)}).`, target: `note:${noteWant.value}` };
    return { en: 'Close this with 确定 (OK).', target: 'sheet-ok' };
  }

  if (missing >= 0 || extra.length) {
    if (view.screen === 'checkout') return { en: 'Something in the order is not right yet — go back (‹) to the menu.', target: 'nav-back' };
    if (extra.length) {
      const li = extra[0];
      const item = itemOf(brand, order.lines[li].item);
      if (view.sheet?.kind === 'cart')
        return { en: `${item.zh} is not wanted in this order — take it out with −.`, target: `cart-minus:${li}` };
      if (missing < 0 || count(order.lines) > 0)
        return { en: `Open the cart (the bar at the bottom) to take out ${item.zh}.`, target: 'cart-bar' };
    }
    const w = lineWants[missing];
    const item = itemOf(brand, w.item);
    if (view.sheet?.kind === 'cart') return { en: `Close the cart and find ${callOf(item)} on the menu.`, target: 'cart-close' };
    const cat = brand.categories.find((c) => item.cats.includes(c.id) && c.id !== 'top') ?? brand.categories[0];
    return {
      en: `${callOf(item)} is ${g(callOf(item)) || item.zh}. Find ${item.zh} under ${cat.zh} (${g(cat.zh)}) and tap it.`,
      target: `item:${item.id}`,
    };
  }

  if (view.screen === 'menu' && !order.lines.length)
    return { en: `Just browsing: tap anything on the menu — 选规格 opens its options.`, target: `item:${brand.items[0].id}` };
  if (view.screen === 'menu') return { en: '去结算 means "go and pay" — tap it to check out.', target: 'checkout-btn' };

  // on the checkout page
  const dine = task?.wants.find((w) => w.kind === 'dine');
  if (dine && dine.kind === 'dine' && order.dine !== dine.value)
    return {
      en: `取餐方式 is how you take it: ${dine.value} is ${g(dine.value)}.`,
      target: `dine:${dine.value}`,
    };
  if (!order.dine) return { en: '取餐方式: pick 堂食 (eat in) or 外带 (take away) — the order does not say, so either is fine.', target: 'dine:堂食' };
  const note = task?.wants.find((w) => w.kind === 'note' && !order.note.includes(w.value));
  if (note && note.kind === 'note') return { en: `${note.value} is not a 温度 option — it goes in 备注 (the note). Tap 备注.`, target: 'note-row' };
  if (!result.ok && task) return { en: 'Something is not right yet — check the lines above.', target: 'nav-back' };
  return { en: '去支付 means "go and pay". Tap it.', target: 'pay-btn' };
}

/* ------------------------------------------------------------------- help */

/** What the learner leaned on during one order (§3.5). */
export interface HelpLog {
  lookups: string[];
  pinyin: boolean;
  hints: number;
}

export const newHelpLog = (): HelpLog => ({ lookups: [], pinyin: false, hints: 0 });

export const LOOKUPS_ALLOWED = 2;

export function logLookup(log: HelpLog, zh: string): HelpLog {
  return log.lookups.includes(zh) ? log : { ...log, lookups: [...log.lookups, zh] };
}

/** Help costs the first-try mark: 拼, 下一步, or three or more words looked up. */
export const usedHelp = (log: HelpLog) => log.pinyin || log.hints > 0 || log.lookups.length > LOOKUPS_ALLOWED;

/* ------------------------------------------------------------ the solution */

/** An order that meets the task — for tests, and to show on the diff card. */
export function solve(brand: Brand, task: Task): Order {
  let lines: Line[] = [];
  for (const w of task.wants) {
    if (w.kind !== 'line') continue;
    const item = itemOf(brand, w.item);
    let choices = defaultChoices(brand, item);
    for (const [g, o] of Object.entries(w.choices)) choices = choose(brand, choices, g, o);
    for (const g of item.groups) {
      if (groupOf(brand, g).required && !choices[g]?.length) choices = choose(brand, choices, g, offered(brand, item, g)[0].id);
    }
    lines = addLine(lines, { item: w.item, choices, qty: w.qty });
  }
  const dine = task.wants.find((w) => w.kind === 'dine');
  return {
    ...newOrder(),
    lines,
    dine: dine && dine.kind === 'dine' ? dine.value : '外带',
    note: task.wants.flatMap((w) => (w.kind === 'note' ? [w.value] : [])),
  };
}
