import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 点都德 — Guangzhou morning tea (早茶): dim sum and 烧味 (roast meats), as a
 * real 早茶 house serves them, ordered by the code on the table.
 *
 * Before the menu opens the table chooses its tea, and 茶位费 is charged per
 * person for it. Dim sum comes by the basket (笼), 肠粉 by the 份, congee by
 * the 碗; the roast birds by 例牌 (the standard plate), 半只 or 一只, each at
 * its own price; 烧味双拼饭 asks for exactly two meats. Cantonese dish names
 * are read in Mandarin here.
 */

const dish = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'photo'>): MenuItem => ({
  desc: '',
  groups: [],
  ...o,
});
const basket = { unit: '笼' };
const bird = (half: number, whole: number) => ({ groups: ['bird'], prices: { half, whole } });

const items: MenuItem[] = [
  dish({ id: 'har-gow', zh: '虾饺皇', call: '虾饺', cats: ['top', 'steamed'], price: 42, photo: 'har-gow', desc: '一笼四只，非遗点心', tags: ['招牌'], ...basket, sold: 6000 }),
  dish({ id: 'siu-mai', zh: '干蒸烧卖', call: '烧卖', cats: ['top', 'steamed'], price: 32, photo: 'siu-mai', desc: '猪肉和虾仁', ...basket, sold: 4200 }),
  dish({ id: 'char-siu-bao', zh: '蜜汁叉烧包', call: '叉烧包', cats: ['top', 'steamed'], price: 26, photo: 'char-siu-bao', desc: '一笼三个', tags: ['招牌'], ...basket, hsk: ['包子'], sold: 5000 }),
  dish({ id: 'custard-bun', zh: '流沙包', cats: ['steamed'], price: 24, photo: 'custard-bun', desc: '咸蛋黄流心', ...basket, hsk: ['包子'], sold: 2400 }),
  dish({ id: 'chicken-feet', zh: '豉汁蒸凤爪', call: '凤爪', cats: ['steamed'], price: 26, photo: 'chicken-feet', desc: '凤爪就是鸡爪', ...basket, sold: 3000 }),
  dish({ id: 'spare-ribs', zh: '豉汁蒸排骨', call: '排骨', cats: ['steamed'], price: 28, photo: 'spare-ribs', ...basket, hsk: ['肉'], sold: 2600 }),
  dish({ id: 'lotus-rice', zh: '糯米鸡', cats: ['steamed'], price: 26, photo: 'lotus-rice', desc: '荷叶包着的糯米', ...basket, hsk: ['鸡'], sold: 1800 }),
  dish({ id: 'ma-lai-go', zh: '马拉糕', cats: ['steamed'], price: 18, photo: 'sponge-cake', ...basket, hsk: ['蛋糕'], sold: 900 }),
  dish({ id: 'turnip-cake', zh: '萝卜糕', cats: ['fried'], price: 22, photo: 'turnip-cake', desc: '煎得香香的', sold: 1700 }),
  dish({ id: 'spring-roll', zh: '春卷', cats: ['fried'], price: 20, photo: 'spring-roll', sold: 1100 }),
  dish({ id: 'ham-sui-gok', zh: '咸水角', cats: ['fried'], price: 22, photo: 'ham-sui-gok', sold: 700 }),
  dish({ id: 'shrimp-roll', zh: '鲜虾肠粉', call: '虾肠粉', cats: ['roll'], price: 32, photo: 'cheung-fun', sold: 3600 }),
  dish({ id: 'char-siu-roll', zh: '叉烧肠粉', cats: ['roll'], price: 26, photo: 'rice-roll', sold: 2000 }),
  dish({ id: 'red-rice-roll', zh: '金沙海虾红米肠', call: '红米肠', cats: ['top', 'roll'], price: 38, photo: 'crispy-rice-roll', desc: '红米皮包着脆虾', tags: ['招牌'], sold: 3900 }),
  dish({ id: 'century-congee', zh: '皮蛋瘦肉粥', cats: ['congee'], price: 22, photo: 'congee', unit: '碗', hsk: ['粥', '肉'], sold: 2500 }),
  dish({ id: 'boat-congee', zh: '艇仔粥', cats: ['congee'], price: 24, photo: 'boat-congee', unit: '碗', desc: '广州的老味道', hsk: ['粥'], sold: 1400 }),
  dish({ id: 'char-siu', zh: '蜜汁叉烧', call: '叉烧', cats: ['top', 'roast'], price: 58, photo: 'char-siu', desc: '例牌一份', hsk: ['肉'], sold: 3300 }),
  dish({ id: 'roast-pork', zh: '脆皮烧肉', call: '烧肉', cats: ['roast'], price: 58, photo: 'roast-pork', desc: '例牌一份', hsk: ['肉'], sold: 1900 }),
  dish({ id: 'roast-goose', zh: '烧鹅', cats: ['roast'], price: 68, photo: 'roast-goose', desc: '例牌、半只或一只', ...bird(118, 228), sold: 2700 }),
  dish({ id: 'white-chicken', zh: '白切鸡', cats: ['roast'], price: 58, photo: 'white-chicken', desc: '例牌、半只或一只', ...bird(88, 168), hsk: ['鸡'], sold: 2200 }),
  dish({ id: 'soy-chicken', zh: '豉油鸡', cats: ['roast'], price: 58, photo: 'soy-chicken', desc: '例牌、半只或一只', ...bird(88, 168), hsk: ['鸡'], sold: 1300 }),
  dish({ id: 'double-rice', zh: '烧味双拼饭', call: '双拼饭', cats: ['roast'], price: 42, photo: 'roast-rice', desc: '两样烧味配米饭', groups: ['two'], hsk: ['米饭'], sold: 2000 }),
  dish({ id: 'char-siu-rice', zh: '叉烧饭', cats: ['roast'], price: 32, photo: 'char-siu-rice', hsk: ['饭'], sold: 1500 }),
  dish({ id: 'egg-tart', zh: '蛋挞', cats: ['dessert'], price: 18, photo: 'egg-tart', desc: '一份三个', sold: 4100 }),
  dish({ id: 'double-milk', zh: '双皮奶', cats: ['dessert'], price: 18, photo: 'milk-pudding', unit: '碗', hsk: ['牛奶'], sold: 1600 }),
  dish({ id: 'mango-pudding', zh: '芒果布丁', cats: ['dessert'], price: 16, photo: 'mango-pudding', sold: 900 }),
];

