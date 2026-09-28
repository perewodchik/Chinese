import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 蜜雪冰城 — bubble tea, as data.
 *
 * The sheet is Mixue's: 杯型 (中杯 / 大杯 +¥2 where a drink comes in two
 * sizes), 冰量 (正常冰 · 少冰 · 去冰 · 常温 · 热饮 — one group, all required),
 * 糖度 (正常糖 · 少糖 · 半糖 · 微糖 · 无糖) and 加料, a many-of group whose
 * prices go into the line. Each different set of choices is its own cart
 * line. Coupons are chosen by hand here — the app does not pick one.
 */

const tea = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'desc' | 'photo'>): MenuItem => ({
  groups: ['size', 'ice', 'sugar', 'top'],
  unit: '杯',
  ...o,
});
const COLD = ['normal', 'less', 'none', 'room'];

const items: MenuItem[] = [
  tea({ id: 'lemonade', zh: '冰鲜柠檬水', call: '柠檬水', cats: ['top', 'fruit'], price: 4, desc: '一整颗柠檬', photo: 'lemonade', tags: ['爆款'], only: { ice: COLD }, groups: ['size', 'ice', 'sugar'], sold: 9000 }),
  tea({ id: 'pearl-milk-tea', zh: '珍珠奶茶', cats: ['top', 'milk'], price: 7, desc: '经典珍珠奶茶', photo: 'bubble-tea', hsk: ['奶茶'], sold: 8000 }),
  tea({ id: 'coco-milk-tea', zh: '椰果奶茶', cats: ['milk'], price: 7, desc: '奶茶加椰果', photo: 'coconut-jelly-tea', hsk: ['奶茶'], sold: 3000 }),
  tea({ id: 'pudding-milk-tea', zh: '布丁奶茶', cats: ['milk'], price: 7, desc: '奶茶加布丁', photo: 'pudding-milk-tea', hsk: ['奶茶'], sold: 2000 }),
  tea({ id: 'three-brothers', zh: '奶茶三兄弟', cats: ['milk'], price: 8, desc: '珍珠、椰果和布丁', photo: 'boba-cup', hsk: ['奶茶'], sold: 2500 }),
  tea({ id: 'taro-milk-tea', zh: '芋圆奶茶', cats: ['milk'], price: 8, desc: '奶茶加芋圆', photo: 'taro-milk-tea', hsk: ['奶茶'], sold: 1500 }),
  tea({ id: 'plain-milk-tea', zh: '原味奶茶', cats: ['milk'], price: 6, desc: '什么都不加的奶茶', photo: 'milk-tea', hsk: ['奶茶'], sold: 1200 }),
  tea({ id: 'spring-pearl', zh: '四季春珍珠奶茶', cats: ['new', 'milk'], price: 8, desc: '四季春茶做的奶茶', photo: 'pearl-tea', hsk: ['奶茶'], tags: ['新品'], sold: 900 }),
  tea({ id: 'passion', zh: '满杯百香果', call: '百香果', cats: ['top', 'fruit'], price: 7, desc: '满满一杯百香果', photo: 'fruit-tea', only: { ice: COLD }, groups: ['size', 'ice', 'sugar', 'top'], sold: 6000 }),
  tea({ id: 'orange', zh: '棒打鲜橙', cats: ['fruit'], price: 6, desc: '新鲜橙子', photo: 'orange-juice', only: { ice: COLD }, groups: ['size', 'ice', 'sugar'], sold: 2000 }),
  tea({ id: 'double-passion', zh: '百香果双响炮', cats: ['new', 'fruit'], price: 8, desc: '百香果加珍珠和椰果', photo: 'passion-juice', only: { ice: COLD }, tags: ['新品'], sold: 1500 }),
  tea({ id: 'mango-sago', zh: '杨枝甘露', cats: ['new', 'fruit'], price: 8, desc: '芒果、西柚和西米', photo: 'mango-sago', only: { ice: COLD }, groups: ['ice', 'sugar'], sold: 1800 }),
  tea({ id: 'peach-tea', zh: '蜜桃四季春', cats: ['top', 'tea'], price: 7, desc: '蜜桃和四季春茶', photo: 'peach-tea', only: { ice: COLD }, groups: ['size', 'ice', 'sugar', 'top'], hsk: ['茶'], sold: 5000 }),
  tea({ id: 'jasmine-green', zh: '茉莉绿茶', cats: ['tea'], price: 5, desc: '清香的绿茶', photo: 'green-tea', hsk: ['绿茶', '茶'], sold: 900 }),
  tea({ id: 'lemon-black', zh: '柠檬红茶', cats: ['tea'], price: 5, desc: '柠檬和红茶', photo: 'lemon-tea', hsk: ['红茶', '茶'], sold: 1100 }),
  tea({ id: 'spring-tea', zh: '四季春茶', cats: ['tea'], price: 5, desc: '清爽的乌龙茶', photo: 'oolong', hsk: ['茶'], sold: 700 }),
  { id: 'cone', zh: '新鲜冰淇淋', cats: ['top', 'icecream'], price: 2, desc: '两块钱的冰淇淋', photo: 'soft-serve', groups: [], unit: '个', sold: 9900 },
  { id: 'crispy-cone', zh: '摩天脆脆', cats: ['icecream'], price: 5, desc: '高高的冰淇淋脆筒', photo: 'ice-cream-cone', groups: [], unit: '个', sold: 2000 },
  { id: 'sundae', zh: '雪王大圣代', cats: ['icecream'], price: 6, desc: '冰淇淋加果酱', photo: 'sundae', groups: [], unit: '个', sold: 3000 },
  { id: 'strawberry-shake', zh: '草莓摇摇奶昔', cats: ['shake'], price: 8, desc: '草莓冰淇淋奶昔', photo: 'milkshake', groups: ['ice'], only: { ice: ['normal', 'less'] }, unit: '杯', sold: 1300 },
  { id: 'mango-shake', zh: '芒果摇摇奶昔', cats: ['shake'], price: 8, desc: '芒果冰淇淋奶昔', photo: 'mango-smoothie', groups: ['ice'], only: { ice: ['normal', 'less'] }, unit: '杯', sold: 900 },
];

