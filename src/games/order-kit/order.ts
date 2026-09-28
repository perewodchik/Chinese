import { glossaryOf } from './gloss';
import type { Brand, Coupon, Line, MenuItem, Miss, Option, OptionGroup, Order, ScreenId, Stage, Task, Want } from './types';

/**
 * The order: what is in it, what it costs, whether it is what the friend
 * asked for, and what to do next. Pure functions over plain data, so all of
 * it is tested without a screen.
 */

export const newOrder = (): Order => ({
  mode: '自提',
  dine: null,
  lines: [],
  placed: [],
  note: [],
  noteText: '',
  diners: null,
  tea: null,
  address: null,
  cutlery: null,
});

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

/** The item's measure word: 杯 for drinks, 份 for the rest unless it says. */
export const unitOf = (item: MenuItem) =>
  item.unit ?? (item.groups.includes('temp') || item.groups.includes('ice') ? '杯' : '份');

/** What a friend calls it: 标准美式 is 美式. */
export const callOf = (item: MenuItem) => item.call ?? item.zh;

/** The options an item offers in a group, before rules. */
export function offered(brand: Brand, item: MenuItem, group: string): Option[] {
  const g = groupOf(brand, group);
  const only = item.only?.[group];
  return only ? g.options.filter((o) => only.includes(o.id)) : g.options;
}

/** A group with a showIf is there only while what it depends on is chosen. */
export function visible(brand: Brand, choices: Record<string, string[]>, group: string): boolean {
  const cond = groupOf(brand, group).showIf;
  return !cond || cond.some(([g, o]) => choices[g]?.includes(o));
}

export const visibleGroups = (brand: Brand, item: MenuItem, choices: Record<string, string[]>) =>
  item.groups.filter((g) => visible(brand, choices, g));

/** Options switched off by what else is chosen: 热 takes away the ice levels. */
export function disabled(brand: Brand, choices: Record<string, string[]>, group: string): Set<string> {
  const out = new Set<string>();
  for (const r of brand.rules) {
    if (r.disable[0] !== group) continue;
    if (choices[r.if[0]]?.includes(r.if[1])) r.disable[1].forEach((o) => out.add(o));
  }
  return out;
}

/** Drop whatever a rule has switched off, and the groups that are hidden. */
export function applyRules(brand: Brand, choices: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [g, ids] of Object.entries(choices)) {
    if (!visible(brand, choices, g)) {
      out[g] = [];
      continue;
    }
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
    const group = groupOf(brand, g);
    const d = item.defaults?.[g] ?? group.default;
    // a one-of group with a single option has nothing to choose: 仅冰饮
    const pick = group.kind === 'one' && opts.length === 1 ? opts[0].id : d && opts.some((o) => o.id === d) ? d : null;
    out[g] = pick ? [pick] : [];
  }
  return applyRules(brand, out);
}

/** Tap an option: one-of groups switch, many-of groups toggle (up to their pick). */
export function choose(
  brand: Brand,
  choices: Record<string, string[]>,
  group: string,
  option: string,
): Record<string, string[]> {
  const g = groupOf(brand, group);
  if (disabled(brand, choices, group).has(option)) return choices;
  const cur = choices[group] ?? [];
  let next: string[];
  if (g.kind === 'one') next = [option];
  else if (cur.includes(option)) next = cur.filter((o) => o !== option);
  else if (g.pick && cur.length >= g.pick) return choices;
  else next = [...cur, option];
  return applyRules(brand, { ...choices, [group]: next });
}

/** The first required group left empty (请选择温度), or a 双拼 with one meat. */
export function missingRequired(brand: Brand, item: MenuItem, choices: Record<string, string[]>): OptionGroup | null {
  for (const g of visibleGroups(brand, item, choices)) {
    const group = groupOf(brand, g);
    const n = choices[g]?.length ?? 0;
    if (group.required && !n) return group;
    if (group.pick && n !== group.pick) return group;
  }
  return null;
}

/** Whether a row gets a round + (nothing to choose) or 选规格. */
export const needsSheet = (brand: Brand, item: MenuItem) =>
  item.groups.some((g) => groupOf(brand, g).kind === 'many' || offered(brand, item, g).length > 1);

