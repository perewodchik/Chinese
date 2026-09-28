import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 海底捞 — hotpot, ordered on the tablet or by the code on the table.
 *
 * How many come first; the sauce bar (调料) is then charged per person on
 * the bill. The soup base (锅底) is one soup (单锅), two in a split pot (鸳鸯锅)
 * or four in a 四宫格 — choosing 麻辣 anywhere brings up 辣度. Every dish
 * comes as 整份 or 半份, a half portion at about 60% of the price, so a small
 * table can try more.
 */

const dish = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'photo'>): MenuItem => ({
  desc: '',
  groups: ['portion'],
  ...o,
});

const items: MenuItem[] = [
  { id: 'single', zh: '单锅', cats: ['pot'], price: 48, photo: 'single-pot', desc: '一种锅底', groups: ['base', 'spice'], sold: 5000 },
  { id: 'split', zh: '鸳鸯锅', cats: ['pot'], price: 88, photo: 'hotpot', desc: '一个锅，两种锅底', tags: ['人气'], groups: ['pair', 'spice'], sold: 8000 },
  { id: 'four', zh: '四宫格', cats: ['pot'], price: 98, photo: 'grid-hotpot', desc: '四种锅底，一次都尝', groups: ['four', 'spice'], sold: 3000 },
  dish({ id: 'beef', zh: '精品肥牛', call: '肥牛', cats: ['meat'], price: 58, photo: 'sliced-beef-raw', tags: ['招牌'], hsk: ['牛'], sold: 9000 }),
  dish({ id: 'lamb', zh: '羊肉卷', cats: ['meat'], price: 52, photo: 'lamb-rolls', hsk: ['肉'], sold: 5000 }),
  dish({ id: 'tripe', zh: '鲜毛肚', call: '毛肚', cats: ['meat'], price: 58, photo: 'tripe', desc: '七上八下，十五秒', sold: 6000 }),
  dish({ id: 'duck-blood', zh: '鸭血', cats: ['meat'], price: 26, photo: 'duck-blood', sold: 3000 }),
  dish({ id: 'luncheon', zh: '午餐肉', cats: ['meat'], price: 28, photo: 'luncheon-meat', hsk: ['肉'], sold: 4000 }),
  dish({ id: 'duck-intestine', zh: '鸭肠', cats: ['meat'], price: 38, photo: 'duck-intestine', sold: 2000 }),
  dish({ id: 'pork-slices', zh: '猪肉片', cats: ['meat'], price: 36, photo: 'pork-slices', hsk: ['肉'], sold: 1500 }),
  dish({ id: 'shrimp-paste', zh: '虾滑', cats: ['top', 'balls'], price: 42, photo: 'shrimp-paste', desc: '服务员帮你下锅', tags: ['招牌'], sold: 8000 }),
  dish({ id: 'beef-balls', zh: '牛肉丸', cats: ['balls'], price: 32, photo: 'meatballs', hsk: ['牛', '肉'], sold: 2500 }),
  dish({ id: 'fish-balls', zh: '鱼丸', cats: ['balls'], price: 28, photo: 'fish-balls', hsk: ['鱼'], sold: 1800 }),
  dish({ id: 'potato', zh: '土豆片', cats: ['veg'], price: 16, photo: 'potato-slices', hsk: ['菜'], sold: 5000 }),
  dish({ id: 'wax-gourd', zh: '冬瓜', cats: ['veg'], price: 14, photo: 'wax-gourd', sold: 2000 }),
  dish({ id: 'tofu', zh: '嫩豆腐', cats: ['veg'], price: 16, photo: 'tofu', hsk: ['豆腐'], sold: 2500 }),
  dish({ id: 'enoki', zh: '金针菇', cats: ['veg'], price: 18, photo: 'enoki', sold: 3500 }),
  dish({ id: 'lettuce', zh: '生菜', cats: ['veg'], price: 14, photo: 'lettuce', hsk: ['菜'], sold: 2200 }),
  dish({ id: 'lotus', zh: '藕片', cats: ['veg'], price: 16, photo: 'lotus-root', sold: 1900 }),
  dish({ id: 'kelp', zh: '海带', cats: ['veg'], price: 14, photo: 'kelp-knots', sold: 1200 }),
  { id: 'dance-noodles', zh: '捞面', cats: ['staple'], price: 16, photo: 'pulled-noodles', desc: '服务员表演拉面', unit: '份', groups: [], hsk: ['面'], sold: 4000 },
  { id: 'rice', zh: '米饭', cats: ['staple'], price: 3, photo: 'rice', desc: '', unit: '碗', groups: [], hsk: ['米饭'], sold: 3000 },
  { id: 'crispy-pork', zh: '小酥肉', cats: ['top', 'snack'], price: 32, photo: 'crispy-pork', desc: '刚炸好的', groups: [], hsk: ['肉'], sold: 6000 },
  { id: 'rice-cake', zh: '红糖糍粑', cats: ['snack'], price: 26, photo: 'rice-cake', desc: '', groups: [], hsk: ['红'], sold: 3000 },
];