/* ------------------------------------------------------------- templates */

const TEA_SAY: Record<string, [string, string]> = {
  puer: ['普洱', "pu'er"],
  tgy: ['铁观音', 'Tieguanyin'],
  chrys: ['菊花', 'chrysanthemum'],
  jasmine: ['香片', 'jasmine'],
  jupu: ['菊普', "chrysanthemum pu'er"],
};
const PEOPLE = ['', '一个人', '两个人', '三个人', '四个人', '五个人'];
const PEOPLE_EN = ['', 'just me', 'two of us', 'three of us', 'four of us', 'five of us'];
const BIRD_SAY: Record<string, [string, string]> = {
  plate: ['例牌', 'a standard plate of'],
  half: ['半只', 'half a'],
  whole: ['一只', 'a whole'],
};
const NOTES: [string, string][] = [
  ['走葱', 'no spring onion'],
  ['少辣', 'less chilli'],
  ['不要香菜', 'no coriander'],
];

const byCat = (b: Brand, c: string) => b.items.filter((i) => i.cats.includes(c));
const steamed = (b: Brand) => byCat(b, 'steamed');
const birds = (b: Brand) => b.items.filter((i) => i.groups.includes('bird'));
const call = (i: MenuItem) => i.call ?? i.zh;
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;
const people = (p: TemplatePick) => 2 + p.int(3);
const teaOf = (p: TemplatePick) => {
  const id = p.pick(Object.keys(TEA_SAY));
  return { id, zh: TEA_SAY[id][0], en: TEA_SAY[id][1] };
};
/** 我们三个人，喝普洱。 — every table order starts with how many and the tea. */
const opening = (p: TemplatePick) => {
  const n = people(p);
  const t = teaOf(p);
  return {
    n,
    zh: `我们${PEOPLE[n]}，喝${t.zh}。`,
    en: `There are ${PEOPLE_EN[n]}, drinking ${t.en} tea.`,
    parts: [PEOPLE[n], t.zh],
    wants: [{ kind: 'diners', n }, { kind: 'tea', value: t.id }] as Want[],
  };
};
const birdOf = (p: TemplatePick) => {
  const i = p.pick(birds(p.brand));
  const id = p.pick(['half', 'whole']);
  return { i, id, zh: `${BIRD_SAY[id][0]}${call(i)}`, say: BIRD_SAY[id][0], en: `${BIRD_SAY[id][1]} ${enOf(p.brand, call(i))}` };
};
const meats = (p: TemplatePick) => p.sample(p.brand.groups.two.options, 2);

