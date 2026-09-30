/**
 * Your own bike (prompt §13 L): the models on sale, the save's `bike`, and
 * the bike shop's talk.
 *
 * The shop (自行车行 on 鼓楼东大街) is a talk on Y1's paying engine, shaped
 * like W5's clothes rack:
 *
 *   「我想买自行车」       → 「你看哪辆？有永久、凤凰、飞鸽。」
 *   「这辆凤凰多少钱？」   → 「凤凰四百二十块。有红的、蓝的、白的。」
 *   「有红色的吗？」       → 「有！红的。」
 *   「我可以试试吗？」     → 「可以！骑一圈试试。」 … 「怎么样？」 (a test ride on the sheet)
 *   「我要这辆」           → the 支付宝 flow (Y2) → 「谢谢！车是你的了。」
 *   「我要一个车筐」       → a part, once you have a bike
 *
 * The models are real brands by name only (brands.md): 永久 and 凤凰 from
 * Shanghai, 飞鸽 from Tianjin; the drawings are the game's own. A
 * second-hand 永久 comes from the recycler, bargained (Y6).
 *
 * Pure: `ScriptedDialogue` calls `bikeTurn` at a node with `bikes`.
 */

import { dayOf } from './clock';
import { priceZh } from './shop';
import type { Place, Tile, WorldSave } from './types';

// ---------------------------------------------------------------------------
// The bikes
// ---------------------------------------------------------------------------

export type BikeColourId = 'black' | 'green' | 'red' | 'blue' | 'white';

export interface BikeColour {
  id: BikeColourId;
  /** 黑的 … as a seller says it */
  zh: string;
  en: string;
  /** palette letters: the frame and its shade */
  paint: readonly [string, string];
}

export const BIKE_COLOURS: Record<BikeColourId, BikeColour> = {
  black: { id: 'black', zh: '黑的', en: 'black', paint: ['a', 'k'] },
  green: { id: 'green', zh: '绿的', en: 'green', paint: ['G', 'g'] },
  red: { id: 'red', zh: '红的', en: 'red', paint: ['r', 'R'] },
  blue: { id: 'blue', zh: '蓝的', en: 'blue', paint: ['n', 'B'] },
  white: { id: 'white', zh: '白的', en: 'white', paint: ['w', 'd'] },
};

export type BikeModelId = 'yongjiu' | 'fenghuang' | 'feige' | 'jiuche';

export interface BikeModel {
  id: BikeModelId;
  /** the brand as the shop writes it */
  brand: string;
  /** what the seller calls it: 永久, 凤凰, 飞鸽, 旧自行车 */
  zh: string;
  en: string;
  /** how it is drawn: the tall 28-inch roadster with its crossbar, or a lower city bike */
  kind: 'roadster' | 'city';
  price: number;
  colours: BikeColourId[];
  /** the 自行车行, or the recycler (second-hand, bargained) */
  shop: 'zixingche' | 'polan';
  /** the card's line, English */
  story: string;
}

export const BIKES: readonly BikeModel[] = [
  {
    id: 'yongjiu',
    brand: '永久',
    zh: '永久',
    en: 'Yongjiu 28-inch roadster',
    kind: 'roadster',
    price: 480,
    colours: ['black', 'green'],
    shop: 'zixingche',
    story: 'The tall black 「二八大杠」: 28-inch wheels and a crossbar. In the 1980s half of Beijing rode one to work.',
  },
  {
    id: 'fenghuang',
    brand: '凤凰',
    zh: '凤凰',
    en: 'Fenghuang city bike',
    kind: 'city',
    price: 420,
    colours: ['red', 'blue', 'white'],
    shop: 'zixingche',
    story: 'A lighter city bike from the other old Shanghai maker — easy to get on, good for 胡同.',
  },
  {
    id: 'feige',
    brand: '飞鸽',
    zh: '飞鸽',
    en: 'Feige city bike',
    kind: 'city',
    price: 400,
    colours: ['blue', 'green', 'black'],
    shop: 'zixingche',
    story: 'The Flying Pigeon, from Tianjin: once the most-ridden bike in the world.',
  },
  {
    id: 'jiuche',
    brand: '永久',
    zh: '旧自行车',
    en: 'second-hand Yongjiu',
    kind: 'roadster',
    price: 250,
    colours: ['black'],
    shop: 'polan',
    story: 'An old 永久 from the recycler’s tricycle: a bit rusty, rides fine.',
  },
];