/* ------------------------------------------------------------- templates */

const ICE_SAY: Record<string, [string, string]> = {
  normal: ['正常冰', 'normal ice'],
  less: ['少冰', 'less ice'],
  none: ['去冰', 'no ice'],
  room: ['常温', 'room temperature'],
  hot: ['热的', 'hot'],
};
const SUGAR_SAY: Record<string, [string, string]> = {
  normal: ['正常糖', 'normal sugar'],
  less: ['少糖', 'less sugar'],
  half: ['半糖', 'half sugar'],
  light: ['微糖', 'a little sugar'],
  none: ['无糖', 'no sugar'],
};
const DINE_SAY: [string, string, string][] = [
  ['打包', '打包', 'to take away'],
  ['带走', '打包', 'to take away'],
  ['在店里喝', '堂食', "we'll drink them here"],
];

const drinks = (b: Brand) => b.items.filter((i) => i.groups.includes('sugar'));
const withTop = (b: Brand) => b.items.filter((i) => i.groups.includes('top'));
const milkTeas = (b: Brand) => b.items.filter((i) => i.cats.includes('milk'));
const fruitTeas = (b: Brand) => b.items.filter((i) => i.cats.includes('fruit') && i.groups.includes('sugar'));
const cones = (b: Brand) => b.items.filter((i) => i.cats.includes('icecream'));
const call = (i: MenuItem) => i.call ?? i.zh;
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;
const ices = (b: Brand, i: MenuItem) => (i.only?.ice ?? b.groups.ice.options.map((o) => o.id)).filter((o) => o !== 'normal');

