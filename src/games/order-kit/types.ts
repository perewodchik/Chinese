/**
 * The shape of a shop, an order and a task — plain data, shared by every
 * ordering game (瑞幸, 蜜雪冰城, 外婆家, 点都德, 马记永, 喜家德, 海底捞).
 *
 * A brand is written once as a `Brand` (its menu, option groups, coupons,
 * fees, flow, glossary, tips and task templates) and the kit does the rest:
 * it draws the mini-program, keeps the order, prices it, checks it against
 * the task and says what to do next. Nothing here knows about React.
 *
 * Three ways a shop works (`model`):
 *   chain    order, pay, collect with a 取餐码 (瑞幸, 蜜雪冰城)
 *   counter  the same, with a queue number — 先付后吃 (马记永, 喜家德)
 *   table    scan the table's code, say how many, order, 加菜 while eating,
 *            then 买单 — 先吃后付 (外婆家, 点都德, 海底捞)
 */

/** A choice inside an option group: 冰, 少甜, 燕麦奶, 超大杯 +¥3, 半份. */
export interface Option {
  id: string;
  zh: string;
  /** added to the unit price when chosen */
  delta?: number;
  /** multiplies the item's price: 半份 ×0.6, 三两 ×3 */
  times?: number;
  /** a small grey note after the name: 16oz, 约25%, 约6个 */
  sub?: string;
}

/** 温度, 糖度, 加料, 规格, 辣度, 面型… */
export interface OptionGroup {
  id: string;
  zh: string;
  kind: 'one' | 'many';
  /** a required group with nothing chosen stops 加入购物车 with 请选择… */
  required: boolean;
  options: Option[];
  /** chosen when the sheet opens; a required group without one must be picked */
  default?: string;
  /** a many-of group where exactly this many must be picked: 双拼 is two meats */
  pick?: number;
  /** shown only while one of these is chosen elsewhere: 辣度 only with 麻辣 */
  showIf?: [group: string, option: string][];
}

/** When one option is chosen, some options of another group are not offered. */
export interface Rule {
  if: [group: string, option: string];
  disable: [group: string, options: string[]];
}

export interface Category {
  id: string;
  zh: string;
}

export interface MenuItem {
  id: string;
  zh: string;
  /** what a friend calls it in a message: 标准美式 is just 美式 */
  call?: string;
  /** the categories it is listed under (人气TOP repeats items from the others) */
  cats: string[];
  /** a key into the brand's photos */
  photo: string;
  /** the list price */
  price: number;
  /** 预估到手: the price after the best coupon, as the menu shows it */
  deal?: number;
  /** one line under the name (restaurants often have none) */
  desc: string;
  tags?: string[];
  /** option groups offered, in the order the sheet shows them */
  groups: string[];
  /** options this item offers, where it offers fewer than the group: 仅冰饮 */
  only?: Record<string, string[]>;
  /** defaults for this item, over the group's own */
  defaults?: Record<string, string>;
  /** a price that replaces the item's when an option is chosen: 烧鹅 半只 ¥118 */
  prices?: Record<string, number>;
  /** 月售 */
  sold?: number;
  /** the HSK words it is (拿铁 is 咖啡), for the results and the record */
  hsk?: string[];
  /** its measure word: 杯, 碗, 份, 笼, 个… (杯 for drinks, 份 otherwise) */
  unit?: string;
  /** the price is per this, where it is not per the unit: ¥14/两 */
  per?: string;
  /** chilli marks on the row: 1–3 */
  spicy?: number;
}

export interface Coupon {
  id: string;
  zh: string;
  /** a line under it: 满30可用 */
  sub: string;
  /** 'deal': one drink at its 预估到手 price; 'off': 满 min 减 value */
  kind: 'deal' | 'off';
  value?: number;
  min?: number;
}

/** A charge on the bill that is not a dish: 餐具, 茶位费, 调料, 配送费, 打包费. */
export interface Fee {
  zh: string;
  amount: number;
  /** per diner, once per order, or per thing ordered */
  per: 'person' | 'order' | 'item';
  /** only on delivery orders */
  delivery?: boolean;
}

/** One screen of the flow, as the guide's map shows it. */
export interface FlowStep {
  id: ScreenId;
  zh: string;
  en: string;
}

export type ScreenId =
  | 'chat'
  | 'home'
  | 'landing'
  | 'menu'
  | 'spec'
  | 'cart'
  | 'checkout'
  | 'table'
  | 'bill'
  | 'pay'
  | 'pickup';

export interface Gloss {
  py: string;
  en: string;
  /** how it is used on the screen: 少少甜 ≈ 25% sugar */
  note?: string;
  /** the HSK words it is made of, when it is not one itself: 一杯 → 一, 杯 */
  hsk?: string[];
}

/** A group of words for the "Menu words" list. */
export interface WordGroup {
  en: string;
  words: string[];
}

export interface TourStep {
  /** the data-tour mark on the control */
  target: string;
  zh: string;
  en: string;
}

