/**
 * The shape of a shop, an order and a task — plain data, shared by every
 * ordering game (瑞幸, 蜜雪冰城, 外婆家…).
 *
 * A brand is written once as a `Brand` (its menu, option groups, coupons,
 * flow, glossary, tips and task templates) and the kit does the rest: it
 * draws the mini-program, keeps the order, prices it, checks it against the
 * task and says what to do next. Nothing here knows about React.
 */

/** A choice inside an option group: 冰, 少甜, 燕麦奶, 超大杯 +¥3. */
export interface Option {
  id: string;
  zh: string;
  /** added to the unit price when chosen */
  delta?: number;
  /** a small grey note after the name: 16oz, ≈25% */
  sub?: string;
}

/** 温度, 糖度, 奶, 浓度, 杯型… */
export interface OptionGroup {
  id: string;
  zh: string;
  kind: 'one' | 'many';
  /** a required group with nothing chosen stops 加入购物车 with 请选择… */
  required: boolean;
  options: Option[];
  /** chosen when the sheet opens; a required group without one must be picked */
  default?: string;
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
  /** one line under the name */
  desc: string;
  tags?: string[];
  /** option groups offered, in the order the sheet shows them */
  groups: string[];
  /** options this item offers, where it offers fewer than the group: 仅冰饮 */
  only?: Record<string, string[]>;
  /** defaults for this item, over the group's own */
  defaults?: Record<string, string>;
  sold?: number;
  /** the HSK words it is (拿铁 is 咖啡), for the results and the record */
  hsk?: string[];
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

/** One screen of the flow, as the guide's map shows it. */
export interface FlowStep {
  id: ScreenId;
  zh: string;
  en: string;
}

export type ScreenId = 'chat' | 'home' | 'menu' | 'spec' | 'cart' | 'checkout' | 'pay' | 'pickup';

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
  colours: { brand: string; soft: string; ink: string; darkBrand: string; darkSoft: string };
  store: { zh: string; distance: string };
  categories: Category[];
  items: MenuItem[];
  groups: Record<string, OptionGroup>;
  rules: Rule[];
  coupons: Coupon[];
  /** 备注 quick chips */
  notes: string[];
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
export type Dine = '堂食' | '外带';

export interface Order {
  mode: Mode;
  /** 取餐方式; not chosen yet until the learner picks one */
  dine: Dine | null;
  lines: Line[];
  /** a coupon id; null = none; undefined = the best one, as the app picks */
  coupon?: string | null;
  note: string[];
  noteText: string;
}

/* ------------------------------------------------------------------ tasks */

/** A fact the order must have. Options the task does not name may be anything. */
export type Want =
  | { kind: 'line'; item: string; qty: number; choices: Record<string, string> }
  | { kind: 'dine'; value: Dine }
  | { kind: 'note'; value: string };

export interface Task {
  /** the friend's message */
  message: string;
  /** its English, for the help layer only */
  en: string;
  /** the breakdown chips, in the order the app asks for them */
  parts: string[];
  wants: Want[];
  level: 1 | 2 | 3;
  template: string;
}

/**
 * A task template: slots filled from the menu with the seeded random source,
 * always solvable because every slot is drawn from what the menu offers.
 */
export interface TaskTemplate {
  id: string;
  level: 1 | 2 | 3;
  build(pick: TemplatePick): Omit<Task, 'level' | 'template'> | null;
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