export type BikePartId = 'basket' | 'lock' | 'rack';

export interface BikePart {
  id: BikePartId;
  zh: string;
  en: string;
  /** measure word: 一个车筐, 一把锁 */
  measure: string;
  price: number;
}

export const BIKE_PARTS: readonly BikePart[] = [
  { id: 'basket', zh: '车筐', en: 'basket', measure: '个', price: 30 },
  { id: 'lock', zh: '车锁', en: 'lock', measure: '把', price: 25 },
  { id: 'rack', zh: '后座', en: 'rear rack', measure: '个', price: 20 },
];

/** The three bells (a new bike comes with the first; the 修车摊 changes it): what each says. */
export const BELLS = [
  { zh: '叮', en: 'ding' },
  { zh: '叮当', en: 'ding-dong' },
  { zh: '铃铃', en: 'ring-ring' },
] as const;

export const bikeModel = (id: string) => BIKES.find((b) => b.id === id);
export const bikePart = (id: string) => BIKE_PARTS.find((p) => p.id === id);

// ---------------------------------------------------------------------------
// The save's bike (save v17)
// ---------------------------------------------------------------------------

export interface BikeState {
  model: BikeModelId;
  colour: BikeColourId;
  parts: BikePartId[];
  /** which of `BELLS` */
  bell: number;
  /** where it is: parked on a map, under you, or at your gate */
  at: { map: string; tile: Tile } | 'riding' | 'home';
  /** the game minute it was bought (the later bike wins a merge of two devices' bikes) */
  got: number;
  /** a flat tyre since this game day (L3); none when pumped up */
  flat?: number;
  /** the last game day a tyre went flat (at most once a week) */
  lastFlat?: number;
  /** locked where it stands */
  locked?: boolean;
  /** sent home by the 修车摊 master: at your gate from this game minute (the next morning) */
  arrives?: number;
}

/** Where the bike waits at home: in 帽儿胡同, by your gate. */
export const BIKE_HOME: { map: string; tile: Tile } = { map: 'hutong-home', tile: [20, 7] };

/** The bike's place now: `home` and a delivery that has arrived are the gate. */
export function bikePlace(s: Pick<WorldSave, 'bike' | 'clock'>): { map: string; tile: Tile } | 'riding' | 'coming' | null {
  const b = s.bike;
  if (!b) return null;
  if (b.arrives !== undefined && s.clock < b.arrives) return 'coming';
  if (b.at === 'home') return BIKE_HOME;
  return b.at;
}

export const isRiding = (s: Pick<WorldSave, 'bike'>) => s.bike?.at === 'riding';

/** What changes the bike: bought, a part, got on and off, locked, a flat and its mending, a new bell, sent home. */
export type BikeAction =
  | { do: 'bike'; model: string; colour: string }
  | { do: 'bike_part'; part: string }
  | { do: 'bike_fix' }
  | { do: 'bike_bell' }
  | { do: 'bike_home' }
  | { do: 'bike_on' }
  | { do: 'bike_off'; map: string; tile: Tile; lock?: boolean }
  | { do: 'bike_lock' }
  | { do: 'bike_flat' }
  /** 骑车去 (L2): the ride between districts — its minutes pass, and the diary says where you rode */
  | { do: 'bike_ride'; district: string; minutes: number };

export const BIKE_ACTIONS = new Set(['bike', 'bike_part', 'bike_fix', 'bike_bell', 'bike_home', 'bike_on', 'bike_off', 'bike_lock', 'bike_flat', 'bike_ride']);

/** 7:00 on the game day after `clock`. */
const nextMorning = (clock: number) => dayOf(clock) * 24 * 60 + 7 * 60;