export interface Address {
  id: string;
  /** 公司, 家 */
  zh: string;
  /** the street line under it */
  sub: string;
}

export interface Brand {
  id: string;
  /** 瑞幸咖啡 */
  name: string;
  /** luckin coffee — the Latin wordmark under the Chinese one */
  latin: string;
  /** the merchant line on the payment sheet */
  merchant: string;
  /** one sentence for the intro */
  pitch: string;
  model: 'chain' | 'counter' | 'table';
  colours: { brand: string; soft: string; ink: string; darkBrand: string; darkSoft: string };
  store: { zh: string; distance: string };
  categories: Category[];
  items: MenuItem[];
  groups: Record<string, OptionGroup>;
  rules: Rule[];
  coupons: Coupon[];
  /** the app picks the best coupon by itself (瑞幸); otherwise the learner does */
  autoCoupon?: boolean;
  fees: Fee[];
  /** 备注 quick chips */
  notes: string[];
  /** 取餐方式 for chain and counter shops: 堂食 / 外带 or 打包 */
  dine?: [string, string];
  /** what the pickup screen calls the number: 取餐码 2361, or 取餐号 A047 */
  code?: { zh: string; prefix?: string };
  /** table service: the table, and the tea everyone is asked for (点都德) */
  table?: { no: string; tea?: string };
  /** delivery (外送), for the shops that offer it in the game */
  delivery?: { min: number; addresses: Address[]; promo?: { min: number; off: number } };
  flow: FlowStep[];
  /** every Chinese string the brand shows, with pinyin and English */
  glossary: Record<string, Gloss>;
  /** one line per screen for the guide */
  tips: Partial<Record<ScreenId, string>>;
  tour: TourStep[];
  words: WordGroup[];
  templates: TaskTemplate[];
  /** photos by key: a word photo stands in until the menu set has one */
  photos: Record<string, { word?: string }>;
  banner: { photo: string; zh: string; sub: string };
  /** the friend who sends the orders */
  friend: string;
}

/* ------------------------------------------------------------------ order */

export interface Line {
  item: string;
  /** group id → chosen option ids */
  choices: Record<string, string[]>;
  qty: number;
}

export type Mode = '自提' | '外送';

export interface Order {
  mode: Mode;
  /** 取餐方式 (堂食 / 外带 / 打包); null until the learner picks one */
  dine: string | null;
  /** the cart: what goes with the next 去支付 or 下单 */
  lines: Line[];
  /** table service: the batches already sent to the kitchen (the first, then each 加菜) */
  placed: Line[][];
  /** a coupon id; null = none; undefined = the best one where the app picks (autoCoupon), else none */
  coupon?: string | null;
  note: string[];
  noteText: string;
  /** table service: 就餐人数 */
  diners: number | null;
  /** table service: the tea (an option id of the brand's tea group) */
  tea: string | null;
  /** delivery: the address id, and 餐具数量 (0 = 无需餐具) */
  address: string | null;
  cutlery: number | null;
}

/* ------------------------------------------------------------------ tasks */

/** A fact the order must have. Options the task does not name may be anything. */
export type Want =
  /** choices: group → an option id, or for a many-of group the exact set */
  | { kind: 'line'; item: string; qty: number; choices: Record<string, string | string[]> }
  | { kind: 'dine'; value: string }
  | { kind: 'note'; value: string }
  | { kind: 'diners'; n: number }
  | { kind: 'tea'; value: string }
  | { kind: 'mode'; value: Mode }
  | { kind: 'address'; value: string }
  | { kind: 'cutlery'; n: number }
  /** a coupon used: that one, or any */
  | { kind: 'coupon'; id?: string }
  /** the total paid is at most this */
  | { kind: 'budget'; max: number };

/** One message and what it asks for. */
export interface Stage {
  /** the friend's message */
  message: string;
  /** its English, for the help layer only */
  en: string;
  /** the breakdown chips, in the order the app asks for them */
  parts: string[];
  wants: Want[];
}

export interface Task extends Stage {
  level: 1 | 2 | 3 | 4;
  template: string;
  /** table service: a second message once the first order is in — 加菜 */
  later?: Stage;
}

/**
 * A task template: slots filled from the menu with the seeded random source,
 * always solvable because every slot is drawn from what the menu offers.
 */
export interface TaskTemplate {
  id: string;
  level: 1 | 2 | 3 | 4;
  /** a budget, coupon or delivery order: at most one of these in a game */
  extra?: boolean;
  build(pick: TemplatePick): (Stage & { later?: Stage }) | null;
}

export interface TemplatePick {
  brand: Brand;
  int(max: number): number;
  pick<T>(list: readonly T[]): T;
  sample<T>(list: readonly T[], n: number): T[];
}

/** One thing wrong with an order, as the friend says it. */
export interface Miss {
  zh: string;
  en: string;
  /** for the diff card */
  asked: string;
  got: string;
}