/* ------------------------------------------------------------- templates */

const SOUP_SAY: Record<string, [string, string]> = {
  mala: ['麻辣', 'spicy Sichuan'],
  tomato: ['番茄', 'tomato'],
  clear: ['清汤', 'clear'],
  mushroom: ['菌汤', 'mushroom'],
  pickle: ['酸菜', 'pickled cabbage'],
};
const SPICE_SAY: Record<string, [string, string]> = {
  mild: ['微辣', 'mildly spicy'],
  medium: ['中辣', 'medium'],
  hot: ['特辣', 'very spicy'],
};
const PEOPLE = ['', '一个人', '两个人', '三个人', '四个人', '五个人'];
const PEOPLE_EN = ['', 'just me', 'two of us', 'three of us', 'four of us', 'five of us'];
const PORTIONS = ['', '一份', '两份', '三份'];

const byCat = (b: Brand, c: string) => b.items.filter((i) => i.cats.includes(c));
const call = (i: MenuItem) => i.call ?? i.zh;
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;
const people = (p: TemplatePick) => 2 + p.int(3);
const diners = (n: number): Want => ({ kind: 'diners', n });
const soups = (p: TemplatePick, n: number, noMala = false) =>
  p.sample(Object.keys(SOUP_SAY).filter((s) => !noMala || s !== 'mala'), n).map((id) => ({ id, zh: SOUP_SAY[id][0], en: SOUP_SAY[id][1] }));
const spiceOf = (p: TemplatePick) => {
  const id = p.pick(Object.keys(SPICE_SAY));
  return { id, zh: SPICE_SAY[id][0], en: SPICE_SAY[id][1] };
};
const listZh = (xs: { zh: string }[]) => xs.map((x) => x.zh).join('、');
const listEn = (xs: { en: string }[]) => xs.map((x) => x.en).join(', ');