export function applyBike(s: WorldSave, a: BikeAction): WorldSave {
  const b = s.bike;
  const set = (next: BikeState) => ({ ...s, bike: next });
  switch (a.do) {
    case 'bike': {
      const m = bikeModel(a.model);
      if (!m || b) return s;
      const colour = (m.colours as string[]).includes(a.colour) ? (a.colour as BikeColourId) : m.colours[0]!;
      const flags = s.flags.includes('bike-owned') ? s.flags : [...s.flags, 'bike-owned'];
      return { ...s, flags, bike: { model: m.id, colour, parts: [], bell: 0, at: { map: s.place.map, tile: s.place.tile }, got: Math.floor(s.clock) } };
    }
    case 'bike_part':
      return b && bikePart(a.part) && !b.parts.includes(a.part as BikePartId) ? set({ ...b, parts: [...b.parts, a.part as BikePartId] }) : s;
    case 'bike_fix':
      return b?.flat !== undefined ? set(withoutKey(b, 'flat')) : s;
    case 'bike_bell':
      return b ? set({ ...b, bell: (b.bell + 1) % BELLS.length }) : s;
    case 'bike_home':
      return b && b.at !== 'riding' && b.at !== 'home' ? set({ ...withoutKey(b, 'locked'), at: 'home', arrives: nextMorning(s.clock) }) : s;
    case 'bike_on':
      return b && b.at !== 'riding' ? set({ ...withoutKey(withoutKey(b, 'locked'), 'arrives'), at: 'riding' }) : s;
    case 'bike_off':
      return b && b.at === 'riding' ? set({ ...b, at: { map: a.map, tile: a.tile }, ...(a.lock && b.parts.includes('lock') ? { locked: true } : {}) }) : s;
    case 'bike_lock':
      return b && b.at !== 'riding' && !b.locked && b.parts.includes('lock') ? set({ ...b, locked: true }) : s;
    case 'bike_flat': {
      const today = dayOf(s.clock);
      return b && b.flat === undefined && canGoFlat(s) ? set({ ...b, flat: today, lastFlat: today }) : s;
    }
    case 'bike_ride':
      return b?.at === 'riding' && a.minutes > 0 ? { ...s, clock: s.clock + a.minutes } : s;
  }
}

function withoutKey<K extends keyof BikeState>(b: BikeState, k: K): BikeState {
  const { [k]: _gone, ...rest } = b;
  return rest as BikeState;
}

/** A tyre may go flat at most once in seven game days, and never on a bike with one already flat. */
export function canGoFlat(s: Pick<WorldSave, 'bike' | 'clock'>): boolean {
  const b = s.bike;
  if (!b || b.flat !== undefined) return false;
  return b.lastFlat === undefined || dayOf(s.clock) - b.lastFlat >= 7;
}

/**
 * Whether a tyre goes flat on this ride (L3): after the first week with the
 * bike, on one game day in seven (the day decides, so it is the same on every
 * device and in the tests), on the first time you get on that day.
 */
export function flatToday(s: Pick<WorldSave, 'bike' | 'clock'>): boolean {
  const b = s.bike;
  if (!b || !canGoFlat(s)) return false;
  const day = dayOf(s.clock);
  if (day - dayOf(b.got) < 3) return false;
  return (day * 37 + b.got) % 7 === 3;
}

/** Two devices' bikes as one: either device's bike; the later save's colour, parts and place (L2). */
export function mergeBike(a: WorldSave, b: WorldSave, late: WorldSave): BikeState | undefined {
  const early = late === a ? b : a;
  const x = late.bike;
  const y = early.bike;
  if (!x) return y;
  if (!y) return x;
  return { ...x, got: Math.min(x.got, y.got), ...(x.lastFlat !== undefined || y.lastFlat !== undefined ? { lastFlat: Math.max(x.lastFlat ?? 0, y.lastFlat ?? 0) } : {}) };
}

/** A save's `bike` from whatever came in (junk becomes no bike). */
export function readBike(v: unknown): BikeState | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const r = v as Record<string, unknown>;
  const m = typeof r.model === 'string' ? bikeModel(r.model) : undefined;
  if (!m) return undefined;
  const colour = typeof r.colour === 'string' && r.colour in BIKE_COLOURS ? (r.colour as BikeColourId) : m.colours[0]!;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
  const at =
    r.at === 'riding' || r.at === 'home'
      ? r.at
      : typeof r.at === 'object' && r.at !== null && typeof (r.at as Place).map === 'string' && Array.isArray((r.at as Place).tile)
        ? { map: (r.at as Place).map, tile: (r.at as Place).tile }
        : 'home';
  return {
    model: m.id,
    colour,
    parts: Array.isArray(r.parts) ? (r.parts.filter((p) => typeof p === 'string' && bikePart(p)) as BikePartId[]) : [],
    bell: Math.max(0, Math.min(BELLS.length - 1, num(r.bell) ?? 0)),
    at,
    got: num(r.got) ?? 0,
    ...(num(r.flat) !== undefined ? { flat: num(r.flat)! } : {}),
    ...(num(r.lastFlat) !== undefined ? { lastFlat: num(r.lastFlat)! } : {}),
    ...(r.locked === true ? { locked: true } : {}),
    ...(num(r.arrives) !== undefined ? { arrives: num(r.arrives)! } : {}),
  };
}