/** 去冰 / 少冰 / 常温 / 热的 — never the default 正常冰, so there is something to choose. */
const iceOf = (p: TemplatePick, i: MenuItem) => {
  const id = p.pick(ices(p.brand, i));
  return { id, zh: ICE_SAY[id][0], en: ICE_SAY[id][1] };
};
const sugarOf = (p: TemplatePick) => {
  const id = p.pick(['less', 'half', 'light', 'none']);
  return { id, zh: SUGAR_SAY[id][0], en: SUGAR_SAY[id][1] };
};
const topOf = (p: TemplatePick, n = 1) =>
  p.sample(p.brand.groups.top.options, n).map((o) => ({ id: o.id, zh: o.zh, en: enOf(p.brand, o.zh) }));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const templates: TaskTemplate[] = [
  {
    id: 'one-ice',
    level: 1,
    build: (p) => {
      const i = p.pick(drinks(p.brand));
      const ice = iceOf(p, i);
      return {
        message: `帮我买一杯${call(i)}，${ice.zh}。`,
        en: `Buy me a ${enOf(p.brand, call(i))}, ${ice.en}.`,
        parts: [call(i), ice.zh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { ice: ice.id } }] as Want[],
      };
    },
  },
  {
    id: 'one-sugar',
    level: 1,
    build: (p) => {
      const i = p.pick(drinks(p.brand));
      const s = sugarOf(p);
      return {
        message: `我要一杯${call(i)}，${s.zh}。`,
        en: `I want a ${enOf(p.brand, call(i))}, ${s.en}.`,
        parts: [call(i), s.zh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { sugar: s.id } }] as Want[],
      };
    },
  },
  {
    id: 'one-cone',
    level: 1,
    build: (p) => {
      const i = p.pick(cones(p.brand));
      const n = p.pick([1, 2]);
      return {
        message: `帮我买${n === 1 ? '一个' : '两个'}${call(i)}。`,
        en: `Buy me ${n === 1 ? 'a' : 'two'} ${enOf(p.brand, call(i))}${n === 1 ? '' : 's'}.`,
        parts: [n === 1 ? '一个' : '两个', call(i)],
        wants: [{ kind: 'line', item: i.id, qty: n, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'ice-sugar-dine',
    level: 2,
    build: (p) => {
      const i = p.pick(drinks(p.brand));
      const ice = iceOf(p, i);
      const s = sugarOf(p);
      const [say, dine, dineEn] = p.pick(DINE_SAY.slice(0, 2));
      return {
        message: `帮我买一杯${call(i)}，${ice.zh}，${s.zh}，${say}。`,
        en: `Buy me a ${enOf(p.brand, call(i))}, ${ice.en}, ${s.en}, ${dineEn}.`,
        parts: [call(i), ice.zh, s.zh, say],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { ice: ice.id, sugar: s.id } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'topping',
    level: 2,
    build: (p) => {
      const i = p.pick(withTop(p.brand));
      const [t] = topOf(p);
      const s = sugarOf(p);
      return {
        message: `我要一杯${call(i)}，加${t.zh}，${s.zh}。`,
        en: `I want a ${enOf(p.brand, call(i))} with ${t.en} added, ${s.en}.`,
        parts: [call(i), `加${t.zh}`, s.zh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { top: [t.id], sugar: s.id } }] as Want[],
      };
    },
  },
  {
    id: 'big-cup',
    level: 2,
    build: (p) => {
      const i = p.pick(drinks(p.brand).filter((x) => x.groups.includes('size')));
      const ice = iceOf(p, i);
      return {
        message: `帮我买一杯大杯的${call(i)}，${ice.zh}。`,
        en: `Buy me a large ${enOf(p.brand, call(i))}, ${ice.en}.`,
        parts: ['大杯', call(i), ice.zh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { size: 'big', ice: ice.id } }] as Want[],
      };
    },
  },
  {
    id: 'coupon',
    level: 2,
    extra: true,
    build: (p) => {
      const i = p.pick(drinks(p.brand).filter((x) => x.price >= 8));
      return {
        message: `帮我买两杯${call(i)}，记得用优惠券。`,
        en: `Buy me two ${enOf(p.brand, call(i))}s — remember to use a coupon.`,
        parts: ['两杯', call(i), '优惠券'],
        wants: [
          { kind: 'line', item: i.id, qty: 2, choices: {} },
          { kind: 'coupon' },
        ] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: () => ({
      message: '我只有10块，帮我买两杯最便宜的饮品。',
      en: 'I only have ¥10 — buy me two of the cheapest drinks.',
      parts: ['我只有', '10块', '两杯', '最便宜', '饮品'],
      wants: [
        { kind: 'line', item: 'lemonade', qty: 2, choices: {} },
        { kind: 'budget', max: 10 },
      ] as Want[],
    }),
  },
  {
    id: 'two-specs',
    level: 3,
    build: (p) => {
      const i = p.pick(milkTeas(p.brand));
      return {
        message: `两杯${call(i)}：一杯去冰半糖加珍珠，一杯热的无糖。`,
        en: `Two ${enOf(p.brand, call(i))}s: one with no ice, half sugar and pearls; one hot with no sugar.`,
        parts: ['两杯', call(i), '去冰', '半糖', '加珍珠', '热的', '无糖'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { ice: 'none', sugar: 'half', top: ['pearl'] } },
          { kind: 'line', item: i.id, qty: 1, choices: { ice: 'hot', sugar: 'none', top: [] } },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-tops',
    level: 3,
    build: (p) => {
      const i = p.pick(withTop(p.brand));
      const [a, b] = topOf(p, 2);
      const ice = iceOf(p, i);
      const s = sugarOf(p);
      return {
        message: `帮我买一杯${call(i)}，加${a.zh}和${b.zh}，${s.zh}，${ice.zh}。`,
        en: `Buy me a ${enOf(p.brand, call(i))} with ${a.en} and ${b.en}, ${s.en}, ${ice.en}.`,
        parts: [call(i), `加${a.zh}`, b.zh, s.zh, ice.zh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { top: [a.id, b.id], sugar: s.id, ice: ice.id } }] as Want[],
      };
    },
  },
  {
    id: 'three-things',
    level: 3,
    build: (p) => {
      const f = p.pick(fruitTeas(p.brand));
      const m = p.pick(milkTeas(p.brand));
      const c = p.pick(cones(p.brand));
      const ice = iceOf(p, f);
      const [t] = topOf(p);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `一杯${call(f)}，${ice.zh}；一杯${call(m)}，加${t.zh}；再要一个${call(c)}。${say}。`,
        en: `One ${enOf(p.brand, call(f))}, ${ice.en}; one ${enOf(p.brand, call(m))} with ${t.en}; and a ${enOf(p.brand, call(c))}. ${cap(dineEn)}.`,
        parts: [call(f), ice.zh, call(m), `加${t.zh}`, call(c), say],
        wants: [
          { kind: 'line', item: f.id, qty: 1, choices: { ice: ice.id } },
          { kind: 'line', item: m.id, qty: 1, choices: { top: [t.id] } },
          { kind: 'line', item: c.id, qty: 1, choices: {} },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'separate-bags',
    level: 3,
    build: (p) => {
      const i = p.pick(fruitTeas(p.brand));
      const ice = iceOf(p, i);
      const s = sugarOf(p);
      return {
        message: `帮我买三杯${call(i)}，${ice.zh}，${s.zh}，要分开装。`,
        en: `Buy me three ${enOf(p.brand, call(i))}s, ${ice.en}, ${s.en}, packed separately.`,
        parts: ['三杯', call(i), ice.zh, s.zh, '分开装'],
        wants: [
          { kind: 'line', item: i.id, qty: 3, choices: { ice: ice.id, sugar: s.id } },
          { kind: 'note', value: '分开装' },
        ] as Want[],
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

export const mixue: Brand = {
  id: 'mixue',
  model: 'chain',
  name: '蜜雪冰城',
  latin: 'MIXUE',
  merchant: '蜜雪冰城',
  pitch: 'Order bubble tea the Mixue way: 冰量, 糖度 and 加料 for every cup, each cup its own line in the cart.',
  colours: { brand: '#e2231a', soft: '#fde8e6', ink: '#ffffff', darkBrand: '#ff7a70', darkSoft: '#3a1d1b' },
  store: { zh: '北京西单店', distance: '120m' },
  categories: [
    { id: 'top', zh: '人气推荐' },
    { id: 'new', zh: '当季新品' },
    { id: 'milk', zh: '醇香奶茶' },
    { id: 'fruit', zh: '真鲜果茶' },
    { id: 'tea', zh: '清爽纯茶' },
    { id: 'icecream', zh: '冰淇淋' },
    { id: 'shake', zh: '奶昔' },
  ],
  items,
  groups: {
    size: {
      id: 'size',
      zh: '杯型',
      kind: 'one',
      required: true,
      default: 'mid',
      options: [
        { id: 'mid', zh: '中杯' },
        { id: 'big', zh: '大杯', delta: 2 },
      ],
    },
    ice: {
      id: 'ice',
      zh: '冰量',
      kind: 'one',
      required: true,
      options: [
        { id: 'normal', zh: '正常冰' },
        { id: 'less', zh: '少冰' },
        { id: 'none', zh: '去冰' },
        { id: 'room', zh: '常温' },
        { id: 'hot', zh: '热饮' },
      ],
    },
    sugar: {
      id: 'sugar',
      zh: '糖度',
      kind: 'one',
      required: true,
      default: 'normal',
      options: [
        { id: 'normal', zh: '正常糖' },
        { id: 'less', zh: '少糖', sub: '七分' },
        { id: 'half', zh: '半糖', sub: '五分' },
        { id: 'light', zh: '微糖', sub: '三分' },
        { id: 'none', zh: '无糖' },
      ],
    },
    top: {
      id: 'top',
      zh: '加料',
      kind: 'many',
      required: false,
      options: [
        { id: 'pearl', zh: '珍珠', delta: 1 },
        { id: 'coco', zh: '椰果', delta: 1 },
        { id: 'pudding', zh: '布丁', delta: 1 },
        { id: 'grass', zh: '仙草', delta: 1 },
        { id: 'oat', zh: '燕麦', delta: 1 },
        { id: 'bean', zh: '红豆', delta: 1 },
        { id: 'brown-pearl', zh: '黑糖珍珠', delta: 2 },
        { id: 'taro', zh: '芋圆', delta: 2 },
        { id: 'jelly', zh: '寒天', delta: 2 },
        { id: 'sago', zh: '西米', delta: 2 },
      ],
    },
  },
  rules: [],
  coupons: [
    { id: 'off15', zh: '满15减2', sub: '满15元可用', kind: 'off', min: 15, value: 2 },
    { id: 'off25', zh: '满25减4', sub: '满25元可用', kind: 'off', min: 25, value: 4 },
    { id: 'off40', zh: '满40减6', sub: '满40元可用', kind: 'off', min: 40, value: 6 },
  ],
  fees: [],
  notes: ['分开装', '不要吸管', '多给一个袋子'],
  dine: ['堂食', '打包'],
  code: { zh: '取餐码' },
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'home', zh: '首页', en: 'home' },
    { id: 'menu', zh: '点单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'options' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认订单', en: 'checkout' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '取餐码', en: 'pickup' },
  ],
  tips: {
    chat: 'Bubble-tea orders come as 冰量 and 糖度: 去冰半糖 is "no ice, half sugar".',
    home: '到店取 — order now and pick it up at the counter.',
    menu: 'Most drinks here are ¥4–8. 加料 (toppings) cost ¥1–2 more each.',
    spec: '冰量 and 糖度 must both be chosen. 热饮 is the hot version; fruit teas are cold only. Tap a 加料 again to take it off.',
    cart: 'Every cup with different choices is its own line: 去冰半糖 and 热饮无糖 are two lines.',
    checkout: 'Coupons are not picked for you here: open 优惠券 and choose one. 打包 is take away.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'Listen for the 取餐码, or watch the screen above the counter.',
  },
  tour: [
    { target: 'store', zh: '取餐门店', en: 'The shop you collect from.' },
    { target: 'rail', zh: '菜单', en: 'Kinds of drink: milk tea, fruit tea, plain tea, ice cream.' },
    { target: 'add', zh: '选规格', en: '选规格 opens 杯型, 冰量, 糖度 and 加料.' },
    { target: 'cart-bar', zh: '购物车', en: 'The cart and the total.' },
    { target: 'checkout-btn', zh: '去结算', en: 'Check out when everything is in.' },
  ],
  words: [
    { en: 'Drinks', words: ['奶茶', '珍珠奶茶', '柠檬水', '百香果', '果茶', '绿茶', '红茶', '冰淇淋', '奶昔'] },
    { en: 'Ice and sugar', words: ['冰量', '正常冰', '少冰', '去冰', '常温', '热饮', '糖度', '正常糖', '少糖', '半糖', '微糖', '无糖'] },
    { en: 'Add-ons and size', words: ['加料', '珍珠', '椰果', '布丁', '仙草', '红豆', '芋圆', '西米', '杯型', '中杯', '大杯'] },
    { en: 'Checkout', words: ['去结算', '堂食', '打包', '优惠券', '备注', '分开装', '去支付', '取餐码'] },
  ],
  templates,
  photos: {
    'mango-smoothie': {},
    'ice-cream-cone': {},
    'oolong': {},
    'peach-tea': {},
    'passion-juice': {},
    'pearl-tea': {},
    'milk-tea': {},
    'taro-milk-tea': {},
    'boba-cup': {},
    'pudding-milk-tea': {},
    'coconut-jelly-tea': {},
    lemonade: {},
    'bubble-tea': { word: '奶茶' },
    'fruit-tea': {},
    'orange-juice': {},
    'mango-sago': {},
    'green-tea': { word: '绿茶' },
    'lemon-tea': { word: '红茶' },
    'soft-serve': {},
    sundae: {},
    milkshake: {},
    'mixue-banner': { word: '奶茶' },
  },
  banner: { photo: 'mixue-banner', zh: '你爱我我爱你', sub: '蜜雪冰城甜蜜蜜' },
  friend: '小美',
  glossary: {
    蜜雪冰城: { py: 'Mìxuě Bīngchéng', en: 'Mixue (a bubble-tea chain)' },
    小美: { py: 'Xiǎo Měi', en: 'Xiao Mei (your friend)' },
    北京西单店: { py: 'Běijīng Xīdān diàn', en: 'the Xidan store, Beijing', hsk: ['北京'] },
    你爱我我爱你: { py: 'nǐ ài wǒ wǒ ài nǐ', en: 'you love me, I love you', note: 'the first line of Mixue’s famous jingle', hsk: ['你', '爱', '我'] },
    蜜雪冰城甜蜜蜜: { py: 'Mìxuě Bīngchéng tián mìmì', en: 'Mixue is sweet as honey', note: 'the jingle’s second line' },
    // categories and tags
    人气推荐: { py: 'rénqì tuījiàn', en: 'popular picks' },
    当季新品: { py: 'dāngjì xīnpǐn', en: 'new this season' },
    醇香奶茶: { py: 'chúnxiāng nǎichá', en: 'rich milk teas', hsk: ['奶茶'] },
    真鲜果茶: { py: 'zhēn xiān guǒchá', en: 'fresh fruit teas' },
    清爽纯茶: { py: 'qīngshuǎng chún chá', en: 'plain teas', hsk: ['茶'] },
    冰淇淋: { py: 'bīngqílín', en: 'ice cream' },
    奶昔: { py: 'nǎixī', en: 'milkshake' },
    爆款: { py: 'bàokuǎn', en: 'best-seller' },
    新品: { py: 'xīnpǐn', en: 'new' },
    // items
    冰鲜柠檬水: { py: 'bīngxiān níngméng shuǐ', en: 'fresh iced lemonade', note: 'Mixue’s ¥4 classic', hsk: ['水'] },
    柠檬水: { py: 'níngméng shuǐ', en: 'lemonade', hsk: ['水'] },
    珍珠奶茶: { py: 'zhēnzhū nǎichá', en: 'pearl milk tea (bubble tea)', hsk: ['奶茶'] },
    椰果奶茶: { py: 'yēguǒ nǎichá', en: 'milk tea with coconut jelly', hsk: ['奶茶'] },
    布丁奶茶: { py: 'bùdīng nǎichá', en: 'milk tea with pudding', hsk: ['奶茶'] },
    奶茶三兄弟: { py: 'nǎichá sān xiōngdì', en: '"three brothers" milk tea', note: 'pearls, coconut jelly and pudding', hsk: ['奶茶', '三'] },
    芋圆奶茶: { py: 'yùyuán nǎichá', en: 'milk tea with taro balls', hsk: ['奶茶'] },
    原味奶茶: { py: 'yuánwèi nǎichá', en: 'plain milk tea', hsk: ['奶茶'] },
    四季春珍珠奶茶: { py: 'sìjìchūn zhēnzhū nǎichá', en: 'Four Seasons Spring pearl milk tea', hsk: ['奶茶'] },
    满杯百香果: { py: 'mǎn bēi bǎixiāngguǒ', en: 'a full cup of passion fruit', hsk: ['杯'] },
    百香果: { py: 'bǎixiāngguǒ', en: 'passion fruit (tea)' },
    棒打鲜橙: { py: 'bàng dǎ xiān chéng', en: 'fresh orange tea', note: 'literally "fresh orange, beaten with a stick"' },
    百香果双响炮: { py: 'bǎixiāngguǒ shuāngxiǎngpào', en: 'passion fruit "double bang"', note: 'with pearls and coconut jelly' },
    杨枝甘露: { py: 'yángzhī gānlù', en: 'mango pomelo sago' },
    蜜桃四季春: { py: 'mìtáo sìjìchūn', en: 'peach Four Seasons Spring tea' },
    茉莉绿茶: { py: 'mòlì lǜchá', en: 'jasmine green tea', hsk: ['绿茶'] },
    柠檬红茶: { py: 'níngméng hóngchá', en: 'lemon black tea', hsk: ['红茶'] },
    四季春茶: { py: 'sìjìchūn chá', en: 'Four Seasons Spring (oolong) tea', hsk: ['茶'] },
    新鲜冰淇淋: { py: 'xīnxiān bīngqílín', en: 'fresh soft-serve cone', hsk: ['新鲜'] },
    摩天脆脆: { py: 'mótiān cuìcuì', en: 'tall crispy cone' },
    雪王大圣代: { py: 'Xuěwáng dà shèngdài', en: 'Snow King sundae', note: '雪王 is Mixue’s snowman mascot', hsk: ['大'] },
    草莓摇摇奶昔: { py: 'cǎoméi yáoyáo nǎixī', en: 'strawberry shake' },
    芒果摇摇奶昔: { py: 'mángguǒ yáoyáo nǎixī', en: 'mango shake' },
    // descriptions
    一整颗柠檬: { py: 'yì zhěng kē níngméng', en: 'a whole lemon', hsk: ['一'] },
    经典珍珠奶茶: { py: 'jīngdiǎn zhēnzhū nǎichá', en: 'classic pearl milk tea', hsk: ['奶茶'] },
    奶茶加椰果: { py: 'nǎichá jiā yēguǒ', en: 'milk tea with coconut jelly', hsk: ['奶茶'] },
    奶茶加布丁: { py: 'nǎichá jiā bùdīng', en: 'milk tea with pudding', hsk: ['奶茶'] },
    奶茶加芋圆: { py: 'nǎichá jiā yùyuán', en: 'milk tea with taro balls', hsk: ['奶茶'] },
    '珍珠、椰果和布丁': { py: 'zhēnzhū, yēguǒ hé bùdīng', en: 'pearls, coconut jelly and pudding', hsk: ['和'] },
    什么都不加的奶茶: { py: 'shénme dōu bù jiā de nǎichá', en: 'milk tea with nothing added', hsk: ['什么', '都', '不', '的', '奶茶'] },
    四季春茶做的奶茶: { py: 'sìjìchūn chá zuò de nǎichá', en: 'milk tea made with Four Seasons Spring tea', hsk: ['做', '的', '奶茶'] },
    满满一杯百香果: { py: 'mǎnmǎn yì bēi bǎixiāngguǒ', en: 'a cup full of passion fruit', hsk: ['一', '杯'] },
    新鲜橙子: { py: 'xīnxiān chéngzi', en: 'fresh oranges', hsk: ['新鲜'] },
    百香果加珍珠和椰果: { py: 'bǎixiāngguǒ jiā zhēnzhū hé yēguǒ', en: 'passion fruit with pearls and coconut jelly', hsk: ['和'] },
    '芒果、西柚和西米': { py: 'mángguǒ, xīyòu hé xīmǐ', en: 'mango, grapefruit and sago', hsk: ['和'] },
    蜜桃和四季春茶: { py: 'mìtáo hé sìjìchūn chá', en: 'peach and Four Seasons Spring tea', hsk: ['和', '茶'] },
    清香的绿茶: { py: 'qīngxiāng de lǜchá', en: 'fragrant green tea', hsk: ['的', '绿茶'] },
    柠檬和红茶: { py: 'níngméng hé hóngchá', en: 'lemon and black tea', hsk: ['和', '红茶'] },
    清爽的乌龙茶: { py: 'qīngshuǎng de wūlóng chá', en: 'refreshing oolong tea', hsk: ['的', '茶'] },
    两块钱的冰淇淋: { py: 'liǎng kuài qián de bīngqílín', en: 'a two-yuan ice cream', hsk: ['两', '块', '钱', '的'] },
    高高的冰淇淋脆筒: { py: 'gāogāo de bīngqílín cuìtǒng', en: 'a tall crispy ice-cream cone', hsk: ['高', '的'] },
    冰淇淋加果酱: { py: 'bīngqílín jiā guǒjiàng', en: 'ice cream with fruit sauce' },
    草莓冰淇淋奶昔: { py: 'cǎoméi bīngqílín nǎixī', en: 'strawberry ice-cream shake' },
    芒果冰淇淋奶昔: { py: 'mángguǒ bīngqílín nǎixī', en: 'mango ice-cream shake' },
    // groups and options
    杯型: { py: 'bēixíng', en: 'Cup size', hsk: ['杯'] },
    中杯: { py: 'zhōng bēi', en: 'medium', hsk: ['中', '杯'] },
    大杯: { py: 'dà bēi', en: 'large', note: '+¥2', hsk: ['大', '杯'] },
    冰量: { py: 'bīngliàng', en: 'Ice', hsk: ['冰'] },
    正常冰: { py: 'zhèngcháng bīng', en: 'normal ice', hsk: ['冰'] },
    少冰: { py: 'shǎo bīng', en: 'less ice', hsk: ['少', '冰'] },
    去冰: { py: 'qù bīng', en: 'no ice', note: 'cold, but no ice cubes', hsk: ['冰'] },
    常温: { py: 'chángwēn', en: 'room temperature' },
    热饮: { py: 'rè yǐn', en: 'hot', note: 'the hot version of the drink', hsk: ['热'] },
    热的: { py: 'rè de', en: 'hot', note: 'on the menu as 热饮', hsk: ['热', '的'] },
    糖度: { py: 'tángdù', en: 'Sugar' },
    正常糖: { py: 'zhèngcháng táng', en: 'normal sugar' },
    少糖: { py: 'shǎo táng', en: 'less sugar', note: 'about 70%', hsk: ['少'] },
    半糖: { py: 'bàn táng', en: 'half sugar', note: 'about 50%', hsk: ['半'] },
    微糖: { py: 'wēi táng', en: 'a little sugar', note: 'about 30%' },
    无糖: { py: 'wú táng', en: 'no sugar' },
    七分: { py: 'qī fēn', en: '70%', hsk: ['七', '分'] },
    五分: { py: 'wǔ fēn', en: '50%', hsk: ['五', '分'] },
    三分: { py: 'sān fēn', en: '30%', hsk: ['三', '分'] },
    加料: { py: 'jiā liào', en: 'Add-ons', note: 'tap as many as you like; tap again to take one off' },
    珍珠: { py: 'zhēnzhū', en: 'tapioca pearls' },
    椰果: { py: 'yēguǒ', en: 'coconut jelly' },
    布丁: { py: 'bùdīng', en: 'pudding' },
    仙草: { py: 'xiāncǎo', en: 'grass jelly' },
    燕麦: { py: 'yànmài', en: 'oats' },
    红豆: { py: 'hóngdòu', en: 'red beans', hsk: ['红'] },
    黑糖珍珠: { py: 'hēitáng zhēnzhū', en: 'brown-sugar pearls', hsk: ['黑'] },
    芋圆: { py: 'yùyuán', en: 'taro balls' },
    寒天: { py: 'hántiān', en: 'agar jelly' },
    西米: { py: 'xīmǐ', en: 'sago' },
    // checkout
    堂食: { py: 'tángshí', en: 'drink it here' },
    打包: { py: 'dǎbāo', en: 'take away', note: 'the same as 外带 or 带走' },
    带走: { py: 'dàizǒu', en: 'to take away', note: 'choose 打包', hsk: ['走'] },
    在店里喝: { py: 'zài diàn lǐ hē', en: 'drink it in the shop', note: 'choose 堂食', hsk: ['在', '里', '喝'] },
    分开装: { py: 'fēnkāi zhuāng', en: 'pack them separately' },
    不要吸管: { py: 'bú yào xīguǎn', en: 'no straw', hsk: ['不', '要'] },
    多给一个袋子: { py: 'duō gěi yí ge dàizi', en: 'one more bag, please', hsk: ['多', '给', '一', '个'] },
    满15减2: { py: 'mǎn shíwǔ jiǎn èr', en: '¥2 off when you spend ¥15' },
    满25减4: { py: 'mǎn èrshíwǔ jiǎn sì', en: '¥4 off when you spend ¥25' },
    满40减6: { py: 'mǎn sìshí jiǎn liù', en: '¥6 off when you spend ¥40' },
    满15元可用: { py: 'mǎn shíwǔ yuán kěyòng', en: 'for orders of ¥15 or more' },
    满25元可用: { py: 'mǎn èrshíwǔ yuán kěyòng', en: 'for orders of ¥25 or more' },
    满40元可用: { py: 'mǎn sìshí yuán kěyòng', en: 'for orders of ¥40 or more' },
    // the friend's words
    帮我: { py: 'bāng wǒ', en: 'for me (help me)', hsk: ['帮', '我'] },
    买: { py: 'mǎi', en: 'buy', hsk: ['买'] },
    一杯: { py: 'yì bēi', en: 'a cup of', hsk: ['一', '杯'] },
    两杯: { py: 'liǎng bēi', en: 'two cups of', note: '两, not 二, before a measure word', hsk: ['两', '杯'] },
    三杯: { py: 'sān bēi', en: 'three cups of', hsk: ['三', '杯'] },
    一个: { py: 'yí ge', en: 'one', hsk: ['一', '个'] },
    两个: { py: 'liǎng ge', en: 'two', note: '两, not 二, before a measure word', hsk: ['两', '个'] },
    要: { py: 'yào', en: 'want, with', hsk: ['要'] },
    加: { py: 'jiā', en: 'add' },
    和: { py: 'hé', en: 'and', hsk: ['和'] },
    的: { py: 'de', en: '(links a description to a noun)', hsk: ['的'] },
    再要: { py: 'zài yào', en: 'and also', hsk: ['再', '要'] },
    记得用: { py: 'jìde yòng', en: 'remember to use', hsk: ['用'] },
    最便宜: { py: 'zuì piányi', en: 'the cheapest', hsk: ['最', '便宜'] },
    饮品: { py: 'yǐnpǐn', en: 'drinks' },
    奶茶: { py: 'nǎichá', en: 'milk tea', hsk: ['奶茶'] },
    果茶: { py: 'guǒchá', en: 'fruit tea' },
    绿茶: { py: 'lǜchá', en: 'green tea', hsk: ['绿茶'] },
    红茶: { py: 'hóngchá', en: 'black tea', hsk: ['红茶'] },
  },
};