export function unitPrice(brand: Brand, line: Pick<Line, 'item' | 'choices'>): number {
  const item = itemOf(brand, line.item);
  let base = item.price;
  let add = 0;
  for (const [g, ids] of Object.entries(line.choices)) {
    for (const id of ids) {
      const o = groupOf(brand, g).options.find((x) => x.id === id);
      if (item.prices?.[id] !== undefined) base = item.prices[id];
      else if (o?.times) base = base * o.times;
      add += o?.delta ?? 0;
    }
  }
  return round1(base + add);
}

export const lineTotal = (brand: Brand, line: Line) => round1(unitPrice(brand, line) * line.qty);

/** Two lines with the same item and the same choices are one line. */
export function lineKey(line: Pick<Line, 'item' | 'choices'>): string {
  const parts = Object.keys(line.choices)
    .filter((g) => line.choices[g].length)
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

/** Everything ordered so far: the batches sent, then the cart. */
export const allLines = (order: Order) => [...order.placed.flat(), ...order.lines];

/** 冰/少甜/燕麦奶 — the grey line under an item in the cart. */
export function specText(brand: Brand, line: Pick<Line, 'item' | 'choices'>): string[] {
  const item = itemOf(brand, line.item);
  const out: string[] = [];
  for (const g of visibleGroups(brand, item, line.choices)) {
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

/** The coupon an app like 瑞幸's picks by itself: the one that saves most. */
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

export function couponOf(brand: Brand, order: Order, lines = allLines(order)): Coupon | null {
  if (order.coupon === null) return null;
  if (order.coupon === undefined) return brand.autoCoupon ? bestCoupon(brand, lines) : null;
  const c = brand.coupons.find((x) => x.id === order.coupon) ?? null;
  return c && usable(brand, lines, c) ? c : null;
}

export interface Bill {
  items: number;
  /** 餐具 ¥2 × 3, 茶位费, 配送费… */
  fees: { zh: string; amount: number; each: number; n: number }[];
  coupon: Coupon | null;
  discount: number;
  /** delivery 满减 */
  promo: number;
  total: number;
}

export function price(brand: Brand, order: Order, lines = allLines(order)): Bill {
  const items = subtotal(brand, lines);
  const delivery = order.mode === '外送';
  const fees: Bill['fees'] = [];
  for (const f of brand.fees) {
    if (f.delivery && !delivery) continue;
    const n = f.per === 'person' ? (order.diners ?? 0) : f.per === 'item' ? count(lines) : 1;
    if (n > 0 && lines.length) fees.push({ zh: f.zh, amount: round1(f.amount * n), each: f.amount, n });
  }
  const coupon = couponOf(brand, order, lines);
  const discount = coupon ? Math.min(items, saving(brand, lines, coupon)) : 0;
  const p = brand.delivery?.promo;
  const promo = delivery && p && items >= p.min ? p.off : 0;
  const feeTotal = fees.reduce((a, f) => a + f.amount, 0);
  return { items, fees, coupon, discount: round1(discount), promo, total: round1(Math.max(0, items - discount - promo) + feeTotal) };
}

/* --------------------------------------------------------------- checking */

const QTY = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
export const qtyZh = (n: number) => QTY[n] ?? String(n);
const QTY_EN = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const qtyEn = (n: number) => QTY_EN[n] ?? String(n);

export const optionOf = (brand: Brand, group: string, id: string) =>
  groupOf(brand, group).options.find((o) => o.id === id)!;

const en = (brand: Brand, zh: string) => glossaryOf(brand)[zh]?.en ?? zh;

type LineWant = Extract<Want, { kind: 'line' }>;
const lineWantsOf = (wants: Want[]) => wants.filter((w): w is LineWant => w.kind === 'line');
const asList = (v: string | string[]) => (Array.isArray(v) ? v : [v]);

function groupMatches(line: Line, g: string, v: string | string[]) {
  const got = line.choices[g] ?? [];
  if (!Array.isArray(v)) return got.includes(v);
  return got.length === v.length && v.every((o) => got.includes(o));
}

function satisfies(line: Line, want: LineWant) {
  return line.item === want.item && Object.entries(want.choices).every(([g, v]) => groupMatches(line, g, v));
}

/** 两碗, 一笼, 三两 — how many, said with the item's measure word. */
const howMany = (item: MenuItem, n: number) => `${qtyZh(n)}${unitOf(item)}`;

const optionsZh = (brand: Brand, g: string, v: string | string[]) =>
  asList(v)
    .map((id) => optionOf(brand, g, id).zh)
    .join('、');

/** 冰拿铁 · 少甜 · 燕麦奶 — a want as the results list shows it. */
export function wantText(brand: Brand, w: Want): string {
  switch (w.kind) {
    case 'dine':
    case 'note':
      return w.value;
    case 'diners':
      return `${w.n}人`;
    case 'tea':
      return optionOf(brand, brand.table!.tea!, w.value).zh;
    case 'mode':
      return w.value;
    case 'address':
      return brand.delivery!.addresses.find((a) => a.id === w.value)!.zh;
    case 'cutlery':
      return w.n ? `餐具${w.n}份` : '无需餐具';
    case 'coupon':
      return w.id ? brand.coupons.find((c) => c.id === w.id)!.zh : '优惠券';
    case 'budget':
      return `≤¥${w.max}`;
    case 'line': {
      const item = itemOf(brand, w.item);
      const opts = item.groups.flatMap((g) => (w.choices[g] ? [optionsZh(brand, g, w.choices[g])] : [])).filter(Boolean);
      return [`${w.qty > 1 ? howMany(item, w.qty) : ''}${callOf(item)}`, ...opts].join(' · ');
    }
  }
}

/** The whole task in short form: 冰拿铁 · 少甜 · 燕麦奶 · 外带 */
export const shortForm = (brand: Brand, task: Task) =>
  [...task.wants, ...(task.later?.wants ?? [])].map((w) => wantText(brand, w)).join(' · ');

export function lineText(brand: Brand, line: Line): string {
  const item = itemOf(brand, line.item);
  return [`${line.qty > 1 ? howMany(item, line.qty) : ''}${item.zh}`, ...specText(brand, line)].join(' · ');
}

/**
 * Compare an order with what a message asked for. Only what it names is
 * checked: options it does not mention may be anything, as they may in real
 * life. `lines` is the batch being sent — the cart, or for table service the
 * dishes of this 下单.
 */
export function check(brand: Brand, order: Order, wants: Want[], lines = order.lines): { ok: boolean; misses: Miss[] } {
  const misses: Miss[] = [];
  const lineWants = lineWantsOf(wants);
  const need = lineWants.map((w) => w.qty);
  const surplus: Line[] = [];

  for (const line of lines) {
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
      const wrong = item.groups.find((g) => w.choices[g] && !groupMatches(line, g, w.choices[g]));
      if (wrong) {
        const asked = optionsZh(brand, wrong, w.choices[wrong]);
        const got = (line.choices[wrong] ?? []).map((id) => optionOf(brand, wrong, id).zh).join('、') || '—';
        misses.push({
          zh: `不对哦，我要的是${asked}～`,
          en: `Not quite — I wanted ${asked} (${asList(w.choices[wrong]).map((id) => en(brand, optionOf(brand, wrong, id).zh)).join(', ')}) for the ${en(brand, callOf(item))}.`,
          asked: `${callOf(item)} · ${asked}`,
          got: `${item.zh} · ${got}`,
        });
        need[i] = Math.max(0, need[i] - line.qty);
        continue;
      }
    }
    const wanted = lineWants.filter((w) => w.item === line.item).reduce((a, w) => a + w.qty, 0);
    if (wanted > 0) {
      misses.push({
        zh: `我只要${howMany(item, wanted)}${callOf(item)}～`,
        en: `I only wanted ${qtyEn(wanted)} ${en(brand, callOf(item))}.`,
        asked: `${howMany(item, wanted)}${callOf(item)}`,
        got: `${howMany(item, wanted + line.qty)}${item.zh}`,
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
    const some = lines.some((l) => l.item === w.item);
    misses.push(
      some
        ? {
            zh: `我要${howMany(item, w.qty)}${callOf(item)}～`,
            en: `I wanted ${qtyEn(w.qty)} ${en(brand, callOf(item))}.`,
            asked: wantText(brand, w),
            got: lines.filter((l) => l.item === w.item).map((l) => lineText(brand, l)).join('；'),
          }
        : {
            zh: `我要的是${callOf(item)}～`,
            en: `I wanted ${callOf(item)} (${en(brand, callOf(item))}).`,
            asked: wantText(brand, w),
            got: '—',
          },
    );
  });

  for (const w of wants) {
    const miss = (zh: string, english: string, got: string) => misses.push({ zh, en: english, asked: wantText(brand, w), got });
    switch (w.kind) {
      case 'dine':
        if (order.dine !== w.value) miss(`不对哦，我要的是${w.value}～`, `Not quite — I wanted ${w.value} (${en(brand, w.value)}).`, order.dine ?? '—');
        break;
      case 'note':
        if (!order.note.includes(w.value))
          miss(`备注里要写${w.value}～`, `Put ${w.value} (${en(brand, w.value)}) in the note (备注).`, order.note.length ? `备注 ${order.note.join('，')}` : '—');
        break;
      case 'diners':
        if (order.diners !== w.n) miss(`我们是${qtyZh(w.n)}个人哦～`, `There are ${qtyEn(w.n)} of us.`, order.diners ? `${order.diners}人` : '—');
        break;
      case 'tea': {
        const t = optionOf(brand, brand.table!.tea!, w.value).zh;
        if (order.tea !== w.value)
          miss(`我们要喝${t}～`, `We want ${t} (${en(brand, t)}).`, order.tea ? optionOf(brand, brand.table!.tea!, order.tea).zh : '—');
        break;
      }
      case 'mode':
        if (order.mode !== w.value) miss(`我要外送～`, `I wanted it delivered (外送).`, order.mode);
        break;
      case 'address': {
        const a = brand.delivery!.addresses.find((x) => x.id === w.value)!;
        if (order.address !== w.value)
          miss(`送到${a.zh}～`, `Deliver it to ${a.zh} (${en(brand, a.zh)}).`, brand.delivery!.addresses.find((x) => x.id === order.address)?.zh ?? '—');
        break;
      }
      case 'cutlery':
        if (order.cutlery !== w.n)
          miss(w.n ? `要${qtyZh(w.n)}份餐具～` : '不要餐具～', w.n ? `I wanted ${qtyEn(w.n)} sets of cutlery.` : 'I wanted no cutlery (无需餐具).', order.cutlery === null ? '—' : order.cutlery ? `餐具${order.cutlery}份` : '无需餐具');
        break;
      case 'coupon': {
        const used = couponOf(brand, order, lines);
        const ok = couponMet(brand, order, w, lines);
        const c = w.id ? brand.coupons.find((x) => x.id === w.id)! : null;
        if (!ok)
          miss(c ? `用${c.zh}那张券～` : '用一下优惠券嘛～', c ? `Use the ${c.zh} coupon (${en(brand, c.zh)}).` : 'Use a coupon (优惠券).', used?.zh ?? '—');
        break;
      }
      case 'budget': {
        const total = price(brand, order, lines).total;
        if (total > w.max) miss(`太贵了，我只有${w.max}块～`, `Too expensive — I only have ¥${w.max}.`, `¥${yuan(total)}`);
        break;
      }
      case 'line':
        break;
    }
  }
  return { ok: misses.length === 0, misses };
}

/** A coupon want: that coupon in use, or any. */
export function couponMet(brand: Brand, order: Order, w: Extract<Want, { kind: 'coupon' }>, lines = order.lines): boolean {
  const used = couponOf(brand, order, lines);
  return w.id ? used?.id === w.id : !!used;
}

/* ---------------------------------------------------------------- hinting */

export type Sheet =
  | null
  | { kind: 'spec'; item: string; choices: Record<string, string[]>; qty?: number }
  | { kind: 'cart' }
  | { kind: 'pay' }
  | { kind: 'coupon' }
  | { kind: 'note' }
  | { kind: 'address' }
  | { kind: 'cutlery' };

/** Where the learner is: the screen, and what is open over it. */
export interface View {
  screen: 'chat' | 'home' | 'landing' | 'menu' | 'checkout' | 'table' | 'bill' | 'pickup' | 'orders' | 'me';
  sheet: Sheet;
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
 * What the order has to meet right now: the wants of the message in play,
 * and for table service what comes after 下单 — more dishes (加菜) or the bill.
 */
export interface Goal {
  wants: Want[];
  after: 'pay' | 'more' | 'bill';
}

export const goalOf = (task: Task | null, stage: 0 | 1, later: boolean): Goal | null =>
  !task
    ? null
    : stage === 0
      ? { wants: task.wants, after: task.later ? 'more' : 'bill' }
      : { wants: task.later!.wants, after: later ? 'bill' : 'more' };

/**
 * 下一步: one line of English and the control to press. The first thing the
 * order still lacks, or the next screen in the flow.
 */
export function nextHint(brand: Brand, order: Order, goal: Goal | null, view: View): Hint {
  const gl = glossaryOf(brand);
  const g = (zh: string) => gl[zh]?.en ?? '';
  const wants = goal?.wants ?? [];
  const want = <K extends Want['kind']>(k: K) => wants.find((w): w is Extract<Want, { kind: K }> => w.kind === k);
  const table = brand.model === 'table';

  if (view.screen === 'chat') return { en: `Open the mini-program: tap the ${brand.name} card under the message.`, target: 'chat-card' };
  if (view.screen === 'home') {
    if (want('mode')?.value === '外送') return { en: '外送 is delivery — tap it: the order is to be delivered.', target: 'home-delivery' };
    return { en: `${brand.model === 'counter' ? '到店点餐' : '到店取'} — order here and pick it up. Tap it to see the menu.`, target: 'home-pickup' };
  }
  if (view.screen === 'pickup') return { en: '完成 — you are done. Tap it for the next order.', target: 'pickup-done' };
  if (view.sheet?.kind === 'pay') return { en: 'Tap any six digits to pay (this is practice), then 完成 (done).', target: 'pay-pad' };
  if (view.screen === 'orders' || view.screen === 'me') return { en: 'Nothing to do here — 点单 (order) is the tab for the menu.', target: 'tab:menu' };

  if (view.screen === 'landing') {
    const d = want('diners');
    if (d && order.diners !== d.n) return { en: `就餐人数 is how many are eating: tap ${d.n}.`, target: `diners:${d.n}` };
    if (!order.diners) return { en: '就餐人数 — how many are eating. The order does not say; pick any.', target: 'diners:2' };
    const tea = brand.table?.tea;
    if (tea) {
      const t = want('tea');
      const o = t ? optionOf(brand, tea, t.value) : null;
      if (o && order.tea !== t!.value) return { en: `选茶 — choose the tea: ${o.zh} is ${g(o.zh)}.`, target: `tea:${t!.value}` };
      if (!order.tea) return { en: '选茶 — every table chooses a tea. The order does not say; pick any.', target: `tea:${groupOf(brand, tea).options[0].id}` };
    }
    return { en: '开始点餐 — start ordering.', target: 'landing-start' };
  }
  if (view.screen === 'table') {
    if (goal?.after === 'more') return { en: '加菜 is "add more dishes" — your friend wants more. Tap it.', target: 'more-btn' };
    return { en: '去买单 — go and pay the bill.', target: 'bill-btn' };
  }
  if (view.screen === 'bill') return { en: '去支付 means "go and pay". Tap it.', target: 'pay-btn' };

  const lineWants = lineWantsOf(wants);
  // which wanted lines are still missing, and which lines are not wanted
  const need = lineWants.map((w) => w.qty);
  const extra: number[] = [];
  order.lines.forEach((line, li) => {
    if (!goal) return;
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
    const add = { en: 'Everything asked for is chosen. Tap 加入购物车 (add to cart).', target: 'spec-add' };
    if (!goal) {
      const req = missingRequired(brand, item, sheet.choices);
      if (req) return { en: `Choose the ${g(req.zh).toLowerCase() || req.zh}: ${req.zh} is required.`, target: `group:${req.id}` };
      return { ...add, en: 'Tap 加入购物车 (add to cart).' };
    }
    if (!w) return { en: `${item.zh} is not what this order needs — close the sheet with ×.`, target: 'spec-close' };
    for (const gid of visibleGroups(brand, item, sheet.choices)) {
      const v = w.choices[gid];
      if (v === undefined) continue;
      const group = groupOf(brand, gid);
      const have = sheet.choices[gid] ?? [];
      const wantList = asList(v);
      const toAdd = wantList.find((o) => !have.includes(o));
      const toDrop = Array.isArray(v) ? have.find((o) => !wantList.includes(o)) : undefined;
      if (toDrop) {
        const o = optionOf(brand, gid, toDrop);
        return { en: `${o.zh} is not asked for — tap it again to take it off.`, target: `opt:${gid}:${toDrop}` };
      }
      if (toAdd) {
        const o = optionOf(brand, gid, toAdd);
        return { en: `Choose the ${g(group.zh).toLowerCase() || group.zh}: ${o.zh} is ${g(o.zh) || o.zh}.`, target: `opt:${gid}:${toAdd}` };
      }
    }
    const req = missingRequired(brand, item, sheet.choices);
    if (req) return { en: `${req.zh} (${g(req.zh).toLowerCase()}) must be chosen — the order does not say, so any is fine.`, target: `group:${req.id}` };
    if ((sheet.qty ?? 1) < need[missing]) return { en: `The order wants ${qtyZh(w.qty)} (${w.qty}) — set the number with + before adding.`, target: 'spec-plus' };
    return add;
  }

  if (view.sheet?.kind === 'note') {
    const n = wants.find((w) => w.kind === 'note' && !order.note.includes(w.value));
    if (n && n.kind === 'note') return { en: `Tap ${n.value} (${g(n.value)}).`, target: `note:${n.value}` };
    return { en: 'Close this with 确定 (OK).', target: 'sheet-ok' };
  }
  if (view.sheet?.kind === 'coupon') {
    const c = want('coupon');
    if (c?.id && order.coupon !== c.id) return { en: `Choose ${brand.coupons.find((x) => x.id === c.id)!.zh}.`, target: `coupon:${c.id}` };
    if (c && !c.id && !couponOf(brand, order)) {
      const any = brand.coupons.find((x) => usable(brand, order.lines, x));
      if (any) return { en: `Choose a coupon that can be used (可用): ${any.zh}.`, target: `coupon:${any.id}` };
    }
    return { en: 'Close this with 确定 (OK).', target: 'sheet-ok' };
  }
  if (view.sheet?.kind === 'address') {
    const a = want('address');
    const addr = a ? brand.delivery!.addresses.find((x) => x.id === a.value)! : brand.delivery!.addresses[0];
    return { en: `Choose ${addr.zh} (${g(addr.zh)}).`, target: `addr:${addr.id}` };
  }
  if (view.sheet?.kind === 'cutlery') {
    const c = want('cutlery');
    return c ? { en: c.n ? `Choose ${c.n}.` : '无需餐具 — no cutlery.', target: `cut:${c.n}` } : { en: 'Choose how many sets of cutlery.', target: 'cut:1' };
  }

  if (missing >= 0 || extra.length) {
    if (view.screen === 'checkout') return { en: 'Something in the order is not right yet — go back (‹) to the menu.', target: 'nav-back' };
    if (extra.length) {
      const li = extra[0];
      const item = itemOf(brand, order.lines[li].item);
      if (view.sheet?.kind === 'cart')
        return { en: `${item.zh} is not wanted in this order — take it out with −.`, target: `cart-minus:${li}` };
      return { en: `Open the cart (the bar at the bottom) to take out ${item.zh}.`, target: 'cart-bar' };
    }
    const w = lineWants[missing];
    const item = itemOf(brand, w.item);
    if (view.sheet?.kind === 'cart') return { en: `Close the cart and find ${callOf(item)} on the menu.`, target: 'cart-close' };
    const cat = brand.categories.find((c) => item.cats.includes(c.id) && c.id !== 'top') ?? brand.categories[0];
    const same = callOf(item) === item.zh;
    return {
      en: `${same ? '' : `${callOf(item)} is ${item.zh} on the menu. `}Find ${item.zh} (${g(item.zh) || g(callOf(item))}) under ${cat.zh} (${g(cat.zh)}) and tap it.`,
      target: `item:${item.id}`,
    };
  }

  if (view.screen === 'menu' && !order.lines.length)
    return { en: `Just browsing: tap anything on the menu — 选规格 opens its options.`, target: `item:${brand.items[0].id}` };
  if (view.screen === 'menu' || view.sheet?.kind === 'cart')
    return table
      ? { en: '选好了 — "done choosing". Tap it to check the order before sending it.', target: 'checkout-btn' }
      : { en: '去结算 means "go and pay" — tap it to check out.', target: 'checkout-btn' };

  // the checkout page
  const note = wants.find((w) => w.kind === 'note' && !order.note.includes(w.value));
  const noteHint = (v: string) => ({ en: `${v} (${g(v)}) goes in 备注 (the note). Tap 备注.`, target: 'note-row' });
  if (table) {
    if (note && note.kind === 'note') return noteHint(note.value);
    return { en: '下单 — send the order to the kitchen.', target: 'order-btn' };
  }
  const mode = want('mode');
  if (mode && order.mode !== mode.value) return { en: '外送 is delivery — switch to it at the top.', target: 'mode:外送' };
  if (order.mode === '外送') {
    const a = want('address');
    if ((a && order.address !== a.value) || !order.address) return { en: '收货地址 — where it is delivered. Tap it to choose.', target: 'address-row' };
    const c = want('cutlery');
    if ((c && order.cutlery !== c.n) || order.cutlery === null) return { en: '餐具数量 — how many sets of cutlery. Tap it.', target: 'cutlery-row' };
  } else {
    const dine = want('dine');
    const [a, b] = brand.dine ?? ['堂食', '外带'];
    if (dine && order.dine !== dine.value) return { en: `取餐方式 is how you take it: ${dine.value} is ${g(dine.value)}.`, target: `dine:${dine.value}` };
    if (!order.dine) return { en: `取餐方式: pick ${a} (${g(a)}) or ${b} (${g(b)}) — the order does not say, so either is fine.`, target: `dine:${a}` };
  }
  if (note && note.kind === 'note') return noteHint(note.value);
  const c = want('coupon');
  if (c && !couponMet(brand, order, c)) return { en: '优惠券 — the coupon. Tap it to choose one.', target: 'coupon-row' };
  const budget = want('budget');
  if (budget && price(brand, order).total > budget.max) return { en: `The total is over ¥${budget.max} — go back and choose something cheaper.`, target: 'nav-back' };
  return { en: '去支付 means "go and pay". Tap it.', target: 'pay-btn' };
}

/* ------------------------------------------------------------ the solution */

/** The lines a message asks for, with every other option left at its default. */
export function solveLines(brand: Brand, wants: Want[]): Line[] {
  let lines: Line[] = [];
  for (const w of lineWantsOf(wants)) {
    const item = itemOf(brand, w.item);
    let choices = defaultChoices(brand, item);
    for (const [g, v] of Object.entries(w.choices)) {
      if (groupOf(brand, g).kind === 'many') choices = { ...choices, [g]: [] };
      for (const o of asList(v)) choices = choose(brand, choices, g, o);
    }
    for (let guard = 0; guard < 8; guard++) {
      const req = missingRequired(brand, item, choices);
      if (!req) break;
      const opts = offered(brand, item, req.id).filter((o) => !(choices[req.id] ?? []).includes(o.id) && !disabled(brand, choices, req.id).has(o.id));
      choices = choose(brand, choices, req.id, opts[0].id);
    }
    lines = addLine(lines, { item: w.item, choices, qty: w.qty });
  }
  return lines;
}

/** An order that meets a message — for the tests. */
export function solve(brand: Brand, stage: Stage): Order {
  const want = <K extends Want['kind']>(k: K) => stage.wants.find((w): w is Extract<Want, { kind: K }> => w.kind === k);
  const o = newOrder();
  const delivery = want('mode')?.value === '外送';
  const coupon = want('coupon');
  return {
    ...o,
    lines: solveLines(brand, stage.wants),
    dine: want('dine')?.value ?? brand.dine?.[1] ?? null,
    note: stage.wants.flatMap((w) => (w.kind === 'note' ? [w.value] : [])),
    diners: want('diners')?.n ?? (brand.model === 'table' ? 2 : null),
    tea: want('tea')?.value ?? (brand.table?.tea ? groupOf(brand, brand.table.tea).options[0].id : null),
    mode: delivery ? '外送' : '自提',
    address: want('address')?.value ?? (delivery ? brand.delivery!.addresses[0].id : null),
    cutlery: want('cutlery')?.n ?? (delivery ? 1 : null),
    coupon: coupon ? (coupon.id ?? brand.coupons.find((c) => usable(brand, solveLines(brand, stage.wants), c))?.id) : undefined,
  };
}