/** 「一辆红色的凤凰」 and "a red Fenghuang city bike", for the diary and the notices. */
export function bikeName(model: string, colour: string): { zh: string; en: string } {
  const m = bikeModel(model);
  const c = BIKE_COLOURS[colour as BikeColourId];
  if (!m) return { zh: '一辆自行车', en: 'a bike' };
  const col = c && m.colours.length > 1 ? `${c.zh.replace(/的$/, '')}色的` : '';
  const zh = m.id === 'jiuche' ? '一辆旧自行车' : `一辆${col}${m.zh}自行车`;
  const en = `${c && m.colours.length > 1 ? `${c.en} ` : ''}${m.en}`;
  return { zh, en: `${/^[aeiou]/i.test(en) ? 'an' : 'a'} ${en}` };
}

// ---------------------------------------------------------------------------
// The shop's talk
// ---------------------------------------------------------------------------

export interface BikeShopState {
  /** the bike looked at */
  focus?: { model: BikeModelId; colour: BikeColourId; tried?: boolean };
  /** the part looked at */
  part?: BikePartId;
  /** your bike, if you have one (as the talk began, then as bought) */
  owned?: { model: BikeModelId; parts: BikePartId[] };
}

/** The seller's lines around the names (HSK 1–2 plus the situation's words: 自行车, 辆, 骑, 车筐 …). */
export const BIKE_LINES = {
  hello: { zh: '你好！买自行车吗？看看吧。', en: 'Hello! Buying a bike? Have a look.' },
  helloOwner: { zh: '你好！你的车怎么样？', en: 'Hello! How is your bike doing?' },
  which: { zh: '你看哪辆？有永久、凤凰、飞鸽。', en: 'Which one are you looking at? There’s Yongjiu, Fenghuang and Feige.' },
  tryIt: { zh: '可以！骑一圈试试。', en: 'Sure! Take it round the block.' },
  how: { zh: '怎么样？', en: 'Well? How was it?' },
  good: { zh: '好车吧！要吗？', en: 'Good bike, isn’t it? Want it?' },
  firm: { zh: '对不起，不能便宜。', en: 'Sorry, the price is the price.' },
  thanks: { zh: '谢谢！车是你的了。要车筐吗？', en: 'Thank you! It’s yours. Want a basket for it?' },
  fitted: { zh: '好了！还要什么？', en: 'There — it’s on your bike. Anything else?' },
  have: { zh: '你已经有自行车了！要车筐、车锁吗？', en: 'You’ve got a bike already! A basket, a lock?' },
  hasPart: { zh: '你的车已经有了！', en: 'Your bike has one already!' },
  noBike: { zh: '你还没有自行车呢！买一辆吧。', en: 'You haven’t got a bike yet! Buy one first.' },
  none: { zh: '对不起，这个我们没有。', en: 'Sorry, we don’t sell that here.' },
  bye: { zh: '好，再见！骑车慢点儿！', en: 'All right — bye! Ride carefully!' },
};

export interface BikeTurn {
  zh: string;
  en: string;
  state: BikeShopState;
  /** a line before `zh` (the test ride: 「可以！骑一圈试试。」 then 「怎么样？」) */
  before?: { zh: string; en: string };
  /** the sheet shows the test ride */
  ride?: boolean;
  /** pay this now (the phone) */
  due?: { total: number; bike?: { model: BikeModelId; colour: BikeColourId }; part?: BikePartId };
  bye?: boolean;
}

const TRY = /试/;
const PRICE = /多少钱|几块|多少|什么价/;
const BUY = /我要|要这|买|就这|就要/;
const NO_BUY = /不要|不买/;
const CHEAPER = /太贵|便宜|贵了|少一点|少点/;
const LIKED = /不错|很好|好骑|喜欢|挺好|好的|^好|真好|舒服/;
const BYE = /再见|拜拜|不要了|不买了|算了|走了|没有了|就这些/;
const WANT_BIKE = /(买|要|看).*自行车|自行车/;

/** Model names as people say them, longest first: 二八大杠 and 二八 are the 永久. */
const MODEL_WORDS: Array<[string, BikeModelId]> = [
  ['二八大杠', 'yongjiu'],
  ['二八', 'yongjiu'],
  ['永久', 'yongjiu'],
  ['凤凰', 'fenghuang'],
  ['飞鸽', 'feige'],
];

