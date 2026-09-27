import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 马记永 — Lanzhou beef noodles, ordered at the counter or in the
 * mini-program, paid first (先付后吃), collected when the number is called.
 *
 * The shop's signature choice is 面型, the thickness the noodles are pulled
 * to: 毛细 (hair-thin) · 细 · 三细 · 二细 · 韭叶 (flat, chive-leaf wide) · 薄宽
 * · 大宽. Then 大碗 or 小碗, and 要 or 不要 for 辣子 (chilli oil), 香菜 and
 * 蒜苗 — the three toppings of a Lanzhou bowl. 加肉 and 加蛋 cost extra.
 */

const noodle = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price'>): MenuItem => ({
  desc: '',
  photo: 'beef-noodles',
  unit: '碗',
  groups: ['bowl', 'noodle', 'chili', 'cilantro', 'garlic', 'add'],
  prices: { small: o.price - 4 },
  hsk: ['面条儿', '牛'],
  ...o,
});
const side = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'photo'>): MenuItem => ({
  desc: '',
  groups: [],
  ...o,
});

const items: MenuItem[] = [
  noodle({ id: 'beef-noodles', zh: '招牌牛肉面', call: '牛肉面', cats: ['top', 'noodles'], price: 28, desc: '一清二白三红四绿', tags: ['招牌'], sold: 9000 }),
  noodle({ id: 'extra-beef', zh: '精品牛肉面', cats: ['noodles'], price: 38, desc: '牛肉多一倍', sold: 2500 }),
  noodle({ id: 'golden-soup', zh: '金汤牛肉面', cats: ['noodles'], price: 32, desc: '番茄和酸菜的金汤', sold: 1600 }),
  noodle({ id: 'tomato-beef', zh: '番茄牛肉面', cats: ['noodles'], price: 30, sold: 1200 }),
  noodle({ id: 'clear-soup', zh: '清汤牛肉面', cats: ['noodles'], price: 26, desc: '汤清肉嫩', sold: 1000 }),
  noodle({ id: 'kids', zh: '儿童牛肉面', cats: ['noodles'], price: 18, desc: '小朋友的一小碗', groups: ['noodle', 'chili', 'cilantro', 'garlic'], prices: {}, sold: 400 }),
  { id: 'mixed', zh: '牛肉拌面', cats: ['mixed'], price: 30, desc: '没有汤的拌面', photo: 'noodles-bowl', unit: '碗', groups: ['noodle', 'chili', 'add'], hsk: ['面条儿', '牛'], sold: 1300 },
  { id: 'fried', zh: '牛肉炒面', cats: ['mixed'], price: 32, desc: '', photo: 'noodles-bowl', unit: '份', groups: ['noodle', 'chili'], hsk: ['面条儿', '牛'], sold: 900 },
  side({ id: 'beef-plate', zh: '凉拌牛肉', cats: ['top', 'cold'], price: 26, photo: 'sliced-beef', hsk: ['牛'], sold: 3000 }),
  side({ id: 'braised-beef', zh: '酱牛肉', cats: ['cold'], price: 30, photo: 'sliced-beef', hsk: ['牛'], sold: 1100 }),
  side({ id: 'cucumber', zh: '拍黄瓜', cats: ['cold'], price: 10, photo: 'smashed-cucumber', sold: 1500 }),
  side({ id: 'kelp', zh: '凉拌海带丝', cats: ['cold'], price: 8, photo: 'kelp-salad', sold: 900 }),
  side({ id: 'egg', zh: '卤蛋', cats: ['top', 'snack'], price: 3, photo: 'braised-egg', unit: '个', hsk: ['鸡蛋'], sold: 6000 }),
  side({ id: 'beef-pie', zh: '牛肉馅饼', cats: ['snack'], price: 12, photo: 'meat-pie', unit: '个', hsk: ['饼', '牛'], sold: 1400 }),
  side({ id: 'sugar-cake', zh: '糖油饼', cats: ['snack'], price: 6, photo: 'meat-pie', unit: '个', hsk: ['饼'], sold: 800 }),
  side({ id: 'lamb-soup', zh: '牛骨汤', cats: ['snack'], price: 8, photo: 'soup', unit: '碗', hsk: ['汤'], sold: 500 }),
  side({ id: 'apricot', zh: '杏皮茶', cats: ['drinks'], price: 10, photo: 'plum-drink', unit: '杯', desc: '西北的酸甜饮品', hsk: ['茶'], sold: 2200 }),
  side({ id: 'plum', zh: '酸梅汤', cats: ['drinks'], price: 8, photo: 'plum-drink', unit: '杯', hsk: ['汤'], sold: 1400 }),
  side({ id: 'yogurt', zh: '老酸奶', cats: ['drinks'], price: 8, photo: 'yogurt', unit: '杯', sold: 1100 }),
  side({ id: 'cola', zh: '可乐', cats: ['drinks'], price: 5, photo: 'cola', unit: '瓶', sold: 900 }),
  side({ id: 'water', zh: '矿泉水', cats: ['drinks'], price: 3, photo: 'water-bottle', unit: '瓶', hsk: ['水'], sold: 700 }),
];

