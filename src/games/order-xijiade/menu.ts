import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 喜家德 — dumplings, by weight.
 *
 * Northern dumpling shops sell by the 两 (50 g, about six dumplings): people
 * order 二两, 三两, 半斤 (five 两). It is the best everyday lesson in 两 and
 * 二 — "two" before a measure word is 两 (两份, two portions), but two of
 * the measure 两 is 二两, never 两两. Each filling is an item; the sheet asks
 * the weight (份量) and how they are cooked (水饺, 煎饺 or 蒸饺).
 *
 * Today's 喜家德 stores also sell plates of 12 (see brands.md); the game
 * keeps the 两, which is what the learner will meet in most dumpling shops.
 */

const dumpling = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price'>): MenuItem => ({
  desc: '',
  photo: 'dumplings',
  unit: '份',
  per: '两',
  groups: ['weight', 'cook'],
  hsk: ['饺子'],
  ...o,
});
const other = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'photo'>): MenuItem => ({
  desc: '',
  groups: [],
  ...o,
});

const items: MenuItem[] = [
  dumpling({ id: 'shrimp', zh: '虾三鲜', cats: ['top', 'sea'], price: 14, desc: '一整只虾仁，招牌', tags: ['招牌'], sold: 8000 }),
  dumpling({ id: 'pork-cabbage', zh: '猪肉白菜', cats: ['top', 'meat'], price: 9, desc: '最家常的饺子', hsk: ['饺子', '肉', '菜'], sold: 5000 }),
  dumpling({ id: 'chive-egg', zh: '韭菜鸡蛋', cats: ['veg'], price: 8, hsk: ['饺子', '鸡蛋', '菜'], sold: 3000 }),
  dumpling({ id: 'beef-leek', zh: '牛肉大葱', cats: ['meat'], price: 12, hsk: ['饺子', '牛', '葱'], sold: 2600 }),
  dumpling({ id: 'veg-three', zh: '素三鲜', cats: ['veg'], price: 8, desc: '鸡蛋、韭菜和木耳', hsk: ['饺子'], sold: 1500 }),
  dumpling({ id: 'mackerel', zh: '鲅鱼', cats: ['sea'], price: 13, desc: '海边的味道', hsk: ['饺子', '鱼'], sold: 900 }),
  dumpling({ id: 'sauerkraut', zh: '酸菜猪肉', cats: ['meat'], price: 10, hsk: ['饺子', '酸', '菜', '肉'], sold: 1800 }),
  dumpling({ id: 'celery', zh: '芹菜猪肉', cats: ['meat'], price: 9, hsk: ['饺子', '菜', '肉'], sold: 1100 }),
  dumpling({ id: 'corn', zh: '玉米猪肉', cats: ['meat'], price: 10, desc: '甜甜的玉米', hsk: ['饺子', '肉'], sold: 1000 }),
  other({ id: 'cucumber', zh: '拍黄瓜', cats: ['cold'], price: 10, photo: 'smashed-cucumber', sold: 2000 }),
  other({ id: 'wood-ear', zh: '凉拌木耳', cats: ['cold'], price: 12, photo: 'wood-ear', sold: 900 }),
  other({ id: 'big-salad', zh: '大拌菜', cats: ['cold'], price: 14, photo: 'stir-fry', desc: '各种生菜拌在一起', hsk: ['菜'], sold: 700 }),
  other({ id: 'vinegar', zh: '醋碟', cats: ['extras'], price: 0, photo: 'dipping-sauce', desc: '饺子要蘸醋', sold: 6000 }),
  other({ id: 'garlic', zh: '蒜泥', cats: ['extras'], price: 1, photo: 'dipping-sauce', sold: 3000 }),
  other({ id: 'chili-oil', zh: '辣椒油', cats: ['extras'], price: 1, photo: 'dipping-sauce', hsk: ['油'], sold: 2500 }),
  other({ id: 'dumpling-soup', zh: '饺子汤', cats: ['drinks'], price: 2, photo: 'soup', unit: '碗', desc: '煮饺子的原汤', hsk: ['饺子', '汤'], sold: 1800 }),
  other({ id: 'soy-milk', zh: '豆浆', cats: ['drinks'], price: 5, photo: 'soy-milk', unit: '杯', sold: 2200 }),
  other({ id: 'millet', zh: '小米粥', cats: ['drinks'], price: 6, photo: 'congee', unit: '碗', hsk: ['粥'], sold: 800 }),
  other({ id: 'plum', zh: '酸梅汤', cats: ['drinks'], price: 8, photo: 'plum-drink', unit: '杯', hsk: ['汤'], sold: 900 }),
  other({ id: 'cola', zh: '可乐', cats: ['drinks'], price: 5, photo: 'cola', unit: '瓶', sold: 700 }),
  other({ id: 'beer', zh: '啤酒', cats: ['drinks'], price: 8, photo: 'beer', unit: '瓶', hsk: ['啤酒'], sold: 600 }),
];