const COLOUR_STEMS: Array<[string, BikeColourId]> = [
  ['黑', 'black'],
  ['绿', 'green'],
  ['红', 'red'],
  ['蓝', 'blue'],
  ['白', 'white'],
];

const shopBikes = () => BIKES.filter((b) => b.shop === 'zixingche');
const coloursZh = (m: BikeModel) => m.colours.map((c) => BIKE_COLOURS[c].zh).join('、');

/** The price line: 「凤凰四百二十块。有红的、蓝的、白的。」 */
export function bikePriceLine(m: BikeModel): { zh: string; en: string } {
  return {
    zh: `${m.zh}${priceZh(m.price)}。${m.colours.length > 1 ? `有${coloursZh(m)}。` : ''}`,
    en: `The ${m.en}: ${m.price} 元.${m.colours.length > 1 ? ` In ${m.colours.map((c) => BIKE_COLOURS[c].en).join(', ')}.` : ''}`,
  };
}

/** The shop's state as a talk begins, from the save. */
export function bikeShopStart(s?: Pick<WorldSave, 'bike'>): BikeShopState {
  return s?.bike ? { owned: { model: s.bike.model, parts: [...s.bike.parts] } } : {};
}

/** One line of yours at the bike shop (null: not shop words — the usual requests and misses take it). */
export function bikeTurn(r: BikeShopState, text: string, choice?: string): BikeTurn | null {
  const t = text.trim();
  const say = (zh: string, en: string, state: BikeShopState = r, extra: Partial<BikeTurn> = {}): BikeTurn => ({ zh, en, state, ...extra });

  // a part named (车筐, 锁, 后座) — only for a bike you have
  const partNamed = BIKE_PARTS.find((p) => t.includes(p.zh) || (p.id === 'lock' && /锁/.test(t)) || (p.id === 'basket' && /筐/.test(t))) ?? (choice ? bikePart(choice) : undefined);
  if (partNamed) {
    if (!r.owned) return say(BIKE_LINES.noBike.zh, BIKE_LINES.noBike.en);
    if (r.owned.parts.includes(partNamed.id)) return say(BIKE_LINES.hasPart.zh, BIKE_LINES.hasPart.en);
    const next: BikeShopState = { ...r, part: partNamed.id };
    if (BUY.test(t) && !NO_BUY.test(t)) return say('', '', next, { due: { total: partNamed.price, part: partNamed.id } });
    return say(`${partNamed.zh}${priceZh(partNamed.price)}。`, `A ${partNamed.en}: ${partNamed.price} 元.`, next);
  }

  // a bike picked on the sheet (`model` or `model:colour`) or named
  let next = r;
  let picked = false;
  const pick = (m: BikeModel, colour?: BikeColourId) => {
    const same = r.focus?.model === m.id;
    next = { ...next, focus: { model: m.id, colour: colour && m.colours.includes(colour) ? colour : same ? r.focus!.colour : m.colours[0]!, ...(same && r.focus?.tried ? { tried: true } : {}) } };
    delete next.part;
    picked = true;
  };
  if (choice && !bikePart(choice)) {
    const [id, col] = choice.split(':');
    const m = bikeModel(id ?? '');
    if (m && m.shop === 'zixingche') pick(m, col as BikeColourId | undefined);
  }
  const said = MODEL_WORDS.find(([w]) => t.includes(w));
  if (said) pick(bikeModel(said[1])!);
  const focus = next.focus && bikeModel(next.focus.model);

  // you have a bike already: the shop sells you parts
  if (r.owned && (picked || (BUY.test(t) && WANT_BIKE.test(t)))) return say(BIKE_LINES.have.zh, BIKE_LINES.have.en, { ...r });

  // a colour
  const stem = COLOUR_STEMS.find(([w]) => new RegExp(`${w}(的|色)`).test(t));
  if (stem) {
    if (!focus) return say(BIKE_LINES.which.zh, BIKE_LINES.which.en, next);
    if (focus.colours.includes(stem[1])) {
      next = { ...next, focus: { ...next.focus!, colour: stem[1] } };
      if (!(BUY.test(t) && !NO_BUY.test(t)) && !TRY.test(t)) return say(`有！${BIKE_COLOURS[stem[1]].zh}。`, `Yes! In ${BIKE_COLOURS[stem[1]].en}.`, next);
    } else {
      return say(`没有${stem[0]}的，有${coloursZh(focus)}。`, `Not in ${BIKE_COLOURS[stem[1]].en} — ${focus.colours.map((c) => BIKE_COLOURS[c].en).join(', ')}.`, next);
    }
  }

  // a test ride
  if (TRY.test(t) || /骑一骑|骑骑/.test(t)) {
    if (!focus) return say(BIKE_LINES.which.zh, BIKE_LINES.which.en, next);
    return say(BIKE_LINES.how.zh, BIKE_LINES.how.en, { ...next, focus: { ...next.focus!, tried: true } }, { before: BIKE_LINES.tryIt, ride: true });
  }

  if (CHEAPER.test(t)) return say(BIKE_LINES.firm.zh, BIKE_LINES.firm.en, next);

  if (PRICE.test(t)) {
    if (!focus) return say(BIKE_LINES.which.zh, BIKE_LINES.which.en, next);
    const l = bikePriceLine(focus);
    return say(l.zh, l.en, next);
  }

  if (BUY.test(t) && !NO_BUY.test(t) && (focus || !WANT_BIKE.test(t))) {
    if (!focus) return say(BIKE_LINES.which.zh, BIKE_LINES.which.en, next);
    return say('', '', next, { due: { total: focus.price, bike: { model: focus.id, colour: next.focus!.colour } } });
  }

  if (BYE.test(t)) return say(BIKE_LINES.bye.zh, BIKE_LINES.bye.en, next, { bye: true });

  // 「我想买自行车」: the three on the stand
  if (!picked && WANT_BIKE.test(t)) return say(r.owned ? BIKE_LINES.have.zh : BIKE_LINES.which.zh, r.owned ? BIKE_LINES.have.en : BIKE_LINES.which.en, next);

  // after the test ride: 「很好！」
  if (focus && next.focus?.tried && LIKED.test(t) && !/不/.test(t.replace(/不错/, ''))) return say(BIKE_LINES.good.zh, BIKE_LINES.good.en, next);

  if (picked && focus) {
    const l = bikePriceLine(focus);
    return say(l.zh, l.en, next);
  }
  return null;
}