/* ------------------------------------------------------------- templates */

const NOODLE_EN: Record<string, string> = {
  mao: 'hair-thin',
  xi: 'thin',
  san: '"third-thin"',
  er: '"second-thin" (medium)',
  jiuye: 'flat chive-leaf',
  bokuan: 'thin-wide',
  dakuan: 'extra-wide',
};
const DINE_SAY: [string, string, string][] = [
  ['打包', '打包', 'to take away'],
  ['带走', '打包', 'to take away'],
  ['在店里吃', '堂食', "I'll eat here"],
];

const noodles = (b: Brand) => b.items.filter((i) => i.groups.includes('noodle') && i.groups.includes('cilantro'));
const soupNoodles = (b: Brand) => b.items.filter((i) => i.groups.includes('bowl'));
const byCat = (b: Brand, c: string) => b.items.filter((i) => i.cats.includes(c));
const call = (i: MenuItem) => i.call ?? i.zh;
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;
const shapeOf = (p: TemplatePick) => {
  const o = p.pick(p.brand.groups.noodle.options);
  return { id: o.id, zh: o.zh, en: NOODLE_EN[o.id] };
};

const templates: TaskTemplate[] = [
  {
    id: 'shape',
    level: 1,
    build: (p) => {
      const s = shapeOf(p);
      return {
        message: `帮我点一碗牛肉面，要${s.zh}。`,
        en: `Order me a bowl of beef noodles, ${s.en}.`,
        parts: ['一碗', '牛肉面', s.zh],
        wants: [{ kind: 'line', item: 'beef-noodles', qty: 1, choices: { noodle: s.id } }] as Want[],
      };
    },
  },
  {
    id: 'small-bowl',
    level: 1,
    build: (p) => {
      const i = p.pick(soupNoodles(p.brand));
      return {
        message: `我要一碗小碗的${call(i)}。`,
        en: `I want a small bowl of ${enOf(p.brand, call(i))}.`,
        parts: ['小碗', call(i)],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { bowl: 'small' } }] as Want[],
      };
    },
  },
  {
    id: 'one-side',
    level: 1,
    build: (p) => {
      const i = p.pick(byCat(p.brand, 'snack').filter((x) => x.unit === '个'));
      const n = p.pick([1, 2]);
      return {
        message: `帮我买${n === 1 ? '一个' : '两个'}${call(i)}。`,
        en: `Buy me ${n === 1 ? 'a' : 'two'} ${enOf(p.brand, call(i))}.`,
        parts: [n === 1 ? '一个' : '两个', call(i)],
        wants: [{ kind: 'line', item: i.id, qty: n, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'no-coriander',
    level: 2,
    build: (p) => {
      const i = p.pick(noodles(p.brand));
      const s = shapeOf(p);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `一碗${call(i)}，${s.zh}，不要香菜，${say}。`,
        en: `A ${enOf(p.brand, call(i))}, ${s.en}, no coriander, ${dineEn}.`,
        parts: [call(i), s.zh, '不要香菜', say],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { noodle: s.id, cilantro: 'no' } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'meat-and-egg',
    level: 2,
    build: (p) => {
      const i = p.pick(soupNoodles(p.brand));
      const s = shapeOf(p);
      return {
        message: `一碗大碗的${call(i)}，${s.zh}，加肉，加蛋。`,
        en: `A large bowl of ${enOf(p.brand, call(i))}, ${s.en}, with extra beef and an egg.`,
        parts: ['大碗', call(i), s.zh, '加肉', '加蛋'],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { bowl: 'big', noodle: s.id, add: ['meat', 'egg'] } }] as Want[],
      };
    },
  },
  {
    id: 'noodle-and-cold',
    level: 2,
    build: (p) => {
      const i = p.pick(noodles(p.brand));
      const s = shapeOf(p);
      const c = p.pick(byCat(p.brand, 'cold'));
      return {
        message: `一碗${call(i)}，${s.zh}；再要一份${call(c)}。`,
        en: `A ${enOf(p.brand, call(i))}, ${s.en}; and a ${enOf(p.brand, call(c))}.`,
        parts: [call(i), s.zh, '一份', call(c)],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { noodle: s.id } },
          { kind: 'line', item: c.id, qty: 1, choices: {} },
        ] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: (p) => {
      const s = shapeOf(p);
      return {
        message: `我只有25块，帮我点一碗牛肉面，${s.zh}。`,
        en: `I only have ¥25 — order me a bowl of beef noodles, ${s.en}.`,
        parts: ['我只有', '25块', '牛肉面', s.zh],
        wants: [
          { kind: 'line', item: 'beef-noodles', qty: 1, choices: { noodle: s.id, bowl: 'small' } },
          { kind: 'budget', max: 25 },
        ] as Want[],
      };
    },
  },
  {
    id: 'coupon',
    level: 2,
    extra: true,
    build: (p) => {
      const s = shapeOf(p);
      return {
        message: `两碗牛肉面，都要${s.zh}，用一下优惠券。`,
        en: `Two bowls of beef noodles, both ${s.en} — and use a coupon.`,
        parts: ['两碗', '牛肉面', s.zh, '优惠券'],
        wants: [
          { kind: 'line', item: 'beef-noodles', qty: 2, choices: { noodle: s.id } },
          { kind: 'coupon' },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-bowls',
    level: 3,
    build: (p) => {
      const i = p.pick(noodles(p.brand).filter((x) => x.groups.includes('add')));
      const [a, b] = p.sample(p.brand.groups.noodle.options, 2);
      return {
        message: `两碗${call(i)}：一碗${a.zh}，不要辣子；一碗${b.zh}，加肉。打包。`,
        en: `Two ${enOf(p.brand, call(i))}: one ${NOODLE_EN[a.id]} with no chilli oil; one ${NOODLE_EN[b.id]} with extra beef. To take away.`,
        parts: ['两碗', call(i), a.zh, '不要辣子', b.zh, '加肉', '打包'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { noodle: a.id, chili: 'no' } },
          { kind: 'line', item: i.id, qty: 1, choices: { noodle: b.id, add: ['meat'] } },
          { kind: 'dine', value: '打包' },
        ] as Want[],
      };
    },
  },
  {
    id: 'full-order',
    level: 3,
    build: (p) => {
      const i = p.pick(noodles(p.brand));
      const s = shapeOf(p);
      const sn = p.pick(byCat(p.brand, 'snack').filter((x) => x.unit === '个'));
      const d = p.pick(byCat(p.brand, 'drinks'));
      return {
        message: `一碗${call(i)}，${s.zh}，少放辣子，不要蒜苗；一个${call(sn)}，一${d.unit}${call(d)}。在店里吃。`,
        en: `A ${enOf(p.brand, call(i))}, ${s.en}, a little chilli oil, no garlic shoots; a ${enOf(p.brand, call(sn))} and a ${enOf(p.brand, call(d))}. Eating here.`,
        parts: [call(i), s.zh, '少放辣子', '不要蒜苗', call(sn), call(d), '在店里吃'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { noodle: s.id, chili: 'less', garlic: 'no' } },
          { kind: 'line', item: sn.id, qty: 1, choices: {} },
          { kind: 'line', item: d.id, qty: 1, choices: {} },
          { kind: 'dine', value: '堂食' },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-kinds',
    level: 3,
    build: (p) => {
      const [a, b] = p.sample(noodles(p.brand), 2);
      const s1 = shapeOf(p);
      const s2 = shapeOf(p);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `一碗${call(a)}，${s1.zh}；一碗${call(b)}，${s2.zh}。都不要香菜，${say}。`,
        en: `A ${enOf(p.brand, call(a))}, ${s1.en}; a ${enOf(p.brand, call(b))}, ${s2.en}. No coriander in either; ${dineEn}.`,
        parts: [call(a), s1.zh, call(b), s2.zh, '不要香菜', say],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: { noodle: s1.id, cilantro: 'no' } },
          { kind: 'line', item: b.id, qty: 1, choices: { noodle: s2.id, cilantro: 'no' } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

export const majiyong: Brand = {
  id: 'majiyong',
  model: 'counter',
  name: '马记永',
  latin: 'MA JI YONG',
  merchant: '马记永兰州牛肉面',
  pitch: 'Lanzhou beef noodles: the noodle shape, big or small bowl, chilli, coriander and garlic shoots — pay first, then wait for your number.',
  colours: { brand: '#1f3b57', soft: '#e5ebf2', ink: '#ffffff', darkBrand: '#8fb0d3', darkSoft: '#1c2733' },
  store: { zh: '上海静安寺店', distance: '400m' },
  categories: [
    { id: 'top', zh: '招牌推荐' },
    { id: 'noodles', zh: '牛肉面' },
    { id: 'mixed', zh: '拌面炒面' },
    { id: 'cold', zh: '凉菜' },
    { id: 'snack', zh: '小吃' },
    { id: 'drinks', zh: '饮品' },
  ],
  items,
  groups: {
    bowl: {
      id: 'bowl',
      zh: '碗型',
      kind: 'one',
      required: true,
      default: 'big',
      options: [
        { id: 'big', zh: '大碗' },
        { id: 'small', zh: '小碗' },
      ],
    },
    noodle: {
      id: 'noodle',
      zh: '面型',
      kind: 'one',
      required: true,
      options: [
        { id: 'mao', zh: '毛细', sub: '最细' },
        { id: 'xi', zh: '细' },
        { id: 'san', zh: '三细' },
        { id: 'er', zh: '二细' },
        { id: 'jiuye', zh: '韭叶', sub: '扁' },
        { id: 'bokuan', zh: '薄宽', sub: '扁' },
        { id: 'dakuan', zh: '大宽', sub: '最宽' },
      ],
    },
    chili: {
      id: 'chili',
      zh: '辣子',
      kind: 'one',
      required: true,
      default: 'yes',
      options: [
        { id: 'yes', zh: '要辣子' },
        { id: 'less', zh: '少放辣子' },
        { id: 'no', zh: '不要辣子' },
      ],
    },
    cilantro: {
      id: 'cilantro',
      zh: '香菜',
      kind: 'one',
      required: true,
      default: 'yes',
      options: [
        { id: 'yes', zh: '要香菜' },
        { id: 'no', zh: '不要香菜' },
      ],
    },
    garlic: {
      id: 'garlic',
      zh: '蒜苗',
      kind: 'one',
      required: true,
      default: 'yes',
      options: [
        { id: 'yes', zh: '要蒜苗' },
        { id: 'no', zh: '不要蒜苗' },
      ],
    },
    add: {
      id: 'add',
      zh: '加料',
      kind: 'many',
      required: false,
      options: [
        { id: 'meat', zh: '加肉', delta: 8 },
        { id: 'egg', zh: '加蛋', delta: 2 },
        { id: 'noodle', zh: '加面', delta: 3 },
      ],
    },
  },
  rules: [],
  coupons: [
    { id: 'off50', zh: '满50减5', sub: '满50元可用', kind: 'off', min: 50, value: 5 },
    { id: 'off80', zh: '满80减10', sub: '满80元可用', kind: 'off', min: 80, value: 10 },
  ],
  fees: [],
  notes: ['汤多一点', '面硬一点', '不要葱', '分开装'],
  dine: ['堂食', '打包'],
  code: { zh: '取餐号', prefix: 'A' },
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'home', zh: '首页', en: 'home' },
    { id: 'menu', zh: '点单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'options' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认订单', en: 'checkout' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '取餐号', en: 'your number' },
  ],
  tips: {
    chat: 'A Lanzhou noodle order is the bowl, the 面型 (how thick) and the toppings: 辣子 chilli oil, 香菜 coriander, 蒜苗 garlic shoots.',
    home: '到店点餐 — order and pay first (先付后吃), then wait for your number.',
    menu: '牛肉面 is the soup noodle; 拌面 has no soup. 小碗 is ¥4 less than 大碗.',
    spec: '面型 from thin to thick: 毛细 · 细 · 三细 · 二细, then the flat ones 韭叶 · 薄宽 · 大宽. 二细 is the everyday choice.',
    cart: 'Two bowls with different noodles are two lines.',
    checkout: '堂食 is eating here; 打包 is take away. The coupon is not picked for you.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'Your 取餐号 is called out — A047 is read "A 零四七". 请留意叫号: listen for it.',
  },
  tour: [
    { target: 'store', zh: '取餐门店', en: 'The shop you are in.' },
    { target: 'rail', zh: '菜单', en: 'Noodle soups, noodles without soup, cold dishes, snacks, drinks.' },
    { target: 'add', zh: '选规格', en: '选规格 opens 碗型, 面型, 辣子, 香菜, 蒜苗 and 加料.' },
    { target: 'cart-bar', zh: '购物车', en: 'The cart and the total.' },
    { target: 'checkout-btn', zh: '去结算', en: 'Check out and pay — first, before you eat.' },
  ],
  words: [
    { en: 'The bowl', words: ['牛肉面', '碗型', '大碗', '小碗', '面型', '毛细', '细', '三细', '二细', '韭叶', '薄宽', '大宽'] },
    { en: 'Toppings', words: ['辣子', '香菜', '蒜苗', '要辣子', '少放辣子', '不要辣子', '不要香菜', '不要蒜苗', '加肉', '加蛋', '加面'] },
    { en: 'On the side', words: ['凉菜', '凉拌牛肉', '拍黄瓜', '卤蛋', '牛肉馅饼', '杏皮茶', '酸梅汤'] },
    { en: 'Paying and waiting', words: ['先付后吃', '堂食', '打包', '取餐号', '请留意叫号'] },
  ],
  templates,
  photos: {
    'beef-noodles': {},
    'noodles-bowl': {},
    'sliced-beef': {},
    'smashed-cucumber': {},
    'kelp-salad': {},
    'braised-egg': { word: '鸡蛋' },
    'meat-pie': {},
    soup: {},
    'plum-drink': {},
    yogurt: {},
    cola: {},
    'water-bottle': {},
    'majiyong-banner': {},
  },
  banner: { photo: 'majiyong-banner', zh: '兰州牛肉面', sub: '一清二白三红四绿' },
  friend: '老张',
  glossary: {
    马记永: { py: 'Mǎ Jì Yǒng', en: 'Ma Ji Yong (a Lanzhou noodle chain)' },
    马记永兰州牛肉面: { py: 'Mǎ Jì Yǒng Lánzhōu niúròu miàn', en: 'Ma Ji Yong Lanzhou Beef Noodles', hsk: ['牛', '面'] },
    老张: { py: 'Lǎo Zhāng', en: 'Lao Zhang (your friend)', note: '老 before a surname: an older friend', hsk: ['老'] },
    上海静安寺店: { py: 'Shànghǎi Jìng’ān Sì diàn', en: 'the Jing’an Temple shop, Shanghai' },
    兰州牛肉面: { py: 'Lánzhōu niúròu miàn', en: 'Lanzhou beef noodles', hsk: ['牛', '面'] },
    一清二白三红四绿: { py: 'yī qīng èr bái sān hóng sì lǜ', en: 'clear soup, white radish, red chilli, green herbs', note: 'the old rule for a good Lanzhou bowl', hsk: ['一', '二', '白', '三', '红', '四', '绿'] },
    先付后吃: { py: 'xiān fù hòu chī', en: 'pay first, eat after', hsk: ['先', '后', '吃'] },
    // categories
    招牌推荐: { py: 'zhāopái tuījiàn', en: 'house specials' },
    招牌: { py: 'zhāopái', en: 'signature' },
    牛肉面: { py: 'niúròu miàn', en: 'beef noodle soup', hsk: ['牛', '面'] },
    拌面炒面: { py: 'bànmiàn chǎomiàn', en: 'mixed and fried noodles', hsk: ['面'] },
    凉菜: { py: 'liáng cài', en: 'cold dishes', hsk: ['菜'] },
    小吃: { py: 'xiǎochī', en: 'snacks', hsk: ['小', '吃'] },
    饮品: { py: 'yǐnpǐn', en: 'drinks' },
    // items
    招牌牛肉面: { py: 'zhāopái niúròu miàn', en: 'signature beef noodle soup', hsk: ['牛', '面'] },
    精品牛肉面: { py: 'jīngpǐn niúròu miàn', en: 'premium beef noodle soup', hsk: ['牛', '面'] },
    金汤牛肉面: { py: 'jīn tāng niúròu miàn', en: 'golden-broth beef noodles', hsk: ['汤', '牛', '面'] },
    番茄牛肉面: { py: 'fānqié niúròu miàn', en: 'tomato beef noodles', hsk: ['牛', '面'] },
    清汤牛肉面: { py: 'qīng tāng niúròu miàn', en: 'clear-broth beef noodles', hsk: ['汤', '牛', '面'] },
    儿童牛肉面: { py: 'értóng niúròu miàn', en: 'children’s beef noodles', hsk: ['牛', '面'] },
    牛肉拌面: { py: 'niúròu bànmiàn', en: 'beef noodles without soup', hsk: ['牛', '面'] },
    牛肉炒面: { py: 'niúròu chǎomiàn', en: 'beef fried noodles', hsk: ['牛', '面'] },
    凉拌牛肉: { py: 'liángbàn niúròu', en: 'cold beef salad', hsk: ['牛'] },
    酱牛肉: { py: 'jiàng niúròu', en: 'braised beef shank', hsk: ['牛'] },
    拍黄瓜: { py: 'pāi huángguā', en: 'smashed cucumber' },
    凉拌海带丝: { py: 'liángbàn hǎidài sī', en: 'kelp salad' },
    卤蛋: { py: 'lǔ dàn', en: 'braised egg' },
    牛肉馅饼: { py: 'niúròu xiànbǐng', en: 'beef pie', hsk: ['牛', '饼'] },
    糖油饼: { py: 'táng yóu bǐng', en: 'sugar fried bread', hsk: ['油', '饼'] },
    牛骨汤: { py: 'niú gǔ tāng', en: 'beef bone soup', hsk: ['牛', '汤'] },
    杏皮茶: { py: 'xìngpí chá', en: 'apricot drink', note: 'a sweet-sour drink from the north-west', hsk: ['茶'] },
    酸梅汤: { py: 'suānméi tāng', en: 'sour plum drink', hsk: ['汤'] },
    老酸奶: { py: 'lǎo suānnǎi', en: 'set yogurt', hsk: ['老'] },
    可乐: { py: 'kělè', en: 'cola' },
    矿泉水: { py: 'kuàngquán shuǐ', en: 'mineral water', hsk: ['水'] },
    // descriptions
    牛肉多一倍: { py: 'niúròu duō yí bèi', en: 'twice the beef', hsk: ['多'] },
    番茄和酸菜的金汤: { py: 'fānqié hé suāncài de jīn tāng', en: 'a golden broth of tomato and pickled greens', hsk: ['和', '的', '汤'] },
    汤清肉嫩: { py: 'tāng qīng ròu nèn', en: 'clear soup, tender beef', hsk: ['汤', '肉'] },
    小朋友的一小碗: { py: 'xiǎopéngyou de yì xiǎo wǎn', en: 'a little bowl for children', hsk: ['的', '小', '碗'] },
    没有汤的拌面: { py: 'méiyǒu tāng de bànmiàn', en: 'noodles mixed with sauce, no soup', hsk: ['没有', '汤', '的'] },
    西北的酸甜饮品: { py: 'xīběi de suān tián yǐnpǐn', en: 'a sweet-sour drink from the north-west', hsk: ['的', '酸', '甜'] },
    // groups and options
    碗型: { py: 'wǎn xíng', en: 'Bowl size', hsk: ['碗'] },
    大碗: { py: 'dà wǎn', en: 'large bowl', hsk: ['大', '碗'] },
    小碗: { py: 'xiǎo wǎn', en: 'small bowl', note: '¥4 less', hsk: ['小', '碗'] },
    面型: { py: 'miàn xíng', en: 'Noodle shape', note: 'how thick the noodles are pulled', hsk: ['面'] },
    毛细: { py: 'máo xì', en: 'hair-thin' },
    细: { py: 'xì', en: 'thin' },
    三细: { py: 'sān xì', en: '"third-thin"', hsk: ['三'] },
    二细: { py: 'èr xì', en: '"second-thin" — medium, the usual', hsk: ['二'] },
    韭叶: { py: 'jiǔ yè', en: 'flat, chive-leaf wide' },
    薄宽: { py: 'báo kuān', en: 'thin and wide' },
    大宽: { py: 'dà kuān', en: 'extra wide (a belt)', hsk: ['大'] },
    最细: { py: 'zuì xì', en: 'the thinnest', hsk: ['最'] },
    最宽: { py: 'zuì kuān', en: 'the widest', hsk: ['最'] },
    扁: { py: 'biǎn', en: 'flat' },
    辣子: { py: 'làzi', en: 'Chilli oil', hsk: ['辣'] },
    要辣子: { py: 'yào làzi', en: 'with chilli oil', hsk: ['要', '辣'] },
    少放辣子: { py: 'shǎo fàng làzi', en: 'a little chilli oil', hsk: ['少', '辣'] },
    不要辣子: { py: 'bú yào làzi', en: 'no chilli oil', hsk: ['不', '要', '辣'] },
    香菜: { py: 'xiāngcài', en: 'Coriander', hsk: ['菜'] },
    要香菜: { py: 'yào xiāngcài', en: 'with coriander', hsk: ['要', '菜'] },
    不要香菜: { py: 'bú yào xiāngcài', en: 'no coriander', hsk: ['不', '要', '菜'] },
    蒜苗: { py: 'suànmiáo', en: 'Garlic shoots' },
    要蒜苗: { py: 'yào suànmiáo', en: 'with garlic shoots', hsk: ['要'] },
    不要蒜苗: { py: 'bú yào suànmiáo', en: 'no garlic shoots', hsk: ['不', '要'] },
    加料: { py: 'jiā liào', en: 'Extras' },
    加肉: { py: 'jiā ròu', en: 'extra beef', note: '+¥8', hsk: ['肉'] },
    加蛋: { py: 'jiā dàn', en: 'add an egg', note: '+¥2' },
    加面: { py: 'jiā miàn', en: 'extra noodles', hsk: ['面'] },
    // checkout and notes
    堂食: { py: 'tángshí', en: 'eat here' },
    打包: { py: 'dǎbāo', en: 'take away' },
    汤多一点: { py: 'tāng duō yìdiǎn', en: 'a bit more soup', hsk: ['汤', '多', '一点'] },
    面硬一点: { py: 'miàn yìng yìdiǎn', en: 'noodles a bit firmer', hsk: ['面', '一点'] },
    不要葱: { py: 'bú yào cōng', en: 'no spring onion', hsk: ['不', '要', '葱'] },
    分开装: { py: 'fēnkāi zhuāng', en: 'pack separately' },
    满50减5: { py: 'mǎn wǔshí jiǎn wǔ', en: '¥5 off when you spend ¥50' },
    满80减10: { py: 'mǎn bāshí jiǎn shí', en: '¥10 off when you spend ¥80' },
    满50元可用: { py: 'mǎn wǔshí yuán kěyòng', en: 'for orders of ¥50 or more' },
    满80元可用: { py: 'mǎn bāshí yuán kěyòng', en: 'for orders of ¥80 or more' },
    // the friend's words
    帮我点: { py: 'bāng wǒ diǎn', en: 'order for me', hsk: ['帮', '我', '点'] },
    帮我: { py: 'bāng wǒ', en: 'for me', hsk: ['帮', '我'] },
    买: { py: 'mǎi', en: 'buy', hsk: ['买'] },
    我要: { py: 'wǒ yào', en: 'I want', hsk: ['我', '要'] },
    小碗的: { py: 'xiǎo wǎn de', en: 'a small bowl of', hsk: ['小', '碗', '的'] },
    大碗的: { py: 'dà wǎn de', en: 'a large bowl of', hsk: ['大', '碗', '的'] },
    再要: { py: 'zài yào', en: 'and also', hsk: ['再', '要'] },
    都要: { py: 'dōu yào', en: 'both', hsk: ['都', '要'] },
    都不要香菜: { py: 'dōu bú yào xiāngcài', en: 'no coriander in either', hsk: ['都', '不', '要', '菜'] },
    带走: { py: 'dàizǒu', en: 'to take away', note: 'choose 打包', hsk: ['走'] },
    在店里吃: { py: 'zài diàn lǐ chī', en: 'eat in the shop', note: 'choose 堂食', hsk: ['在', '里', '吃'] },
    用一下优惠券: { py: 'yòng yíxià yōuhuìquàn', en: 'use a coupon', hsk: ['用', '一下'] },
    一杯: { py: 'yì bēi', en: 'a cup of', hsk: ['一', '杯'] },
  },
};