/* ------------------------------------------------------------- templates */

const WEIGHT: Record<string, [string, number, string]> = {
  one: ['一两', 1, 'one liang (about 6)'],
  two: ['二两', 2, 'two liang (about 12)'],
  three: ['三两', 3, 'three liang (about 18)'],
  half: ['半斤', 5, 'half a jin (about 30)'],
};
const COOK_EN: Record<string, string> = { water: 'boiled', fried: 'pan-fried', steamed: 'steamed' };
const DINE_SAY: [string, string, string][] = [
  ['打包', '打包', 'to take away'],
  ['在店里吃', '堂食', "we'll eat here"],
];

const fillings = (b: Brand) => b.items.filter((i) => i.groups.includes('weight'));
const byCat = (b: Brand, c: string) => b.items.filter((i) => i.cats.includes(c));
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;
const weightOf = (p: TemplatePick, from = Object.keys(WEIGHT)) => {
  const id = p.pick(from);
  return { id, zh: WEIGHT[id][0], n: WEIGHT[id][1], en: WEIGHT[id][2] };
};

const templates: TaskTemplate[] = [
  {
    id: 'weight',
    level: 1,
    build: (p) => {
      const i = p.pick(fillings(p.brand));
      const w = weightOf(p, ['one', 'two', 'three']);
      return {
        message: `帮我买${w.zh}${i.zh}水饺。`,
        en: `Buy me ${w.en} of ${enOf(p.brand, i.zh)} boiled dumplings.`,
        parts: [w.zh, i.zh, '水饺'],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { weight: w.id, cook: 'water' } }] as Want[],
      };
    },
  },
  {
    id: 'half-jin',
    level: 1,
    build: (p) => {
      const i = p.pick(fillings(p.brand));
      return {
        message: `我要半斤${i.zh}的。`,
        en: `I want half a jin of ${enOf(p.brand, i.zh)}.`,
        parts: ['半斤', i.zh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { weight: 'half' } }] as Want[],
      };
    },
  },
  {
    id: 'fried',
    level: 2,
    build: (p) => {
      const i = p.pick(fillings(p.brand));
      const w = weightOf(p);
      const cook = p.pick(['fried', 'steamed']);
      const cookZh = cook === 'fried' ? '煎饺' : '蒸饺';
      return {
        message: `${w.zh}${i.zh}，要${cookZh}。`,
        en: `${w.en} of ${enOf(p.brand, i.zh)}, ${COOK_EN[cook]}.`,
        parts: [w.zh, i.zh, cookZh],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { weight: w.id, cook } }] as Want[],
      };
    },
  },
  {
    id: 'two-fillings',
    level: 2,
    build: (p) => {
      const [a, b] = p.sample(fillings(p.brand), 2);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `二两${a.zh}，二两${b.zh}，都是水饺，${say}。`,
        en: `Two liang of ${enOf(p.brand, a.zh)} and two liang of ${enOf(p.brand, b.zh)}, both boiled, ${dineEn}.`,
        parts: ['二两', a.zh, '二两', b.zh, '水饺', say],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'two', cook: 'water' } },
          { kind: 'line', item: b.id, qty: 1, choices: { weight: 'two', cook: 'water' } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'er-not-liang',
    level: 2,
    build: (p) => {
      const a = p.pick(fillings(p.brand));
      const c = p.pick(byCat(p.brand, 'cold'));
      return {
        message: `二两${a.zh}，两份${c.zh}。`,
        en: `Two liang of ${enOf(p.brand, a.zh)} (one plate), and two portions of ${enOf(p.brand, c.zh)}.`,
        parts: ['二两', a.zh, '两份', c.zh],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'two' } },
          { kind: 'line', item: c.id, qty: 2, choices: {} },
        ] as Want[],
      };
    },
  },
  {
    id: 'soup-and-garlic',
    level: 2,
    build: (p) => {
      const a = p.pick(fillings(p.brand));
      const w = weightOf(p);
      return {
        message: `${w.zh}${a.zh}水饺，再要一份蒜泥和一碗饺子汤。`,
        en: `${w.en} of ${enOf(p.brand, a.zh)} boiled dumplings, plus crushed garlic and a bowl of dumpling soup.`,
        parts: [w.zh, a.zh, '水饺', '蒜泥', '一碗', '饺子汤'],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: w.id, cook: 'water' } },
          { kind: 'line', item: 'garlic', qty: 1, choices: {} },
          { kind: 'line', item: 'dumpling-soup', qty: 1, choices: {} },
        ] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: (p) => {
      const a = p.pick(fillings(p.brand));
      // as much as ¥30 buys: the biggest weight that fits
      const best = Object.keys(WEIGHT)
        .filter((k) => WEIGHT[k][1] * a.price <= 30)
        .sort((x, y) => WEIGHT[y][1] - WEIGHT[x][1])[0];
      return {
        message: `我只有30块，帮我买${a.zh}水饺，能买多少就买多少。`,
        en: `I only have ¥30 — buy me as many ${enOf(p.brand, a.zh)} boiled dumplings as that will get.`,
        parts: ['我只有', '30块', a.zh, '水饺', '能买多少就买多少'],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: best, cook: 'water' } },
          { kind: 'budget', max: 30 },
        ] as Want[],
      };
    },
  },
  {
    id: 'coupon',
    level: 2,
    extra: true,
    build: (p) => {
      const a = p.pick(fillings(p.brand).filter((i) => i.price >= 8));
      return {
        message: `半斤${a.zh}，半斤猪肉白菜，用一下优惠券。`,
        en: `Half a jin of ${enOf(p.brand, a.zh)} and half a jin of pork and cabbage — use a coupon.`,
        parts: ['半斤', a.zh, '半斤', '猪肉白菜', '优惠券'],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'half' } },
          { kind: 'line', item: 'pork-cabbage', qty: 1, choices: { weight: 'half' } },
          { kind: 'coupon' },
        ] as Want[],
      };
    },
  },
  {
    id: 'three-ways',
    level: 3,
    build: (p) => {
      const [a, b, c] = p.sample(fillings(p.brand), 3);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `我们三个人：半斤${a.zh}水饺，三两${b.zh}煎饺，一两${c.zh}蒸饺。${say}。`,
        en: `There are three of us: half a jin of ${enOf(p.brand, a.zh)} boiled, three liang of ${enOf(p.brand, b.zh)} pan-fried, one liang of ${enOf(p.brand, c.zh)} steamed. ${dineEn[0].toUpperCase()}${dineEn.slice(1)}.`,
        parts: ['半斤', a.zh, '水饺', '三两', b.zh, '煎饺', '一两', c.zh, '蒸饺', say],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'half', cook: 'water' } },
          { kind: 'line', item: b.id, qty: 1, choices: { weight: 'three', cook: 'fried' } },
          { kind: 'line', item: c.id, qty: 1, choices: { weight: 'one', cook: 'steamed' } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'full-meal',
    level: 3,
    build: (p) => {
      const [a, b] = p.sample(fillings(p.brand), 2);
      const c = p.pick(byCat(p.brand, 'cold'));
      return {
        message: `二两${a.zh}，三两${b.zh}；再要一个${c.zh}，两杯豆浆。在店里吃。`,
        en: `Two liang of ${enOf(p.brand, a.zh)}, three liang of ${enOf(p.brand, b.zh)}; and a ${enOf(p.brand, c.zh)} and two soy milks. We'll eat here.`,
        parts: ['二两', a.zh, '三两', b.zh, c.zh, '两杯', '豆浆', '在店里吃'],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'two' } },
          { kind: 'line', item: b.id, qty: 1, choices: { weight: 'three' } },
          { kind: 'line', item: c.id, qty: 1, choices: {} },
          { kind: 'line', item: 'soy-milk', qty: 2, choices: {} },
          { kind: 'dine', value: '堂食' },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-plates-same',
    level: 3,
    build: (p) => {
      const a = p.pick(fillings(p.brand));
      return {
        message: `两份${a.zh}：一份二两水饺，一份一两煎饺。再要醋和辣椒油。`,
        en: `Two plates of ${enOf(p.brand, a.zh)}: two liang boiled, and one liang pan-fried. And vinegar and chilli oil.`,
        parts: ['两份', a.zh, '二两', '水饺', '一两', '煎饺', '醋', '辣椒油'],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'two', cook: 'water' } },
          { kind: 'line', item: a.id, qty: 1, choices: { weight: 'one', cook: 'fried' } },
          { kind: 'line', item: 'vinegar', qty: 1, choices: {} },
          { kind: 'line', item: 'chili-oil', qty: 1, choices: {} },
        ] as Want[],
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