/** What a patient player says at the shop (💡 and the solver): look, ride, buy — then a basket. */
export function bikeHint(r: BikeShopState): { word: string; frame: string; full: string } {
  if (r.owned) {
    const part = BIKE_PARTS.find((p) => !r.owned!.parts.includes(p.id));
    if (!part) return { word: '再见', frame: '___！', full: '再见！' };
    return { word: part.zh, frame: `我要一${part.measure}___。`, full: `我要一${part.measure}${part.zh}。` };
  }
  if (!r.focus) {
    const first = shopBikes()[0]!;
    return { word: first.zh, frame: '这辆___多少钱？', full: `这辆${first.zh}多少钱？` };
  }
  if (!r.focus.tried) return { word: '试试', frame: '我可以___吗？', full: '我可以试试吗？' };
  return { word: '要', frame: '我___这辆。', full: '我要这辆。' };
}

/** Readings the word list gets wrong here, cut and read as whole words. */
export const BIKE_WORDS: Record<string, string> = {
  二八大杠: 'èrbā dàgàng',
  车筐: 'chēkuāng',
  车锁: 'chēsuǒ',
  车铃: 'chēlíng',
  后座: 'hòuzuò',
  打气: 'dǎqì',
  补胎: 'bǔtāi',
  修车摊: 'xiūchētān',
  自行车行: 'zìxíngchēháng',
};

/**
 * The diary's codes for the bike (§13 L3): 「我买了一辆红色的凤凰自行车。」 when
 * one is bought (the clothes' `u` code, which carries its own words), and
 * 「我的自行车车胎没气了，师傅帮我补好了。」 when a flat is mended.
 */
export function bikeEvents(before: WorldSave, after: WorldSave, a: { do: string }): string[] {
  if (a.do === 'bike' && !before.bike && after.bike) {
    const n = bikeName(after.bike.model, after.bike.colour);
    return [`u:${n.zh}:${n.en}`];
  }
  if (a.do === 'bike_fix' && before.bike?.flat !== undefined && after.bike?.flat === undefined) return ['a'];
  if (a.do === 'bike_ride' && after.clock !== before.clock) return [`y:${(a as unknown as { district: string }).district}`];
  return [];
}

// ---------------------------------------------------------------------------
// Where you may ride (§13 L2) — real rules, taught by signs
// ---------------------------------------------------------------------------

/**
 * Maps you may not ride into: parks, the palace and temples (their visitor
 * rules — you leave the bike at the gate, facts `parks-no-bikes`), and
 * 天安门广场 (no bikes on the square). Stations are never ridden into
 * (`metro-no-bikes`), and nobody rides indoors.
 */