const templates: TaskTemplate[] = [
  {
    id: 'one-pot',
    level: 1,
    build: (p) => {
      const n = people(p);
      const [s] = soups(p, 1, true);
      return {
        message: `我们${PEOPLE[n]}。要一个${s.zh}锅。`,
        en: `There are ${PEOPLE_EN[n]}. We want a ${s.en} soup pot.`,
        parts: [PEOPLE[n], `${s.zh}锅`],
        wants: [diners(n), { kind: 'line', item: 'single', qty: 1, choices: { base: s.id } }] as Want[],
      };
    },
  },
  {
    id: 'mala',
    level: 1,
    build: (p) => {
      const n = people(p);
      const sp = spiceOf(p);
      return {
        message: `我们${PEOPLE[n]}。一个麻辣锅，${sp.zh}。`,
        en: `There are ${PEOPLE_EN[n]}. A spicy Sichuan pot, ${sp.en}.`,
        parts: [PEOPLE[n], '麻辣锅', sp.zh],
        wants: [diners(n), { kind: 'line', item: 'single', qty: 1, choices: { base: 'mala', spice: sp.id } }] as Want[],
      };
    },
  },
  {
    id: 'split',
    level: 2,
    build: (p) => {
      const n = people(p);
      const two = soups(p, 2, true);
      return {
        message: `我们${PEOPLE[n]}。要鸳鸯锅：${two[0].zh}和${two[1].zh}。`,
        en: `There are ${PEOPLE_EN[n]}. A split pot: ${two[0].en} and ${two[1].en}.`,
        parts: [PEOPLE[n], '鸳鸯锅', two[0].zh, two[1].zh],
        wants: [diners(n), { kind: 'line', item: 'split', qty: 1, choices: { pair: two.map((s) => s.id) } }] as Want[],
      };
    },
  },
  {
    id: 'pot-full-half',
    level: 2,
    build: (p) => {
      const n = people(p);
      const [s] = soups(p, 1, true);
      const m = p.pick(byCat(p.brand, 'meat'));
      const v = p.pick(byCat(p.brand, 'veg'));
      return {
        message: `我们${PEOPLE[n]}。一个${s.zh}锅，一份${call(m)}，半份${call(v)}。`,
        en: `There are ${PEOPLE_EN[n]}. A ${s.en} pot, a full ${enOf(p.brand, call(m))} and half a ${enOf(p.brand, call(v))}.`,
        parts: [PEOPLE[n], `${s.zh}锅`, '一份', call(m), '半份', call(v)],
        wants: [
          diners(n),
          { kind: 'line', item: 'single', qty: 1, choices: { base: s.id } },
          { kind: 'line', item: m.id, qty: 1, choices: { portion: 'full' } },
          { kind: 'line', item: v.id, qty: 1, choices: { portion: 'half' } },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-meat',
    level: 2,
    build: (p) => {
      const n = people(p);
      const m = p.pick(byCat(p.brand, 'meat'));
      return {
        message: `我们${PEOPLE[n]}。清汤锅，要两份${call(m)}，一份虾滑。`,
        en: `There are ${PEOPLE_EN[n]}. A clear soup pot, two portions of ${enOf(p.brand, call(m))} and one of shrimp paste.`,
        parts: [PEOPLE[n], '清汤锅', '两份', call(m), '一份', '虾滑'],
        wants: [
          diners(n),
          { kind: 'line', item: 'single', qty: 1, choices: { base: 'clear' } },
          { kind: 'line', item: m.id, qty: 2, choices: { portion: 'full' } },
          { kind: 'line', item: 'shrimp-paste', qty: 1, choices: { portion: 'full' } },
        ] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: (p) => {
      // two people and ¥…: the sauce bar is ¥10 each, and full portions go over
      const pairs = byCat(p.brand, 'meat').flatMap((m) => byCat(p.brand, 'veg').map((v) => [m, v] as const));
      const [m, v] = p.pick(pairs);
      const half = 48 + 20 + Math.round(m.price * 0.6 * 10) / 10 + Math.round(v.price * 0.6 * 10) / 10;
      const budget = Math.ceil(half / 10) * 10;
      const full = 48 + 20 + m.price + v.price;
      if (full <= budget) return null;
      return {
        message: `我们两个人，只有${budget}块：一个清汤锅，${call(m)}和${call(v)}。`,
        en: `There are two of us with only ¥${budget}: a clear soup pot, ${enOf(p.brand, call(m))} and ${enOf(p.brand, call(v))}. (调料 is ¥10 a head.)`,
        parts: ['两个人', `${budget}块`, '清汤锅', call(m), call(v)],
        wants: [
          diners(2),
          { kind: 'line', item: 'single', qty: 1, choices: { base: 'clear' } },
          { kind: 'line', item: m.id, qty: 1, choices: { portion: 'half' } },
          { kind: 'line', item: v.id, qty: 1, choices: { portion: 'half' } },
          { kind: 'budget', max: budget },
        ] as Want[],
      };
    },
  },
  {
    id: 'four-grid',
    level: 3,
    build: (p) => {
      const n = people(p);
      const four = soups(p, 4);
      const mala = four.some((s) => s.id === 'mala');
      const sp = spiceOf(p);
      return {
        message: `我们${PEOPLE[n]}。要四宫格：${listZh(four)}。${mala ? `麻辣的要${sp.zh}。` : ''}`,
        en: `There are ${PEOPLE_EN[n]}. A four-way pot: ${listEn(four)}.${mala ? ` The spicy one ${sp.en}.` : ''}`,
        parts: [PEOPLE[n], '四宫格', ...four.map((s) => s.zh), ...(mala ? [sp.zh] : [])],
        wants: [diners(n), { kind: 'line', item: 'four', qty: 1, choices: { four: four.map((s) => s.id), ...(mala ? { spice: sp.id } : {}) } }] as Want[],
      };
    },
  },
  {
    id: 'split-dishes',
    level: 3,
    build: (p) => {
      const n = people(p);
      const [s2] = soups(p, 1, true);
      const sp = spiceOf(p);
      const [m1, m2] = p.sample(byCat(p.brand, 'meat'), 2);
      const v = p.pick(byCat(p.brand, 'veg'));
      return {
        message: `我们${PEOPLE[n]}。鸳鸯锅，麻辣和${s2.zh}，${sp.zh}；半份${call(m1)}，半份${call(m2)}，一份${call(v)}。`,
        en: `There are ${PEOPLE_EN[n]}. A split pot, spicy and ${s2.en}, ${sp.en}; half portions of ${enOf(p.brand, call(m1))} and ${enOf(p.brand, call(m2))}, and a full ${enOf(p.brand, call(v))}.`,
        parts: [PEOPLE[n], '鸳鸯锅', '麻辣', s2.zh, sp.zh, '半份', call(m1), call(m2), '一份', call(v)],
        wants: [
          diners(n),
          { kind: 'line', item: 'split', qty: 1, choices: { pair: ['mala', s2.id], spice: sp.id } },
          { kind: 'line', item: m1.id, qty: 1, choices: { portion: 'half' } },
          { kind: 'line', item: m2.id, qty: 1, choices: { portion: 'half' } },
          { kind: 'line', item: v.id, qty: 1, choices: { portion: 'full' } },
        ] as Want[],
      };
    },
  },
  {
    id: 'meal-then-more',
    level: 4,
    build: (p) => {
      const n = 3 + p.int(3);
      const two = soups(p, 2, true);
      const [m1, m2] = p.sample(byCat(p.brand, 'meat'), 2);
      const v = p.pick(byCat(p.brand, 'veg'));
      return {
        message: `我们${PEOPLE[n]}。要一个鸳鸯锅：${two[0].zh}和${two[1].zh}。先点${call(m1)}、${call(m2)}和${call(v)}，都要半份。`,
        en: `There are ${PEOPLE_EN[n]}. A split pot: ${two[0].en} and ${two[1].en}. To start: ${enOf(p.brand, call(m1))}, ${enOf(p.brand, call(m2))} and ${enOf(p.brand, call(v))}, all half portions.`,
        parts: [PEOPLE[n], '鸳鸯锅', two[0].zh, two[1].zh, call(m1), call(m2), call(v), '半份'],
        wants: [
          diners(n),
          { kind: 'line', item: 'split', qty: 1, choices: { pair: two.map((s) => s.id) } },
          { kind: 'line', item: m1.id, qty: 1, choices: { portion: 'half' } },
          { kind: 'line', item: m2.id, qty: 1, choices: { portion: 'half' } },
          { kind: 'line', item: v.id, qty: 1, choices: { portion: 'half' } },
        ] as Want[],
        later: {
          message: `再加一份虾滑和${n}碗米饭吧。`,
          en: `Let's add a portion of shrimp paste and ${n} bowls of rice.`,
          parts: ['加菜', '一份', '虾滑', `${['', '一', '两', '三', '四', '五'][n]}碗`, '米饭'],
          wants: [
            { kind: 'line', item: 'shrimp-paste', qty: 1, choices: { portion: 'full' } },
            { kind: 'line', item: 'rice', qty: n, choices: {} },
          ] as Want[],
        },
      };
    },
  },
  {
    id: 'meal-more-meat',
    level: 4,
    build: (p) => {
      const n = 2 + p.int(3);
      const [s] = soups(p, 1, true);
      const [m1, m2] = p.sample(byCat(p.brand, 'meat'), 2);
      const v = p.pick(byCat(p.brand, 'veg'));
      return {
        message: `我们${PEOPLE[n]}。一个${s.zh}锅，一份${call(m1)}，一份${call(v)}，一份小酥肉。`,
        en: `There are ${PEOPLE_EN[n]}. A ${s.en} pot, a ${enOf(p.brand, call(m1))}, a ${enOf(p.brand, call(v))} and crispy pork.`,
        parts: [PEOPLE[n], `${s.zh}锅`, call(m1), call(v), '小酥肉'],
        wants: [
          diners(n),
          { kind: 'line', item: 'single', qty: 1, choices: { base: s.id } },
          { kind: 'line', item: m1.id, qty: 1, choices: { portion: 'full' } },
          { kind: 'line', item: v.id, qty: 1, choices: { portion: 'full' } },
          { kind: 'line', item: 'crispy-pork', qty: 1, choices: {} },
        ] as Want[],
        later: {
          message: `肉不够，再加${PORTIONS[2]}${call(m2)}。`,
          en: `Not enough meat — add two portions of ${enOf(p.brand, call(m2))}.`,
          parts: ['加菜', '两份', call(m2)],
          wants: [{ kind: 'line', item: m2.id, qty: 2, choices: { portion: 'full' } }] as Want[],
        },
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

const SOUPS = [
  { id: 'mala', zh: '麻辣' },
  { id: 'tomato', zh: '番茄' },
  { id: 'clear', zh: '清汤' },
  { id: 'mushroom', zh: '菌汤' },
  { id: 'pickle', zh: '酸菜' },
];

export const haidilao: Brand = {
  id: 'haidilao',
  model: 'table',
  name: '海底捞',
  latin: 'HAIDILAO HOT POT',
  merchant: '海底捞火锅',
  pitch: 'Hotpot for a table: how many of you, the soup (one, two or four), full or half portions, more meat halfway through — and the sauce bar per person.',
  colours: { brand: '#c8161d', soft: '#fbe4e3', ink: '#ffffff', darkBrand: '#ff7b76', darkSoft: '#3b1a1a' },
  store: { zh: '成都春熙路店', distance: '' },
  table: { no: '12' },
  categories: [
    { id: 'pot', zh: '锅底' },
    { id: 'top', zh: '招牌必点' },
    { id: 'meat', zh: '荤菜' },
    { id: 'balls', zh: '丸滑' },
    { id: 'veg', zh: '素菜' },
    { id: 'staple', zh: '主食' },
    { id: 'snack', zh: '小吃' },
  ],
  items,
  groups: {
    base: {
      id: 'base',
      zh: '锅底口味',
      kind: 'one',
      required: true,
      options: [
        { id: 'mala', zh: '麻辣', delta: 40 },
        { id: 'tomato', zh: '番茄', delta: 20 },
        { id: 'clear', zh: '清汤' },
        { id: 'mushroom', zh: '菌汤', delta: 30 },
        { id: 'pickle', zh: '酸菜', delta: 20 },
      ],
    },
    pair: { id: 'pair', zh: '选两种锅底', kind: 'many', required: true, pick: 2, options: SOUPS },
    four: { id: 'four', zh: '选四种锅底', kind: 'many', required: true, pick: 4, options: SOUPS },
    spice: {
      id: 'spice',
      zh: '辣度',
      kind: 'one',
      required: true,
      default: 'mild',
      showIf: [
        ['base', 'mala'],
        ['pair', 'mala'],
        ['four', 'mala'],
      ],
      options: [
        { id: 'mild', zh: '微辣' },
        { id: 'medium', zh: '中辣' },
        { id: 'hot', zh: '特辣' },
      ],
    },
    portion: {
      id: 'portion',
      zh: '份量',
      kind: 'one',
      required: true,
      default: 'full',
      options: [
        { id: 'full', zh: '整份' },
        { id: 'half', zh: '半份', sub: '约六折', times: 0.6 },
      ],
    },
  },
  rules: [],
  coupons: [],
  fees: [{ zh: '调料', amount: 10, per: 'person' }],
  notes: ['不要香菜', '不要葱', '多给一个碗', '生日'],
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'landing', zh: '扫码点餐', en: 'scan: table, diners' },
    { id: 'menu', zh: '菜单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'soup, portion' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认下单', en: 'send the order' },
    { id: 'table', zh: '加菜', en: 'at the table' },
    { id: 'bill', zh: '买单', en: 'the bill' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '买单成功', en: 'paid' },
  ],
  tips: {
    chat: 'Hotpot orders start with how many, then the soup base (锅底), then what to cook in it.',
    landing: '就餐人数 matters: 调料 — the sauce bar — is ¥10 per person on the bill.',
    menu: 'Order the 锅底 first. 荤菜 are meats, 素菜 vegetables, 丸滑 balls and pastes like 虾滑.',
    spec: '鸳鸯锅 is a split pot — choose two soups; 四宫格 has four. 半份 is a half portion at about 60% of the price.',
    cart: 'Everything here goes to the kitchen together when you tap 下单.',
    checkout: 'Put 生日 in 备注 and the staff may come and sing — a Haidilao tradition.',
    table: 'Dip 毛肚 (tripe) up and down in the soup — 七上八下 — about fifteen seconds. 加菜 when you want more.',
    bill: 'The bill adds 调料 for every person.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'Paid. 欢迎再次光临 — welcome back.',
  },
  tour: [
    { target: 'rail', zh: '菜单', en: 'Soup bases first, then meats, balls, vegetables, rice and noodles.' },
    { target: 'add', zh: '选规格', en: '选规格 opens the soups for a pot, or 整份 / 半份 for a dish.' },
    { target: 'cart-bar', zh: '购物车', en: 'What you have chosen so far.' },
    { target: 'checkout-btn', zh: '选好了', en: '选好了 — done choosing. Then 下单 sends it to the kitchen.' },
  ],
  words: [
    { en: 'The pot', words: ['锅底', '单锅', '鸳鸯锅', '四宫格', '麻辣', '番茄', '清汤', '菌汤', '酸菜', '辣度'] },
    { en: 'Portions', words: ['份量', '整份', '半份', '一份', '两份'] },
    { en: 'Things to cook', words: ['荤菜', '素菜', '丸滑', '肥牛', '羊肉卷', '毛肚', '虾滑', '土豆片', '金针菇'] },
    { en: 'At the table', words: ['就餐人数', '调料', '下单', '加菜', '去买单'] },
  ],
  templates,
  photos: {
    'pulled-noodles': {},
    'kelp-knots': {},
    'lotus-root': {},
    'lettuce': {},
    'enoki': {},
    'wax-gourd': {},
    'potato-slices': {},
    'fish-balls': {},
    'duck-intestine': {},
    'pork-slices': {},
    'lamb-rolls': {},
    'grid-hotpot': {},
    'single-pot': {},
    hotpot: {},
    'sliced-beef-raw': {},
    tripe: {},
    'duck-blood': {},
    'luncheon-meat': {},
    'shrimp-paste': {},
    meatballs: {},
    'hotpot-veg': {},
    tofu: {},
    'noodles-bowl': {},
    rice: { word: '米饭' },
    'crispy-pork': {},
    'rice-cake': {},
    'haidilao-banner': {},
  },
  banner: { photo: 'haidilao-banner', zh: '服务至上', sub: '欢迎光临海底捞' },
  friend: '大刘',
  glossary: {
    海底捞: { py: 'Hǎidǐlāo', en: 'Haidilao (a hotpot chain)', note: 'literally "fish it out from the bottom of the sea"' },
    海底捞火锅: { py: 'Hǎidǐlāo huǒguō', en: 'Haidilao Hot Pot', hsk: ['火'] },
    大刘: { py: 'Dà Liú', en: 'Big Liu (your friend)', hsk: ['大'] },
    成都春熙路店: { py: 'Chéngdū Chūnxī lù diàn', en: 'the Chunxi Road restaurant, Chengdu' },
    服务至上: { py: 'fúwù zhìshàng', en: 'service above all' },
    欢迎光临海底捞: { py: 'huānyíng guānglín Hǎidǐlāo', en: 'welcome to Haidilao', hsk: ['欢迎'] },
    火锅: { py: 'huǒguō', en: 'hotpot', hsk: ['火'] },
    // categories and tags
    锅底: { py: 'guōdǐ', en: 'soup bases' },
    招牌必点: { py: 'zhāopái bì diǎn', en: 'must-order signatures', hsk: ['点'] },
    招牌: { py: 'zhāopái', en: 'signature' },
    人气: { py: 'rénqì', en: 'popular', hsk: ['人'] },
    荤菜: { py: 'hūn cài', en: 'meat and fish', hsk: ['菜'] },
    丸滑: { py: 'wán huá', en: 'balls and pastes' },
    素菜: { py: 'sù cài', en: 'vegetables', hsk: ['菜'] },
    主食: { py: 'zhǔshí', en: 'rice and noodles' },
    小吃: { py: 'xiǎochī', en: 'snacks', hsk: ['小', '吃'] },
    // items
    单锅: { py: 'dān guō', en: 'a single-soup pot' },
    鸳鸯锅: { py: 'yuānyāng guō', en: 'split pot (two soups)', note: '鸳鸯 are mandarin ducks, always in pairs' },
    四宫格: { py: 'sì gōng gé', en: 'four-way pot (four soups)', hsk: ['四'] },
    精品肥牛: { py: 'jīngpǐn féiniú', en: 'premium sliced beef', hsk: ['牛'] },
    肥牛: { py: 'féiniú', en: 'sliced beef', note: 'on the menu as 精品肥牛', hsk: ['牛'] },
    羊肉卷: { py: 'yángròu juǎn', en: 'rolled lamb slices', hsk: ['肉'] },
    鲜毛肚: { py: 'xiān máodù', en: 'fresh beef tripe' },
    毛肚: { py: 'máodù', en: 'beef tripe', note: 'on the menu as 鲜毛肚' },
    鸭血: { py: 'yāxuè', en: 'duck blood tofu' },
    午餐肉: { py: 'wǔcān ròu', en: 'luncheon meat', hsk: ['午饭', '肉'] },
    鸭肠: { py: 'yācháng', en: 'duck intestines' },
    猪肉片: { py: 'zhūròu piàn', en: 'sliced pork', hsk: ['肉'] },
    虾滑: { py: 'xiā huá', en: 'shrimp paste', note: 'scooped into the pot in little balls' },
    牛肉丸: { py: 'niúròu wán', en: 'beef balls', hsk: ['牛', '肉'] },
    鱼丸: { py: 'yú wán', en: 'fish balls', hsk: ['鱼'] },
    土豆片: { py: 'tǔdòu piàn', en: 'potato slices' },
    冬瓜: { py: 'dōngguā', en: 'wax gourd', hsk: ['冬'] },
    嫩豆腐: { py: 'nèn dòufu', en: 'soft tofu', hsk: ['豆腐'] },
    金针菇: { py: 'jīnzhēn gū', en: 'enoki mushrooms' },
    生菜: { py: 'shēngcài', en: 'lettuce', hsk: ['菜'] },
    藕片: { py: 'ǒu piàn', en: 'lotus root slices' },
    海带: { py: 'hǎidài', en: 'kelp' },
    捞面: { py: 'lāo miàn', en: 'hand-pulled noodles', note: 'a waiter pulls them at your table, dancing', hsk: ['面'] },
    米饭: { py: 'mǐfàn', en: 'rice', hsk: ['米饭'] },
    小酥肉: { py: 'xiǎo sū ròu', en: 'crispy fried pork', hsk: ['小', '肉'] },
    红糖糍粑: { py: 'hóngtáng cíbā', en: 'brown-sugar rice cakes', hsk: ['红'] },
    // descriptions
    一种锅底: { py: 'yì zhǒng guōdǐ', en: 'one soup' },
    '一个锅，两种锅底': { py: 'yí ge guō, liǎng zhǒng guōdǐ', en: 'one pot, two soups', hsk: ['一', '个', '两'] },
    '四种锅底，一次都尝': { py: 'sì zhǒng guōdǐ, yí cì dōu cháng', en: 'four soups, try them all at once', hsk: ['四', '一', '次', '都'] },
    '七上八下，十五秒': { py: 'qī shàng bā xià, shíwǔ miǎo', en: 'dip it up and down — fifteen seconds', hsk: ['七', '上', '八', '下'] },
    服务员帮你下锅: { py: 'fúwùyuán bāng nǐ xià guō', en: 'the waiter puts it in the pot for you', hsk: ['服务员', '帮', '你', '下'] },
    刚炸好的: { py: 'gāng zhá hǎo de', en: 'freshly fried', hsk: ['刚', '好', '的'] },
    服务员表演拉面: { py: 'fúwùyuán biǎoyǎn lāmiàn', en: 'a waiter performs the noodle-pulling', hsk: ['服务员', '面'] },
    // groups and options
    锅底口味: { py: 'guōdǐ kǒuwèi', en: 'Soup' },
    选两种锅底: { py: 'xuǎn liǎng zhǒng guōdǐ', en: 'Choose two soups', hsk: ['两'] },
    选四种锅底: { py: 'xuǎn sì zhǒng guōdǐ', en: 'Choose four soups', hsk: ['四'] },
    麻辣: { py: 'málà', en: 'spicy Sichuan (numbing and hot)', hsk: ['辣'] },
    番茄: { py: 'fānqié', en: 'tomato', note: 'the same as 西红柿' },
    清汤: { py: 'qīng tāng', en: 'clear broth', hsk: ['汤'] },
    菌汤: { py: 'jūn tāng', en: 'mushroom broth', hsk: ['汤'] },
    酸菜: { py: 'suāncài', en: 'pickled cabbage', hsk: ['酸', '菜'] },
    辣度: { py: 'làdù', en: 'Spiciness', hsk: ['辣'] },
    份量: { py: 'fènliàng', en: 'Portion' },
    整份: { py: 'zhěng fèn', en: 'full portion', hsk: ['份'] },
    半份: { py: 'bàn fèn', en: 'half portion', note: 'about 60% of the price', hsk: ['半', '份'] },
    约六折: { py: 'yuē liù zhé', en: 'about 60% of the price', note: '六折 = pay 6 tenths', hsk: ['六'] },
    // notes
    不要香菜: { py: 'bú yào xiāngcài', en: 'no coriander', hsk: ['不', '要', '菜'] },
    不要葱: { py: 'bú yào cōng', en: 'no spring onion', hsk: ['不', '要', '葱'] },
    多给一个碗: { py: 'duō gěi yí ge wǎn', en: 'one more bowl, please', hsk: ['多', '给', '一', '个', '碗'] },
    生日: { py: 'shēngrì', en: 'it’s a birthday', note: 'the staff may come and sing', hsk: ['生日'] },
    // the friend's words
    番茄锅: { py: 'fānqié guō', en: 'tomato pot' },
    清汤锅: { py: 'qīng tāng guō', en: 'clear broth pot', hsk: ['汤'] },
    菌汤锅: { py: 'jūn tāng guō', en: 'mushroom broth pot', hsk: ['汤'] },
    酸菜锅: { py: 'suāncài guō', en: 'pickled cabbage pot', hsk: ['酸', '菜'] },
    麻辣锅: { py: 'málà guō', en: 'spicy Sichuan pot', hsk: ['辣'] },
    麻辣的要: { py: 'málà de yào', en: 'the spicy one should be', hsk: ['辣', '的', '要'] },
    都要半份: { py: 'dōu yào bàn fèn', en: 'all half portions', hsk: ['都', '要', '半', '份'] },
    肉不够: { py: 'ròu bú gòu', en: 'not enough meat', hsk: ['肉', '不'] },
  },
};