export const xijiade: Brand = {
  id: 'xijiade',
  model: 'counter',
  name: '喜家德',
  latin: 'XIJIADE',
  merchant: '喜家德虾仁水饺',
  pitch: 'Dumplings by weight: choose the filling, then 一两, 二两, 三两 or 半斤 — and boiled, pan-fried or steamed.',
  colours: { brand: '#1f6f45', soft: '#e3f1e8', ink: '#ffffff', darkBrand: '#7cc79b', darkSoft: '#1b2f24' },
  store: { zh: '沈阳中街店', distance: '600m' },
  categories: [
    { id: 'top', zh: '招牌推荐' },
    { id: 'meat', zh: '肉馅水饺' },
    { id: 'sea', zh: '海鲜水饺' },
    { id: 'veg', zh: '素馅水饺' },
    { id: 'cold', zh: '凉菜' },
    { id: 'extras', zh: '小料' },
    { id: 'drinks', zh: '汤和饮品' },
  ],
  items,
  groups: {
    weight: {
      id: 'weight',
      zh: '份量',
      kind: 'one',
      required: true,
      options: [
        { id: 'one', zh: '一两', sub: '约6个', times: 1 },
        { id: 'two', zh: '二两', sub: '约12个', times: 2 },
        { id: 'three', zh: '三两', sub: '约18个', times: 3 },
        { id: 'half', zh: '半斤', sub: '约30个', times: 5 },
      ],
    },
    cook: {
      id: 'cook',
      zh: '做法',
      kind: 'one',
      required: true,
      default: 'water',
      options: [
        { id: 'water', zh: '水饺' },
        { id: 'fried', zh: '煎饺', delta: 2 },
        { id: 'steamed', zh: '蒸饺' },
      ],
    },
  },
  rules: [],
  coupons: [
    { id: 'off60', zh: '满60减6', sub: '满60元可用', kind: 'off', min: 60, value: 6 },
    { id: 'off100', zh: '满100减12', sub: '满100元可用', kind: 'off', min: 100, value: 12 },
  ],
  fees: [],
  notes: ['分开装', '多给醋', '煮得软一点'],
  dine: ['堂食', '打包'],
  code: { zh: '取餐号', prefix: 'B' },
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'home', zh: '首页', en: 'home' },
    { id: 'menu', zh: '点单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'weight, cooking' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认订单', en: 'checkout' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '取餐号', en: 'your number' },
  ],
  tips: {
    chat: 'Dumplings are ordered by weight: 一两 is about six. 二两 uses 二 — you never say 两两.',
    home: '到店点餐 — order and pay first, then wait for your number.',
    menu: 'The price is per 两 (¥/两). 半斤 is five 两.',
    spec: '份量 is the weight: 一两, 二两, 三两, 半斤. 做法 is how they are cooked: 水饺 boiled, 煎饺 pan-fried, 蒸饺 steamed.',
    cart: 'Two plates of the same filling cooked two ways are two lines.',
    checkout: '两份 is two plates; 二两 is one plate weighing two 两. The coupon is not picked for you.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'Dip them in 醋 (vinegar) — and drink the 饺子汤 at the end, as people do in the north.',
  },
  tour: [
    { target: 'store', zh: '取餐门店', en: 'The shop you are in.' },
    { target: 'rail', zh: '菜单', en: 'Fillings first; then cold dishes, dips and drinks.' },
    { target: 'add', zh: '选规格', en: '选规格 asks the weight (一两, 二两…) and how they are cooked.' },
    { target: 'cart-bar', zh: '购物车', en: 'The cart and the total.' },
    { target: 'checkout-btn', zh: '去结算', en: 'Check out and pay first.' },
  ],
  words: [
    { en: 'By weight', words: ['两', '一两', '二两', '三两', '半斤', '份量', '两份'] },
    { en: 'Fillings', words: ['馅', '虾三鲜', '猪肉白菜', '韭菜鸡蛋', '牛肉大葱', '素三鲜'] },
    { en: 'Cooking and dips', words: ['做法', '水饺', '煎饺', '蒸饺', '醋碟', '蒜泥', '辣椒油', '饺子汤'] },
    { en: 'Paying and waiting', words: ['堂食', '打包', '取餐号', '请留意叫号'] },
  ],
  templates,
  photos: {
    dumplings: { word: '饺子' },
    'smashed-cucumber': {},
    'wood-ear': {},
    'stir-fry': {},
    'dipping-sauce': {},
    soup: {},
    'soy-milk': {},
    congee: {},
    'plum-drink': {},
    cola: {},
    beer: {},
    'xijiade-banner': { word: '饺子' },
  },
  banner: { photo: 'xijiade-banner', zh: '现包现煮', sub: '虾三鲜水饺' },
  friend: '小李',
  glossary: {
    喜家德: { py: 'Xǐ Jiā Dé', en: 'Xijiade (a dumpling chain)', hsk: ['家'] },
    喜家德虾仁水饺: { py: 'Xǐ Jiā Dé xiārén shuǐjiǎo', en: 'Xijiade Shrimp Dumplings', hsk: ['家'] },
    小李: { py: 'Xiǎo Lǐ', en: 'Xiao Li (your friend)' },
    沈阳中街店: { py: 'Shěnyáng Zhōngjiē diàn', en: 'the Zhongjie shop, Shenyang' },
    现包现煮: { py: 'xiàn bāo xiàn zhǔ', en: 'wrapped and cooked to order' },
    虾三鲜水饺: { py: 'xiā sānxiān shuǐjiǎo', en: 'three-treasure shrimp dumplings' },
    馅: { py: 'xiàn', en: 'filling' },
    // categories
    招牌推荐: { py: 'zhāopái tuījiàn', en: 'house specials' },
    招牌: { py: 'zhāopái', en: 'signature' },
    肉馅水饺: { py: 'ròu xiàn shuǐjiǎo', en: 'meat fillings', hsk: ['肉'] },
    海鲜水饺: { py: 'hǎixiān shuǐjiǎo', en: 'seafood fillings' },
    素馅水饺: { py: 'sù xiàn shuǐjiǎo', en: 'vegetable fillings' },
    凉菜: { py: 'liáng cài', en: 'cold dishes', hsk: ['菜'] },
    小料: { py: 'xiǎoliào', en: 'dips', hsk: ['小'] },
    汤和饮品: { py: 'tāng hé yǐnpǐn', en: 'soup and drinks', hsk: ['汤', '和'] },
    // fillings
    虾三鲜: { py: 'xiā sānxiān', en: 'shrimp "three treasures"', note: 'shrimp, pork and chives — the house filling' },
    猪肉白菜: { py: 'zhūròu báicài', en: 'pork and Chinese cabbage', hsk: ['肉', '白', '菜'] },
    韭菜鸡蛋: { py: 'jiǔcài jīdàn', en: 'chive and egg', hsk: ['菜', '鸡蛋'] },
    牛肉大葱: { py: 'niúròu dàcōng', en: 'beef and leek', hsk: ['牛', '大', '葱'] },
    素三鲜: { py: 'sù sānxiān', en: 'vegetable "three treasures"' },
    鲅鱼: { py: 'bàyú', en: 'mackerel', hsk: ['鱼'] },
    酸菜猪肉: { py: 'suāncài zhūròu', en: 'pickled cabbage and pork', hsk: ['酸', '菜', '肉'] },
    芹菜猪肉: { py: 'qíncài zhūròu', en: 'celery and pork', hsk: ['菜', '肉'] },
    玉米猪肉: { py: 'yùmǐ zhūròu', en: 'sweetcorn and pork', hsk: ['肉'] },
    // others
    拍黄瓜: { py: 'pāi huángguā', en: 'smashed cucumber' },
    凉拌木耳: { py: 'liángbàn mù’ěr', en: 'wood-ear mushroom salad' },
    大拌菜: { py: 'dà bàn cài', en: 'big mixed salad', hsk: ['大', '菜'] },
    醋碟: { py: 'cù dié', en: 'a dish of vinegar', note: 'free' },
    醋: { py: 'cù', en: 'vinegar' },
    蒜泥: { py: 'suànní', en: 'crushed garlic' },
    辣椒油: { py: 'làjiāo yóu', en: 'chilli oil', hsk: ['辣', '油'] },
    饺子汤: { py: 'jiǎozi tāng', en: 'dumpling water', note: 'the water they were boiled in — drunk at the end', hsk: ['饺子', '汤'] },
    豆浆: { py: 'dòujiāng', en: 'soy milk' },
    小米粥: { py: 'xiǎomǐ zhōu', en: 'millet porridge', hsk: ['粥'] },
    酸梅汤: { py: 'suānméi tāng', en: 'sour plum drink', hsk: ['汤'] },
    可乐: { py: 'kělè', en: 'cola' },
    啤酒: { py: 'píjiǔ', en: 'beer', hsk: ['啤酒'] },
    // descriptions
    '一整只虾仁，招牌': { py: 'yì zhěng zhī xiārén, zhāopái', en: 'a whole shrimp inside — the house signature', hsk: ['一', '只'] },
    最家常的饺子: { py: 'zuì jiācháng de jiǎozi', en: 'the most homely dumpling', hsk: ['最', '的', '饺子'] },
    '鸡蛋、韭菜和木耳': { py: 'jīdàn, jiǔcài hé mù’ěr', en: 'egg, chives and wood-ear mushroom', hsk: ['鸡蛋', '菜', '和'] },
    海边的味道: { py: 'hǎibiān de wèidào', en: 'a taste of the seaside', hsk: ['的'] },
    甜甜的玉米: { py: 'tiántián de yùmǐ', en: 'sweet corn', hsk: ['甜', '的'] },
    各种生菜拌在一起: { py: 'gè zhǒng shēngcài bàn zài yìqǐ', en: 'all kinds of raw vegetables tossed together', hsk: ['在', '一起'] },
    饺子要蘸醋: { py: 'jiǎozi yào zhàn cù', en: 'dumplings are dipped in vinegar', hsk: ['饺子', '要'] },
    煮饺子的原汤: { py: 'zhǔ jiǎozi de yuán tāng', en: 'the water the dumplings were boiled in', hsk: ['饺子', '的', '汤'] },
    // groups and options
    份量: { py: 'fènliàng', en: 'Weight' },
    一两: { py: 'yì liǎng', en: 'one liang (50 g)', note: 'about 6 dumplings', hsk: ['一', '两'] },
    二两: { py: 'èr liǎng', en: 'two liang (100 g)', note: '二, not 两: the measure itself is 两, so "two 两" is 二两', hsk: ['二', '两'] },
    三两: { py: 'sān liǎng', en: 'three liang (150 g)', hsk: ['三', '两'] },
    半斤: { py: 'bàn jīn', en: 'half a jin (250 g)', note: 'a jin is ten 两, so half a jin is five 两', hsk: ['半', '斤'] },
    约6个: { py: 'yuē liù ge', en: 'about 6', hsk: ['个'] },
    约12个: { py: 'yuē shí’èr ge', en: 'about 12', hsk: ['个'] },
    约18个: { py: 'yuē shíbā ge', en: 'about 18', hsk: ['个'] },
    约30个: { py: 'yuē sānshí ge', en: 'about 30', hsk: ['个'] },
    做法: { py: 'zuòfǎ', en: 'How they are cooked', hsk: ['做'] },
    水饺: { py: 'shuǐjiǎo', en: 'boiled dumplings', hsk: ['水'] },
    煎饺: { py: 'jiānjiǎo', en: 'pan-fried dumplings', note: '+¥2' },
    蒸饺: { py: 'zhēngjiǎo', en: 'steamed dumplings' },
    // checkout
    堂食: { py: 'tángshí', en: 'eat here' },
    打包: { py: 'dǎbāo', en: 'take away' },
    分开装: { py: 'fēnkāi zhuāng', en: 'pack separately' },
    多给醋: { py: 'duō gěi cù', en: 'extra vinegar', hsk: ['多', '给'] },
    煮得软一点: { py: 'zhǔ de ruǎn yìdiǎn', en: 'cook them a little softer', hsk: ['得', '一点'] },
    满60减6: { py: 'mǎn liùshí jiǎn liù', en: '¥6 off when you spend ¥60' },
    满100减12: { py: 'mǎn yìbǎi jiǎn shí’èr', en: '¥12 off when you spend ¥100' },
    满60元可用: { py: 'mǎn liùshí yuán kěyòng', en: 'for orders of ¥60 or more' },
    满100元可用: { py: 'mǎn yìbǎi yuán kěyòng', en: 'for orders of ¥100 or more' },
    // the friend's words
    帮我: { py: 'bāng wǒ', en: 'for me', hsk: ['帮', '我'] },
    买: { py: 'mǎi', en: 'buy', hsk: ['买'] },
    我要: { py: 'wǒ yào', en: 'I want', hsk: ['我', '要'] },
    要: { py: 'yào', en: 'want', hsk: ['要'] },
    都是水饺: { py: 'dōu shì shuǐjiǎo', en: 'all boiled', hsk: ['都', '是', '水'] },
    两份: { py: 'liǎng fèn', en: 'two plates', note: '两, not 二, before the measure word 份', hsk: ['两', '份'] },
    一份: { py: 'yí fèn', en: 'one plate', hsk: ['一', '份'] },
    两杯: { py: 'liǎng bēi', en: 'two cups of', hsk: ['两', '杯'] },
    再要: { py: 'zài yào', en: 'and also', hsk: ['再', '要'] },
    在店里吃: { py: 'zài diàn lǐ chī', en: 'eat in the shop', note: 'choose 堂食', hsk: ['在', '里', '吃'] },
    能买多少就买多少: { py: 'néng mǎi duōshao jiù mǎi duōshao', en: 'buy as much as it will get', hsk: ['能', '买', '多少', '就'] },
    用一下优惠券: { py: 'yòng yíxià yōuhuìquàn', en: 'use a coupon', hsk: ['用', '一下'] },
  },
};