const templates: TaskTemplate[] = [
  {
    id: 'one-basket',
    level: 1,
    build: (p) => {
      const o = opening(p);
      const i = p.pick(steamed(p.brand));
      return {
        message: `${o.zh}要一笼${call(i)}。`,
        en: `${o.en} We want a basket of ${enOf(p.brand, call(i))}.`,
        parts: [...o.parts, '一笼', call(i)],
        wants: [...o.wants, { kind: 'line', item: i.id, qty: 1, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'two-baskets',
    level: 1,
    build: (p) => {
      const o = opening(p);
      const i = p.pick(steamed(p.brand));
      return {
        message: `${o.zh}要两笼${call(i)}。`,
        en: `${o.en} We want two baskets of ${enOf(p.brand, call(i))}.`,
        parts: [...o.parts, '两笼', call(i)],
        wants: [...o.wants, { kind: 'line', item: i.id, qty: 2, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'basket-and-roll',
    level: 2,
    build: (p) => {
      const o = opening(p);
      const a = p.pick(steamed(p.brand));
      const r = p.pick(byCat(p.brand, 'roll'));
      return {
        message: `${o.zh}一笼${call(a)}，一份${call(r)}。`,
        en: `${o.en} A basket of ${enOf(p.brand, call(a))} and a ${enOf(p.brand, call(r))}.`,
        parts: [...o.parts, '一笼', call(a), '一份', call(r)],
        wants: [...o.wants, { kind: 'line', item: a.id, qty: 1, choices: {} }, { kind: 'line', item: r.id, qty: 1, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'bird',
    level: 2,
    build: (p) => {
      const o = opening(p);
      const b = birdOf(p);
      return {
        message: `${o.zh}要${b.zh}。`,
        en: `${o.en} We want ${b.en}.`,
        parts: [...o.parts, b.say, call(b.i)],
        wants: [...o.wants, { kind: 'line', item: b.i.id, qty: 1, choices: { bird: b.id } }] as Want[],
      };
    },
  },
  {
    id: 'congee-note',
    level: 2,
    build: (p) => {
      const o = opening(p);
      const c = p.pick(byCat(p.brand, 'congee'));
      const [note, noteEn] = p.pick(NOTES);
      return {
        message: `${o.zh}一碗${call(c)}，${note}。`,
        en: `${o.en} A bowl of ${enOf(p.brand, call(c))} — ${noteEn}.`,
        parts: [...o.parts, '一碗', call(c), note],
        wants: [...o.wants, { kind: 'line', item: c.id, qty: 1, choices: {} }, { kind: 'note', value: note }] as Want[],
      };
    },
  },
  {
    id: 'double-rice',
    level: 2,
    build: (p) => {
      const o = opening(p);
      const [m1, m2] = meats(p);
      return {
        message: `${o.zh}一个烧味双拼饭，要${m1.zh}和${m2.zh}。`,
        en: `${o.en} A two-roast-meat rice with ${enOf(p.brand, m1.zh)} and ${enOf(p.brand, m2.zh)}.`,
        parts: [...o.parts, '双拼饭', m1.zh, m2.zh],
        wants: [...o.wants, { kind: 'line', item: 'double-rice', qty: 1, choices: { two: [m1.id, m2.id] } }] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: (p) => {
      const t = teaOf(p);
      const a = p.pick(steamed(p.brand));
      const c = p.pick(byCat(p.brand, 'congee'));
      // the tea is ¥8 a head — the budget only works once it is counted
      const total = 16 + a.price + c.price;
      const budget = Math.ceil(total / 10) * 10;
      return {
        message: `我们两个人，只有${budget}块。喝${t.zh}，要一笼${call(a)}和一碗${call(c)}。`,
        en: `There are two of us with only ¥${budget}. We'll drink ${t.en}: a basket of ${enOf(p.brand, call(a))} and a bowl of ${enOf(p.brand, call(c))}. (The tea is charged per person.)`,
        parts: ['两个人', `${budget}块`, t.zh, '一笼', call(a), '一碗', call(c)],
        wants: [
          { kind: 'diners', n: 2 },
          { kind: 'tea', value: t.id },
          { kind: 'line', item: a.id, qty: 1, choices: {} },
          { kind: 'line', item: c.id, qty: 1, choices: {} },
          { kind: 'budget', max: budget },
        ] as Want[],
      };
    },
  },
  {
    id: 'three-with-bird',
    level: 3,
    build: (p) => {
      const o = opening(p);
      const [a, b] = p.sample(steamed(p.brand), 2);
      const bd = birdOf(p);
      const [note, noteEn] = p.pick(NOTES);
      return {
        message: `${o.zh}一笼${call(a)}，一笼${call(b)}，${bd.zh}，${note}。`,
        en: `${o.en} A basket of ${enOf(p.brand, call(a))}, a basket of ${enOf(p.brand, call(b))}, ${bd.en} — ${noteEn}.`,
        parts: [...o.parts, call(a), call(b), bd.say, call(bd.i), note],
        wants: [
          ...o.wants,
          { kind: 'line', item: a.id, qty: 1, choices: {} },
          { kind: 'line', item: b.id, qty: 1, choices: {} },
          { kind: 'line', item: bd.i.id, qty: 1, choices: { bird: bd.id } },
          { kind: 'note', value: note },
        ] as Want[],
      };
    },
  },
  {
    id: 'baskets-roll-tarts',
    level: 3,
    build: (p) => {
      const o = opening(p);
      const a = p.pick(steamed(p.brand));
      const r = p.pick(byCat(p.brand, 'roll'));
      return {
        message: `${o.zh}两笼${call(a)}，一份${call(r)}，两份蛋挞。`,
        en: `${o.en} Two baskets of ${enOf(p.brand, call(a))}, a ${enOf(p.brand, call(r))} and two portions of egg tarts.`,
        parts: [...o.parts, '两笼', call(a), '一份', call(r), '两份', '蛋挞'],
        wants: [
          ...o.wants,
          { kind: 'line', item: a.id, qty: 2, choices: {} },
          { kind: 'line', item: r.id, qty: 1, choices: {} },
          { kind: 'line', item: 'egg-tart', qty: 2, choices: {} },
        ] as Want[],
      };
    },
  },
  {
    id: 'meal-then-more',
    level: 4,
    build: (p) => {
      const o = opening(p);
      const [a, b, c] = p.sample(steamed(p.brand), 3);
      const bd = birdOf(p);
      return {
        message: `${o.zh}先来一笼${call(a)}、一笼${call(b)}和${bd.zh}。`,
        en: `${o.en} To start: a basket of ${enOf(p.brand, call(a))}, a basket of ${enOf(p.brand, call(b))} and ${bd.en}.`,
        parts: [...o.parts, call(a), call(b), bd.say, call(bd.i)],
        wants: [
          ...o.wants,
          { kind: 'line', item: a.id, qty: 1, choices: {} },
          { kind: 'line', item: b.id, qty: 1, choices: {} },
          { kind: 'line', item: bd.i.id, qty: 1, choices: { bird: bd.id } },
        ] as Want[],
        later: {
          message: `再加一笼${call(c)}和两份蛋挞吧。`,
          en: `Let's add a basket of ${enOf(p.brand, call(c))} and two portions of egg tarts.`,
          parts: ['加菜', '一笼', call(c), '两份', '蛋挞'],
          wants: [
            { kind: 'line', item: c.id, qty: 1, choices: {} },
            { kind: 'line', item: 'egg-tart', qty: 2, choices: {} },
          ] as Want[],
        },
      };
    },
  },
  {
    id: 'meal-then-roast',
    level: 4,
    build: (p) => {
      const o = opening(p);
      const r = p.pick(byCat(p.brand, 'roll'));
      const c = p.pick(byCat(p.brand, 'congee'));
      const [m1, m2] = meats(p);
      return {
        message: `${o.zh}一份${call(r)}，一碗${call(c)}，走葱。`,
        en: `${o.en} A ${enOf(p.brand, call(r))} and a bowl of ${enOf(p.brand, call(c))} — no spring onion.`,
        parts: [...o.parts, '一份', call(r), '一碗', call(c), '走葱'],
        wants: [
          ...o.wants,
          { kind: 'line', item: r.id, qty: 1, choices: {} },
          { kind: 'line', item: c.id, qty: 1, choices: {} },
          { kind: 'note', value: '走葱' },
        ] as Want[],
        later: {
          message: `再来一个烧味双拼饭，要${m1.zh}和${m2.zh}。`,
          en: `And a two-roast-meat rice, with ${enOf(p.brand, m1.zh)} and ${enOf(p.brand, m2.zh)}.`,
          parts: ['加菜', '双拼饭', m1.zh, m2.zh],
          wants: [{ kind: 'line', item: 'double-rice', qty: 1, choices: { two: [m1.id, m2.id] } }] as Want[],
        },
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

export const dimsum: Brand = {
  id: 'dimsum',
  model: 'table',
  name: '点都德',
  latin: 'Dian Dou De',
  merchant: '点都德',
  pitch: 'Morning tea (早茶) in Guangzhou style: choose the tea, order dim sum by the basket and roast meats by the plate, add more, and pay.',
  colours: { brand: '#8c2a1f', soft: '#f5e5de', ink: '#ffffff', darkBrand: '#e39584', darkSoft: '#3a221d' },
  store: { zh: '广州聚福楼', distance: '' },
  table: { no: '18', tea: 'tea' },
  categories: [
    { id: 'top', zh: '招牌点心' },
    { id: 'steamed', zh: '蒸点' },
    { id: 'fried', zh: '煎炸' },
    { id: 'roll', zh: '肠粉' },
    { id: 'congee', zh: '粥' },
    { id: 'roast', zh: '烧味' },
    { id: 'dessert', zh: '甜品' },
  ],
  items,
  groups: {
    tea: {
      id: 'tea',
      zh: '茶',
      kind: 'one',
      required: true,
      options: [
        { id: 'puer', zh: '普洱' },
        { id: 'tgy', zh: '铁观音' },
        { id: 'chrys', zh: '菊花' },
        { id: 'jasmine', zh: '香片' },
        { id: 'jupu', zh: '菊普', sub: '普洱加菊花' },
      ],
    },
    bird: {
      id: 'bird',
      zh: '份量',
      kind: 'one',
      required: true,
      default: 'plate',
      options: [
        { id: 'plate', zh: '例牌' },
        { id: 'half', zh: '半只' },
        { id: 'whole', zh: '一只' },
      ],
    },
    two: {
      id: 'two',
      zh: '选两样烧味',
      kind: 'many',
      required: true,
      pick: 2,
      options: [
        { id: 'char-siu', zh: '叉烧' },
        { id: 'roast-pork', zh: '烧肉' },
        { id: 'goose', zh: '烧鹅' },
        { id: 'white-chicken', zh: '白切鸡' },
        { id: 'soy-chicken', zh: '豉油鸡' },
      ],
    },
  },
  rules: [],
  coupons: [],
  fees: [{ zh: '茶位费', amount: 8, per: 'person' }],
  notes: ['走葱', '少辣', '加辣', '不要香菜', '打包'],
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'landing', zh: '人数和选茶', en: 'diners and tea' },
    { id: 'menu', zh: '点心单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'options' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认下单', en: 'send the order' },
    { id: 'table', zh: '加菜', en: 'at the table' },
    { id: 'bill', zh: '买单', en: 'the bill' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '买单成功', en: 'paid' },
  ],
  tips: {
    chat: '早茶 is a long, slow breakfast of tea and dim sum. Here the friend says how many, and which tea.',
    landing: 'Every table chooses a tea, and 茶位费 (¥8 a head) is charged per person for it. 菊普 is 普洱 with chrysanthemum.',
    menu: 'Dim sum comes by the basket (一笼), usually three or four pieces. 烧味 are the roast meats.',
    spec: '例牌 is the standard plate; 半只 is half a bird, 一只 a whole one — each has its own price. 双拼 is two meats on one rice.',
    cart: 'Everything here goes to the kitchen together when you tap 下单.',
    checkout: '走葱 is Cantonese for "no spring onion": 走 means "without". It goes in 备注.',
    table: 'When someone pours your tea, tap two fingers on the table to say thanks. Leave the teapot lid ajar and a waiter will bring more hot water.',
    bill: 'The bill adds 茶位费 for every person to the food.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'Paid. 欢迎再次光临 — welcome back.',
  },
  tour: [
    { target: 'rail', zh: '点心单', en: 'Steamed, fried, rice rolls, congee, roast meats, desserts.' },
    { target: 'add', zh: '选规格', en: '选规格 opens the choices: 例牌 / 半只 / 一只, or two meats for 双拼.' },
    { target: 'cart-bar', zh: '购物车', en: 'What you have chosen so far.' },
    { target: 'checkout-btn', zh: '选好了', en: '选好了 — done choosing. Then 下单 sends it to the kitchen.' },
  ],
  words: [
    { en: 'Tea', words: ['选茶', '茶位费', '普洱', '铁观音', '菊花', '香片', '菊普'] },
    { en: 'Dim sum', words: ['点心', '虾饺皇', '干蒸烧卖', '蜜汁叉烧包', '豉汁蒸凤爪', '萝卜糕', '肠粉', '粥', '蛋挞', '一笼'] },
    { en: 'Roast meats', words: ['烧味', '烧鹅', '白切鸡', '叉烧', '烧肉', '例牌', '半只', '一只', '双拼饭'] },
    { en: 'At the table', words: ['就餐人数', '下单', '加菜', '走葱', '少辣', '加辣', '去买单'] },
  ],
  templates,
  photos: {
    'mango-pudding': {},
    'char-siu-rice': {},
    'soy-chicken': {},
    'boat-congee': {},
    'crispy-rice-roll': {},
    'rice-roll': {},
    'ham-sui-gok': {},
    'custard-bun': {},
    'har-gow': {},
    'siu-mai': {},
    'char-siu-bao': { word: '包子' },
    'chicken-feet': {},
    'spare-ribs': {},
    'lotus-rice': {},
    'sponge-cake': {},
    'turnip-cake': {},
    'spring-roll': {},
    'cheung-fun': {},
    congee: {},
    'char-siu': {},
    'roast-pork': {},
    'roast-goose': {},
    'white-chicken': {},
    'roast-rice': {},
    'egg-tart': {},
    'milk-pudding': {},
    'dimsum-banner': { word: '茶' },
  },
  banner: { photo: 'dimsum-banner', zh: '一盅两件', sub: '广式早茶' },
  friend: '阿明',
  glossary: {
    点都德: { py: 'Diǎn Dōu Dé', en: 'Dian Dou De (a Guangzhou teahouse)', note: 'Cantonese for "anything goes"' },
    阿明: { py: 'Ā Míng', en: 'Ah Ming (your friend)', note: '阿 before a name is a Cantonese nickname' },
    广州聚福楼: { py: 'Guǎngzhōu Jùfú lóu', en: 'the Jufu teahouse, Guangzhou', hsk: ['楼'] },
    一盅两件: { py: 'yì zhōng liǎng jiàn', en: '"one pot, two pieces"', note: 'the classic 早茶: a pot of tea and two dim sum', hsk: ['两', '件'] },
    广式早茶: { py: 'Guǎng shì zǎochá', en: 'Cantonese morning tea', hsk: ['茶'] },
    早茶: { py: 'zǎochá', en: 'morning tea (dim sum breakfast)', hsk: ['茶'] },
    点心: { py: 'diǎnxin', en: 'dim sum' },
    点心单: { py: 'diǎnxin dān', en: 'the dim sum menu' },
    人数和选茶: { py: 'rénshù hé xuǎn chá', en: 'diners and tea', hsk: ['和', '茶'] },
    // categories
    招牌点心: { py: 'zhāopái diǎnxin', en: 'signature dim sum' },
    招牌: { py: 'zhāopái', en: 'signature' },
    蒸点: { py: 'zhēng diǎn', en: 'steamed dim sum' },
    煎炸: { py: 'jiān zhá', en: 'fried' },
    肠粉: { py: 'chángfěn', en: 'rice-noodle rolls' },
    粥: { py: 'zhōu', en: 'congee (rice porridge)', hsk: ['粥'] },
    烧味: { py: 'shāowèi', en: 'Cantonese roast meats' },
    甜品: { py: 'tiánpǐn', en: 'desserts', hsk: ['甜'] },
    // items
    虾饺皇: { py: 'xiājiǎo huáng', en: 'king prawn dumplings (har gow)', note: 'the test of a good teahouse' },
    虾饺: { py: 'xiājiǎo', en: 'prawn dumplings', note: 'on the menu as 虾饺皇' },
    干蒸烧卖: { py: 'gān zhēng shāomài', en: 'pork and prawn siu mai' },
    烧卖: { py: 'shāomài', en: 'siu mai', note: 'on the menu as 干蒸烧卖' },
    蜜汁叉烧包: { py: 'mìzhī chāshāo bāo', en: 'barbecue pork buns (char siu bao)', hsk: ['包子'] },
    叉烧包: { py: 'chāshāo bāo', en: 'barbecue pork buns', note: 'on the menu as 蜜汁叉烧包' },
    流沙包: { py: 'liúshā bāo', en: 'salted egg custard buns' },
    豉汁蒸凤爪: { py: 'chǐzhī zhēng fèngzhǎo', en: 'steamed chicken feet in black bean sauce' },
    凤爪: { py: 'fèngzhǎo', en: 'chicken feet', note: 'literally "phoenix claws"' },
    豉汁蒸排骨: { py: 'chǐzhī zhēng páigǔ', en: 'steamed spare ribs in black bean sauce' },
    排骨: { py: 'páigǔ', en: 'spare ribs' },
    糯米鸡: { py: 'nuòmǐ jī', en: 'sticky rice in lotus leaf', hsk: ['鸡'] },
    马拉糕: { py: 'mǎlā gāo', en: 'Malay sponge cake' },
    萝卜糕: { py: 'luóbo gāo', en: 'turnip cake' },
    春卷: { py: 'chūnjuǎn', en: 'spring rolls', hsk: ['春'] },
    咸水角: { py: 'xiánshuǐ jiǎo', en: 'fried glutinous dumplings' },
    鲜虾肠粉: { py: 'xiān xiā chángfěn', en: 'prawn rice-noodle roll' },
    虾肠粉: { py: 'xiā chángfěn', en: 'prawn rice-noodle roll', note: 'on the menu as 鲜虾肠粉' },
    叉烧肠粉: { py: 'chāshāo chángfěn', en: 'barbecue pork rice-noodle roll' },
    金沙海虾红米肠: { py: 'jīnshā hǎixiā hóngmǐ cháng', en: 'crispy prawn red-rice roll', note: 'the house signature' },
    红米肠: { py: 'hóngmǐ cháng', en: 'red-rice roll', note: 'on the menu as 金沙海虾红米肠' },
    皮蛋瘦肉粥: { py: 'pídàn shòuròu zhōu', en: 'century egg and pork congee', hsk: ['粥', '肉'] },
    艇仔粥: { py: 'tǐngzǎi zhōu', en: '"sampan" congee', note: 'fish, squid and peanuts', hsk: ['粥'] },
    蜜汁叉烧: { py: 'mìzhī chāshāo', en: 'honey barbecue pork (char siu)' },
    叉烧: { py: 'chāshāo', en: 'barbecue pork (char siu)' },
    脆皮烧肉: { py: 'cuìpí shāoròu', en: 'crispy roast pork belly', hsk: ['肉'] },
    烧肉: { py: 'shāoròu', en: 'crispy roast pork', hsk: ['肉'] },
    烧鹅: { py: 'shāo’é', en: 'roast goose' },
    白切鸡: { py: 'báiqiē jī', en: 'white-cut (poached) chicken', hsk: ['白', '鸡'] },
    豉油鸡: { py: 'chǐyóu jī', en: 'soy sauce chicken', hsk: ['鸡'] },
    烧味双拼饭: { py: 'shāowèi shuāngpīn fàn', en: 'rice with two roast meats', hsk: ['饭'] },
    双拼饭: { py: 'shuāngpīn fàn', en: 'rice with two roast meats', note: 'on the menu as 烧味双拼饭', hsk: ['饭'] },
    叉烧饭: { py: 'chāshāo fàn', en: 'barbecue pork rice', hsk: ['饭'] },
    蛋挞: { py: 'dàntà', en: 'egg tarts' },
    双皮奶: { py: 'shuāngpí nǎi', en: 'double-skin milk pudding' },
    芒果布丁: { py: 'mángguǒ bùdīng', en: 'mango pudding' },
    // descriptions
    '一笼四只，非遗点心': { py: 'yì lóng sì zhī, fēiyí diǎnxin', en: 'four to a basket — heritage dim sum', hsk: ['四', '只'] },
    猪肉和虾仁: { py: 'zhūròu hé xiārén', en: 'pork and prawn', hsk: ['肉', '和'] },
    一笼三个: { py: 'yì lóng sān ge', en: 'three to a basket', hsk: ['三', '个'] },
    咸蛋黄流心: { py: 'xián dànhuáng liú xīn', en: 'runny salted-egg-yolk filling' },
    凤爪就是鸡爪: { py: 'fèngzhǎo jiù shì jī zhuǎ', en: '"phoenix claws" are chicken feet', hsk: ['就', '是', '鸡'] },
    荷叶包着的糯米: { py: 'héyè bāozhe de nuòmǐ', en: 'sticky rice wrapped in a lotus leaf', hsk: ['的'] },
    煎得香香的: { py: 'jiān de xiāngxiāng de', en: 'pan-fried till fragrant', hsk: ['得', '的'] },
    红米皮包着脆虾: { py: 'hóngmǐ pí bāozhe cuì xiā', en: 'crispy prawn wrapped in red-rice skin', hsk: ['红'] },
    广州的老味道: { py: 'Guǎngzhōu de lǎo wèidào', en: 'the old taste of Guangzhou', hsk: ['的', '老'] },
    例牌一份: { py: 'lìpái yí fèn', en: 'one standard plate', hsk: ['一', '份'] },
    '例牌、半只或一只': { py: 'lìpái, bàn zhī huò yì zhī', en: 'a plate, half a bird or a whole one', hsk: ['半', '只', '或', '一'] },
    两样烧味配米饭: { py: 'liǎng yàng shāowèi pèi mǐfàn', en: 'two roast meats on rice', hsk: ['两', '米饭'] },
    一份三个: { py: 'yí fèn sān ge', en: 'three in a portion', hsk: ['一', '份', '三', '个'] },
    // groups and options
    茶: { py: 'chá', en: 'Tea', hsk: ['茶'] },
    普洱: { py: 'pǔ’ěr', en: "pu'er", note: 'dark, earthy — the classic with greasy food' },
    铁观音: { py: 'tiěguānyīn', en: 'Tieguanyin (an oolong)' },
    菊花: { py: 'júhuā', en: 'chrysanthemum', hsk: ['花'] },
    香片: { py: 'xiāngpiàn', en: 'jasmine tea', note: 'the northern name for jasmine tea' },
    菊普: { py: 'jú pǔ', en: "chrysanthemum pu'er" },
    普洱加菊花: { py: 'pǔ’ěr jiā júhuā', en: "pu'er with chrysanthemum", hsk: ['花'] },
    份量: { py: 'fènliàng', en: 'Portion' },
    例牌: { py: 'lìpái', en: 'standard plate', note: 'Cantonese menus: the regular size, sliced on a plate' },
    半只: { py: 'bàn zhī', en: 'half a bird', hsk: ['半', '只'] },
    一只: { py: 'yì zhī', en: 'a whole bird', hsk: ['一', '只'] },
    选两样烧味: { py: 'xuǎn liǎng yàng shāowèi', en: 'Choose two roast meats', hsk: ['两'] },
    // notes
    走葱: { py: 'zǒu cōng', en: 'no spring onion', note: 'Cantonese: 走 = "without"', hsk: ['走', '葱'] },
    少辣: { py: 'shǎo là', en: 'less chilli', hsk: ['少', '辣'] },
    加辣: { py: 'jiā là', en: 'extra chilli', hsk: ['辣'] },
    不要香菜: { py: 'bú yào xiāngcài', en: 'no coriander', hsk: ['不', '要', '菜'] },
    打包: { py: 'dǎbāo', en: 'box up the leftovers' },
    // the friend's words
    喝: { py: 'hē', en: 'drink', hsk: ['喝'] },
    一笼: { py: 'yì lóng', en: 'a basket of', hsk: ['一'] },
    两笼: { py: 'liǎng lóng', en: 'two baskets of', note: '两, not 二, before a measure word', hsk: ['两'] },
    三笼: { py: 'sān lóng', en: 'three baskets of', hsk: ['三'] },
    先来: { py: 'xiān lái', en: 'to start, bring', hsk: ['先', '来'] },
    再来: { py: 'zài lái', en: 'and bring', hsk: ['再', '来'] },
  },
};