export const NO_RIDE_MAPS: ReadonlySet<string> = new Set([
  'tiananmen-square', 'wumen', 'taihedian', 'qianqinggong', 'yuhuayuan', 'jiulongbi',
  'jingshan-park', 'jingshan-view', 'beihai-baita', 'gongwangfu',
  'tiantan-park', 'qiniandian', 'huanqiu', 'huiyinbi',
  'yonghegong-front', 'yonghegong-wanfuge', 'kongmiao', 'ditan',
  'baiyunguan', 'dongyuemiao', 'yiheyuan-changlang', 'changcheng', 'olympic-park',
]);

export type NoRide = 'station' | 'park' | 'indoors';

/** Why you cannot ride on a map (null: you can): a station, a park or temple gate, or a room. */
export function noRide(map: string, outdoors: boolean): NoRide | null {
  if (map.startsWith('station-') || map.startsWith('stop-')) return 'station';
  if (NO_RIDE_MAPS.has(map)) return 'park';
  return outdoors ? null : 'indoors';
}

/** The sign you read when the bike must stay outside (tappable, like any sign). */
export const NO_RIDE_SIGNS: Record<Exclude<NoRide, 'indoors'>, { text: string; en: string }> = {
  station: { text: '自行车不能进站', en: 'No bicycles in the station — your bike waits at the exit.' },
  park: { text: '禁止骑车 请推行', en: 'No cycling — please walk your bike. It waits at the gate.' },
};

// ---------------------------------------------------------------------------
// Riding between districts (§13 L2): 骑车去
// ---------------------------------------------------------------------------

export interface RidePlace {
  district: string;
  /** hanzi, as a rider says it: 骑车去后海 */
  zh: string;
  en: string;
  /** roughly where the arrival street is: [latitude, longitude] (OpenStreetMap, rounded) */
  at: readonly [number, number];
  /** where you arrive with your bike: the district's main street */
  arrive: { map: string; tile: Tile; facing: 'up' | 'down' | 'left' | 'right' };
  /** what you pass as you ride in: a picture (props atlas) and its name */
  sight: { pic: string; zh: string; en: string };
}

/** The districts a bike goes between. Far ones (颐和园, 奥林匹克公园, 长城) and ones with no street to arrive on (天坛, 天安门) are not here. */
export const RIDE_PLACES: readonly RidePlace[] = [
  { district: 'gulou', zh: '鼓楼', en: 'the Drum Tower', at: [39.9405, 116.3985], arrive: { map: 'gulou-dongdajie', tile: [18, 7], facing: 'right' }, sight: { pic: 'tower/drum', zh: '鼓楼', en: 'the Drum Tower' } },
  { district: 'houhai', zh: '后海', en: 'Houhai', at: [39.9395, 116.3874], arrive: { map: 'houhai-lake', tile: [22, 20], facing: 'down' }, sight: { pic: 'willow/green', zh: '后海', en: 'the lake at Houhai' } },
  { district: 'jingshan', zh: '北海', en: 'Beihai', at: [39.9285, 116.3860], arrive: { map: 'beihai-north', tile: [26, 14], facing: 'down' }, sight: { pic: 'pagoda/white', zh: '白塔', en: 'the White Dagoba' } },
  { district: 'yonghegong', zh: '雍和宫', en: 'the Lama Temple', at: [39.9475, 116.4135], arrive: { map: 'yonghegong-street', tile: [44, 16], facing: 'left' }, sight: { pic: 'archway/green', zh: '国子监街', en: 'the archways of 国子监街' } },
  { district: 'wangfujing', zh: '王府井', en: 'Wangfujing', at: [39.9115, 116.4100], arrive: { map: 'wangfujing-street', tile: [11, 52], facing: 'up' }, sight: { pic: 'lantern/lit-0', zh: '王府井', en: 'the lanterns of Wangfujing' } },
  { district: 'qianmen', zh: '前门', en: 'Qianmen', at: [39.8965, 116.3975], arrive: { map: 'qianmen-street', tile: [11, 4], facing: 'down' }, sight: { pic: 'tower/arrow', zh: '前门', en: 'the Arrow Tower of Qianmen' } },
  { district: 'sanlitun', zh: '三里屯', en: 'Sanlitun', at: [39.9335, 116.4545], arrive: { map: 'sanlitun-street', tile: [40, 12], facing: 'left' }, sight: { pic: 'plant/green', zh: '三里屯', en: 'the glass shops of Sanlitun' } },
  { district: 'panjiayuan', zh: '潘家园', en: 'Panjiayuan', at: [39.8745, 116.4580], arrive: { map: 'panjiayuan-market', tile: [40, 16], facing: 'left' }, sight: { pic: 'stall/a', zh: '潘家园', en: 'the flea market' } },
];

/** The farthest a ride goes: the brief's "about 6 km" — a 25-minute ride. */
export const RIDE_KM = 6;
/** an easy Beijing pace */
export const RIDE_KMH = 15;

/** Straight-line kilometres between two places (a street route is a little longer: ×1.25). */
export function rideKm(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = (a[0] - b[0]) * 111.2;
  const dLon = (a[1] - b[1]) * 111.2 * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  return Math.round(Math.hypot(dLat, dLon) * 1.25 * 10) / 10;
}

export const ridePlace = (district: string) => RIDE_PLACES.find((p) => p.district === district);

/** Where you can ride to from a district, nearest first: the districts the story has opened, within `RIDE_KM`. */
export function rideOptions(s: Pick<WorldSave, 'district' | 'chapter'>, chapterOf: (district: string) => number): Array<{ to: RidePlace; km: number; minutes: number }> {
  const from = ridePlace(s.district);
  if (!from) return [];
  return RIDE_PLACES.filter((p) => p.district !== from.district && chapterOf(p.district) <= s.chapter)
    .map((to) => {
      const km = rideKm(from.at, to.at);
      return { to, km, minutes: Math.max(5, Math.round((km / RIDE_KMH) * 60)) };
    })
    .filter((o) => o.km <= RIDE_KM)
    .sort((a, b) => a.km - b.km);
}

/** 长安街 runs east–west at about this latitude: a ride from one side to the other crosses it, by 天安门. */
const CHANGANJIE = 39.906;

/** What you pass on a ride, in order: where you set off, 长安街 if you cross it, what you ride up to. */
export function rideSights(from: RidePlace, to: RidePlace): Array<{ pic: string; zh: string; en: string }> {
  const out = [from.sight];
  if ((from.at[0] - CHANGANJIE) * (to.at[0] - CHANGANJIE) < 0) out.push({ pic: 'corner-tower/jiaolou', zh: '长安街', en: '长安街 — the wide bike lanes past 天安门' });
  if ((from.district === 'houhai') !== (to.district === 'houhai') && [from.district, to.district].some((d) => d === 'gulou' || d === 'jingshan')) out.push({ pic: 'boat/red', zh: '什刹海', en: 'along the lakes of 什刹海' });
  out.push(to.sight);
  return out;
}

/** How long the ride's picture plays, in ms: 6–15 s by distance. */
export const rideMs = (km: number) => Math.round(Math.min(15, Math.max(6, 5 + km * 2)) * 1000);

/** The phone call to the 修车摊 master to bring the bike home (L2): said in Chinese, 10 元, it is home next morning. */
export function callScene(whereZh: string): import('./types').Scene {
  return {
    id: 'bike-call',
    map: '',
    npc: 'xiuche-shifu',
    trigger: 'talk',
    start: 'a',
    words: [
      { w: '送', explain: '把东西拿给别人。', en: 'to deliver, to bring' },
      { w: '车', explain: '自行车。', en: 'bike' },
    ],
    nodes: [
      {
        id: 'a',
        say: '喂？我是修车的。你有什么事？',
        translate: 'Hello? The bike repairman here. What can I do for you?',
        expect: [
          { intent: 'bring', match: [['送', '回来', '拿', '家']], go: 'b' },
          { intent: 'no', match: [['没事', '不用', '再见']], go: 'bye' },
        ],
        hint: { word: '送', frame: `我的车在${whereZh}，可以帮我___回来吗？`, full: `我的车在${whereZh}，可以帮我送回来吗？` },
        why: `Your bike is at ${whereZh}. Ask him to bring it home: 「我的车在${whereZh}，可以帮我送回来吗？」 — 10 元, and it is at your gate in 帽儿胡同 tomorrow morning.`,
      },
      { id: 'b', say: '好！十块钱。明天早上，车在你家门口。', translate: 'Fine! Ten kuai. Tomorrow morning the bike will be at your gate.', onEnter: [{ do: 'money', amount: -10 }, { do: 'bike_home' }] },
      { id: 'bye', say: '好，再见！', translate: 'All right, bye!' },
    ],
  };
}
