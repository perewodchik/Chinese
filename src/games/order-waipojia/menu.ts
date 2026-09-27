import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 外婆家 — a Hangzhou home-cooking restaurant, ordered by scanning the code
 * on the table (扫码点餐) and paid at the end (先吃后付).
 *
 * The landing asks 就餐人数; 餐具 is then charged per person on the bill
 * without anyone adding it. Dishes come in 大份 / 小份 where the kitchen
 * offers both, spicy ones ask 辣度, 米饭 is sold by the 碗, and the note has
 * the quick chips every Chinese restaurant app has: 不要香菜, 少油… Halfway
 * through a meal someone always wants more — 加菜 goes onto the same bill.
 */

const dish = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'photo'>): MenuItem => ({
  desc: '',
  groups: [],
  ...o,
});
const sized = (small: number) => ({ groups: ['portion'], prices: { small } });
const spicySized = (small: number) => ({ groups: ['portion', 'spice'], prices: { small } });

const items: MenuItem[] = [
  dish({ id: 'tea-chicken', zh: '茶香鸡', cats: ['top', 'hot'], price: 42, photo: 'roast-chicken', desc: '外婆家的招牌菜', tags: ['招牌'], ...sized(26), hsk: ['鸡', '茶'], sold: 3200 }),
  dish({ id: 'braised-pork', zh: '外婆红烧肉', call: '红烧肉', cats: ['top', 'hot'], price: 36, photo: 'braised-pork', desc: '肥而不腻', tags: ['招牌'], ...sized(22), hsk: ['肉'], sold: 2800 }),
  dish({ id: 'mapo-tofu', zh: '麻婆豆腐', cats: ['top', 'hot'], price: 8, photo: 'mapo-tofu', desc: '八块钱的招牌', spicy: 2, groups: ['spice'], defaults: { spice: 'medium' }, hsk: ['豆腐'], sold: 5000 }),
  dish({ id: 'kung-pao', zh: '宫保鸡丁', cats: ['hot'], price: 26, photo: 'kung-pao', spicy: 1, ...spicySized(17), hsk: ['鸡'], sold: 1900 }),
  dish({ id: 'yuxiang', zh: '鱼香肉丝', cats: ['hot'], price: 24, photo: 'stir-fry', spicy: 1, ...spicySized(16), hsk: ['肉'], sold: 1700 }),
  dish({ id: 'tomato-egg', zh: '西红柿炒鸡蛋', cats: ['hot'], price: 18, photo: 'tomato-egg', ...sized(12), hsk: ['西红柿', '鸡蛋'], sold: 2100 }),
  dish({ id: 'sweet-sour', zh: '糖醋里脊', cats: ['hot'], price: 32, photo: 'sweet-sour-pork', ...sized(20), hsk: ['肉'], sold: 1300 }),
  dish({ id: 'di-san-xian', zh: '地三鲜', cats: ['hot'], price: 20, photo: 'stir-fry', desc: '茄子、土豆和青椒', ...sized(13), hsk: ['菜'], sold: 900 }),
  dish({ id: 'potato-shreds', zh: '酸辣土豆丝', cats: ['hot'], price: 14, photo: 'potato-shreds', spicy: 1, groups: ['spice'], defaults: { spice: 'mild' }, hsk: ['菜'], sold: 1600 }),
  dish({ id: 'cauliflower', zh: '干锅花菜', cats: ['hot'], price: 22, photo: 'stir-fry', spicy: 2, groups: ['spice'], defaults: { spice: 'medium' }, hsk: ['菜'], sold: 800 }),
  dish({ id: 'greens', zh: '清炒时蔬', cats: ['hot'], price: 16, photo: 'stir-fry', desc: '今天的新鲜蔬菜', hsk: ['菜'], sold: 700 }),
  dish({ id: 'cucumber', zh: '拍黄瓜', cats: ['cold'], price: 10, photo: 'smashed-cucumber', hsk: ['菜'], sold: 1500 }),
  dish({ id: 'wood-ear', zh: '凉拌木耳', cats: ['cold'], price: 12, photo: 'wood-ear', hsk: ['菜'], sold: 800 }),
  dish({ id: 'egg-tofu', zh: '皮蛋豆腐', cats: ['cold'], price: 12, photo: 'century-egg-tofu', hsk: ['豆腐'], sold: 600 }),
  dish({ id: 'rice', zh: '米饭', cats: ['staple'], price: 2, photo: 'rice', unit: '碗', hsk: ['米饭'], sold: 9000 }),
  dish({ id: 'fried-rice', zh: '蛋炒饭', cats: ['staple'], price: 16, photo: 'fried-rice', hsk: ['饭'], sold: 1100 }),
  dish({ id: 'scallion-noodles', zh: '葱油拌面', cats: ['staple'], price: 12, photo: 'noodles-bowl', unit: '碗', hsk: ['面条儿'], sold: 900 }),
  dish({ id: 'hot-sour-soup', zh: '酸辣汤', cats: ['soup'], price: 18, photo: 'soup', spicy: 1, hsk: ['汤'], sold: 700 }),
  dish({ id: 'tomato-soup', zh: '西红柿鸡蛋汤', cats: ['soup'], price: 16, photo: 'soup', hsk: ['汤', '西红柿', '鸡蛋'], sold: 900 }),
  dish({ id: 'cola', zh: '可乐', cats: ['drinks'], price: 6, photo: 'cola', unit: '瓶', sold: 2000 }),
  dish({ id: 'sprite', zh: '雪碧', cats: ['drinks'], price: 6, photo: 'cola', unit: '瓶', sold: 900 }),
  dish({ id: 'beer', zh: '啤酒', cats: ['drinks'], price: 10, photo: 'beer', unit: '瓶', hsk: ['啤酒'], sold: 1300 }),
  dish({ id: 'plum-drink', zh: '酸梅汤', cats: ['drinks'], price: 12, photo: 'plum-drink', unit: '杯', hsk: ['汤'], sold: 800 }),
  dish({ id: 'orange-juice', zh: '鲜榨橙汁', cats: ['drinks'], price: 18, photo: 'orange-juice', unit: '杯', sold: 400 }),
];

/* ------------------------------------------------------------- templates */

const SPICE_SAY: Record<string, [string, string]> = {
  none: ['不辣', 'not spicy'],
  mild: ['微辣', 'mildly spicy'],
  medium: ['中辣', 'medium spicy'],
  hot: ['特辣', 'very spicy'],
};
const NOTES: [string, string][] = [
  ['不要香菜', 'no coriander'],
  ['不要葱', 'no spring onion'],
  ['少油', 'less oil'],
  ['少盐', 'less salt'],
];
const PEOPLE = ['', '一个人', '两个人', '三个人', '四个人', '五个人'];
const PEOPLE_EN = ['', 'just me', 'two of us', 'three of us', 'four of us', 'five of us'];
const BOWLS = ['', '一碗', '两碗', '三碗', '四碗', '五碗'];
const BOTTLES = ['', '一瓶', '两瓶', '三瓶'];

const byCat = (b: Brand, c: string) => b.items.filter((i) => i.cats.includes(c));
const hot = (b: Brand) => byCat(b, 'hot');
const spicy = (b: Brand) => b.items.filter((i) => i.groups.includes('spice'));
const withPortion = (b: Brand) => b.items.filter((i) => i.groups.includes('portion'));
const call = (i: MenuItem) => i.call ?? i.zh;
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;
const people = (p: TemplatePick) => 2 + p.int(3);
const diners = (n: number): Want => ({ kind: 'diners', n });
const spiceOf = (p: TemplatePick, i: MenuItem) => {
  const id = p.pick(Object.keys(SPICE_SAY).filter((s) => s !== i.defaults?.spice));
  return { id, zh: SPICE_SAY[id][0], en: SPICE_SAY[id][1] };
};

const templates: TaskTemplate[] = [
  {
    id: 'one-spice',
    level: 1,
    build: (p) => {
      const n = people(p);
      const i = p.pick(spicy(p.brand));
      const s = spiceOf(p, i);
      return {
        message: `我们${PEOPLE[n]}。点一个${call(i)}，${s.zh}。`,
        en: `There are ${PEOPLE_EN[n]}. Order a ${enOf(p.brand, call(i))}, ${s.en}.`,
        parts: [PEOPLE[n], call(i), s.zh],
        wants: [diners(n), { kind: 'line', item: i.id, qty: 1, choices: { spice: s.id } }] as Want[],
      };
    },
  },
  {
    id: 'one-small',
    level: 1,
    build: (p) => {
      const n = people(p);
      const i = p.pick(withPortion(p.brand));
      return {
        message: `我们${PEOPLE[n]}。点一个小份的${call(i)}。`,
        en: `There are ${PEOPLE_EN[n]}. Order a small ${enOf(p.brand, call(i))}.`,
        parts: [PEOPLE[n], '小份', call(i)],
        wants: [diners(n), { kind: 'line', item: i.id, qty: 1, choices: { portion: 'small' } }] as Want[],
      };
    },
  },
  {
    id: 'dish-and-rice',
    level: 2,
    build: (p) => {
      const n = people(p);
      const i = p.pick(hot(p.brand));
      return {
        message: `我们${PEOPLE[n]}。点一个${call(i)}，再要${BOWLS[n]}米饭。`,
        en: `There are ${PEOPLE_EN[n]}. Order a ${enOf(p.brand, call(i))} and ${n} bowls of rice.`,
        parts: [PEOPLE[n], call(i), BOWLS[n], '米饭'],
        wants: [diners(n), { kind: 'line', item: i.id, qty: 1, choices: {} }, { kind: 'line', item: 'rice', qty: n, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'dish-note',
    level: 2,
    build: (p) => {
      const n = people(p);
      const i = p.pick(hot(p.brand));
      const [note, noteEn] = p.pick(NOTES);
      return {
        message: `我们${PEOPLE[n]}。要一个${call(i)}，${note}。`,
        en: `There are ${PEOPLE_EN[n]}. We want a ${enOf(p.brand, call(i))} — ${noteEn}.`,
        parts: [PEOPLE[n], call(i), note],
        wants: [diners(n), { kind: 'line', item: i.id, qty: 1, choices: {} }, { kind: 'note', value: note }] as Want[],
      };
    },
  },
  {
    id: 'dish-drinks',
    level: 2,
    build: (p) => {
      const n = people(p);
      const i = p.pick(hot(p.brand));
      const d = p.pick(byCat(p.brand, 'drinks').filter((x) => x.unit === '瓶'));
      return {
        message: `我们${PEOPLE[n]}。点一个${call(i)}，${BOTTLES[2]}${call(d)}。`,
        en: `There are ${PEOPLE_EN[n]}. Order a ${enOf(p.brand, call(i))} and two bottles of ${enOf(p.brand, call(d))}.`,
        parts: [PEOPLE[n], call(i), BOTTLES[2], call(d)],
        wants: [diners(n), { kind: 'line', item: i.id, qty: 1, choices: {} }, { kind: 'line', item: d.id, qty: 2, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: (p) => {
      // a dish whose 大份 would go over, and whose 小份 fits
      const fits = withPortion(p.brand).filter((i) => {
        const small = i.prices!.small + 4 + 4;
        const budget = Math.ceil(small / 5) * 5;
        return i.price + 8 > budget;
      });
      const i = p.pick(fits);
      const budget = Math.ceil((i.prices!.small + 8) / 5) * 5;
      return {
        message: `我们两个人，只有${budget}块：点一个${call(i)}，两碗米饭。`,
        en: `There are two of us and we only have ¥${budget}: a ${enOf(p.brand, call(i))} and two bowls of rice. (餐具 is charged per person.)`,
        parts: ['两个人', `${budget}块`, call(i), '两碗', '米饭'],
        wants: [
          diners(2),
          { kind: 'line', item: i.id, qty: 1, choices: { portion: 'small' } },
          { kind: 'line', item: 'rice', qty: 2, choices: {} },
          { kind: 'budget', max: budget },
        ] as Want[],
      };
    },
  },
  {
    id: 'cold-hot-rice',
    level: 3,
    build: (p) => {
      const n = people(p);
      const c = p.pick(byCat(p.brand, 'cold'));
      const h = p.pick(spicy(p.brand));
      const s = spiceOf(p, h);
      const [note, noteEn] = p.pick(NOTES);
      return {
        message: `我们${PEOPLE[n]}：一个${call(c)}，一个${call(h)}，${s.zh}，${BOWLS[n]}米饭。${note}。`,
        en: `There are ${PEOPLE_EN[n]}: a ${enOf(p.brand, call(c))}, a ${enOf(p.brand, call(h))} (${s.en}), and ${n} bowls of rice. ${noteEn[0].toUpperCase()}${noteEn.slice(1)}.`,
        parts: [PEOPLE[n], call(c), call(h), s.zh, BOWLS[n], '米饭', note],
        wants: [
          diners(n),
          { kind: 'line', item: c.id, qty: 1, choices: {} },
          { kind: 'line', item: h.id, qty: 1, choices: { spice: s.id } },
          { kind: 'line', item: 'rice', qty: n, choices: {} },
          { kind: 'note', value: note },
        ] as Want[],
      };
    },
  },
  {
    id: 'big-soup-beer',
    level: 3,
    build: (p) => {
      const n = people(p);
      const h = p.pick(withPortion(p.brand));
      const soup = p.pick(byCat(p.brand, 'soup'));
      return {
        message: `我们${PEOPLE[n]}。一个大份的${call(h)}，一个${call(soup)}，${BOTTLES[n > 3 ? 3 : n]}啤酒。`,
        en: `There are ${PEOPLE_EN[n]}. A large ${enOf(p.brand, call(h))}, a ${enOf(p.brand, call(soup))} and ${n > 3 ? 3 : n} bottles of beer.`,
        parts: [PEOPLE[n], '大份', call(h), call(soup), BOTTLES[n > 3 ? 3 : n], '啤酒'],
        wants: [
          diners(n),
          { kind: 'line', item: h.id, qty: 1, choices: { portion: 'big' } },
          { kind: 'line', item: soup.id, qty: 1, choices: {} },
          { kind: 'line', item: 'beer', qty: n > 3 ? 3 : n, choices: {} },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-small',
    level: 3,
    build: (p) => {
      const n = people(p);
      const [a, b] = p.sample(withPortion(p.brand), 2);
      return {
        message: `我们${PEOPLE[n]}，吃不了太多：${call(a)}和${call(b)}都要小份的。`,
        en: `There are ${PEOPLE_EN[n]} and we can't eat much: small portions of ${enOf(p.brand, call(a))} and ${enOf(p.brand, call(b))}.`,
        parts: [PEOPLE[n], call(a), call(b), '小份'],
        wants: [
          diners(n),
          { kind: 'line', item: a.id, qty: 1, choices: { portion: 'small' } },
          { kind: 'line', item: b.id, qty: 1, choices: { portion: 'small' } },
        ] as Want[],
      };
    },
  },
  {
    id: 'meal-then-rice',
    level: 4,
    build: (p) => {
      const n = 3 + p.int(3);
      const c = p.pick(byCat(p.brand, 'cold'));
      const [h1, h2] = p.sample(hot(p.brand), 2);
      const [note, noteEn] = p.pick(NOTES);
      const soup = p.pick(byCat(p.brand, 'soup'));
      return {
        message: `我们${PEOPLE[n]}。先点一个${call(c)}、一个${call(h1)}和一个${call(h2)}，${note}。`,
        en: `There are ${PEOPLE_EN[n]}. To start: a ${enOf(p.brand, call(c))}, a ${enOf(p.brand, call(h1))} and a ${enOf(p.brand, call(h2))} — ${noteEn}.`,
        parts: [PEOPLE[n], call(c), call(h1), call(h2), note],
        wants: [
          diners(n),
          { kind: 'line', item: c.id, qty: 1, choices: {} },
          { kind: 'line', item: h1.id, qty: 1, choices: {} },
          { kind: 'line', item: h2.id, qty: 1, choices: {} },
          { kind: 'note', value: note },
        ] as Want[],
        later: {
          message: `再加${BOWLS[n]}米饭和一个${call(soup)}吧。`,
          en: `Let's add ${n} bowls of rice and a ${enOf(p.brand, call(soup))}.`,
          parts: ['加菜', BOWLS[n], '米饭', call(soup)],
          wants: [
            { kind: 'line', item: 'rice', qty: n, choices: {} },
            { kind: 'line', item: soup.id, qty: 1, choices: {} },
          ] as Want[],
        },
      };
    },
  },
  {
    id: 'meal-then-dish',
    level: 4,
    build: (p) => {
      const n = 2 + p.int(3);
      const [a, b] = p.sample(withPortion(p.brand), 2);
      const c = p.pick(spicy(p.brand).filter((x) => x.id !== a.id && x.id !== b.id));
      const s = spiceOf(p, c);
      return {
        message: `我们${PEOPLE[n]}。点${call(a)}和${call(b)}，都要小份的。`,
        en: `There are ${PEOPLE_EN[n]}. Order ${enOf(p.brand, call(a))} and ${enOf(p.brand, call(b))}, both small.`,
        parts: [PEOPLE[n], call(a), call(b), '小份'],
        wants: [
          diners(n),
          { kind: 'line', item: a.id, qty: 1, choices: { portion: 'small' } },
          { kind: 'line', item: b.id, qty: 1, choices: { portion: 'small' } },
        ] as Want[],
        later: {
          message: `菜不够，再加一个${call(c)}，${s.zh}。`,
          en: `That's not enough — add a ${enOf(p.brand, call(c))}, ${s.en}.`,
          parts: ['加菜', call(c), s.zh],
          wants: [{ kind: 'line', item: c.id, qty: 1, choices: { spice: s.id } }] as Want[],
        },
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

export const waipojia: Brand = {
  id: 'waipojia',
  model: 'table',
  name: '外婆家',
  latin: 'Grandma’s Home',
  merchant: '外婆家',
  pitch: 'A family meal at 外婆家: scan the table code, say how many you are, order, add dishes while you eat, and pay at the end.',
  colours: { brand: '#9b2d20', soft: '#f6e6e1', ink: '#ffffff', darkBrand: '#e0806f', darkSoft: '#3a211c' },
  store: { zh: '杭州湖滨店', distance: '' },
  table: { no: 'A08' },
  categories: [
    { id: 'top', zh: '招牌推荐' },
    { id: 'cold', zh: '凉菜' },
    { id: 'hot', zh: '热菜' },
    { id: 'staple', zh: '主食' },
    { id: 'soup', zh: '汤羹' },
    { id: 'drinks', zh: '酒水饮料' },
  ],
  items,
  groups: {
    portion: {
      id: 'portion',
      zh: '规格',
      kind: 'one',
      required: true,
      default: 'big',
      options: [
        { id: 'big', zh: '大份' },
        { id: 'small', zh: '小份' },
      ],
    },
    spice: {
      id: 'spice',
      zh: '辣度',
      kind: 'one',
      required: true,
      default: 'mild',
      options: [
        { id: 'none', zh: '不辣' },
        { id: 'mild', zh: '微辣' },
        { id: 'medium', zh: '中辣' },
        { id: 'hot', zh: '特辣' },
      ],
    },
  },
  rules: [],
  coupons: [],
  fees: [{ zh: '餐具', amount: 2, per: 'person' }],
  notes: ['不要香菜', '不要葱', '少油', '少盐', '不吃辣', '打包'],
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'landing', zh: '扫码点餐', en: 'scan: table, diners' },
    { id: 'menu', zh: '菜单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'options' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认下单', en: 'send the order' },
    { id: 'table', zh: '加菜', en: 'at the table' },
    { id: 'bill', zh: '买单', en: 'the bill' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '买单成功', en: 'paid' },
  ],
  tips: {
    chat: 'At a sit-down restaurant you scan the code on the table (扫码点餐). The friend says how many you are first.',
    landing: '就餐人数 matters: 餐具 (a cutlery set) is charged per person on the bill — here ¥2 each.',
    menu: '凉菜 are cold starters, 热菜 hot dishes, 主食 rice and noodles. 米饭 is sold by the 碗.',
    spec: '大份 / 小份 is the size of the dish; 辣度 is how spicy, from 不辣 to 特辣.',
    cart: 'Everything here goes to the kitchen together when you tap 下单.',
    checkout: '忌口 — what you don’t eat — goes in 备注: 不要香菜, 不要葱, 少油, 少盐.',
    table: 'You pay at the end (先吃后付). 加菜 adds dishes to the same bill; 催单 hurries the kitchen.',
    bill: 'The bill adds 餐具 per person to the dishes.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'Paid. 欢迎再次光临 — welcome back.',
  },
  tour: [
    { target: 'rail', zh: '菜单', en: 'Cold dishes, hot dishes, rice and noodles, soup, drinks.' },
    { target: 'add', zh: '选规格', en: '选规格 opens 大份/小份 and 辣度.' },
    { target: 'cart-bar', zh: '购物车', en: 'What you have chosen so far.' },
    { target: 'checkout-btn', zh: '选好了', en: '选好了 — done choosing. Then 下单 sends it to the kitchen.' },
  ],
  words: [
    { en: 'At the table', words: ['扫码点餐', '桌号', '就餐人数', '餐具', '下单', '加菜', '呼叫服务员', '催单', '去买单', '买单'] },
    { en: 'The menu', words: ['凉菜', '热菜', '主食', '汤羹', '酒水饮料', '米饭', '大份', '小份', '辣度', '不辣', '微辣', '中辣', '特辣'] },
    { en: 'Dishes', words: ['麻婆豆腐', '宫保鸡丁', '鱼香肉丝', '西红柿炒鸡蛋', '红烧肉', '拍黄瓜', '酸辣汤', '啤酒', '可乐'] },
    { en: 'Notes', words: ['备注', '不要香菜', '不要葱', '少油', '少盐', '不吃辣', '打包'] },
  ],
  templates,
  photos: {
    'roast-chicken': {},
    'braised-pork': {},
    'mapo-tofu': {},
    'kung-pao': {},
    'stir-fry': {},
    'tomato-egg': {},
    'sweet-sour-pork': {},
    'potato-shreds': {},
    'smashed-cucumber': {},
    'wood-ear': {},
    'century-egg-tofu': {},
    rice: { word: '米饭' },
    'fried-rice': {},
    'noodles-bowl': {},
    soup: {},
    cola: {},
    beer: {},
    'plum-drink': {},
    'orange-juice': {},
    'waipojia-banner': {},
  },
  banner: { photo: 'waipojia-banner', zh: '欢迎光临', sub: '扫码点餐' },
  friend: '小王',
  glossary: {
    外婆家: { py: 'Wàipó Jiā', en: 'Grandma’s Home (a restaurant chain)', note: '外婆 is your mother’s mother', hsk: ['家'] },
    小王: { py: 'Xiǎo Wáng', en: 'Xiao Wang (your friend)' },
    杭州湖滨店: { py: 'Hángzhōu Húbīn diàn', en: 'the Hubin restaurant, Hangzhou' },
    欢迎光临: { py: 'huānyíng guānglín', en: 'welcome', hsk: ['欢迎'] },
    // categories and tags
    招牌推荐: { py: 'zhāopái tuījiàn', en: 'house specials' },
    招牌: { py: 'zhāopái', en: 'signature dish' },
    凉菜: { py: 'liáng cài', en: 'cold dishes', hsk: ['菜'] },
    热菜: { py: 'rè cài', en: 'hot dishes', hsk: ['热', '菜'] },
    主食: { py: 'zhǔshí', en: 'rice and noodles', note: 'the staple that fills you up' },
    汤羹: { py: 'tāng gēng', en: 'soups', hsk: ['汤'] },
    酒水饮料: { py: 'jiǔshuǐ yǐnliào', en: 'drinks', hsk: ['水'] },
    // items
    茶香鸡: { py: 'chá xiāng jī', en: 'tea-scented chicken', hsk: ['茶', '鸡'] },
    外婆红烧肉: { py: 'wàipó hóngshāo ròu', en: 'Grandma’s red-braised pork', hsk: ['肉'] },
    红烧肉: { py: 'hóngshāo ròu', en: 'red-braised pork', hsk: ['肉'] },
    麻婆豆腐: { py: 'mápó dòufu', en: 'mapo tofu', hsk: ['豆腐'] },
    宫保鸡丁: { py: 'gōngbǎo jīdīng', en: 'kung pao chicken', hsk: ['鸡'] },
    鱼香肉丝: { py: 'yúxiāng ròusī', en: 'fish-fragrant pork strips', note: 'no fish in it: a sweet, sour and spicy sauce', hsk: ['鱼', '肉'] },
    西红柿炒鸡蛋: { py: 'xīhóngshì chǎo jīdàn', en: 'tomato and scrambled egg', hsk: ['西红柿', '鸡蛋'] },
    糖醋里脊: { py: 'tángcù lǐji', en: 'sweet and sour pork' },
    地三鲜: { py: 'dì sān xiān', en: '"three from the earth"', note: 'aubergine, potato and green pepper' },
    酸辣土豆丝: { py: 'suānlà tǔdòu sī', en: 'hot and sour shredded potato', hsk: ['酸', '辣'] },
    干锅花菜: { py: 'gānguō huācài', en: 'dry-pot cauliflower', hsk: ['菜'] },
    清炒时蔬: { py: 'qīng chǎo shí shū', en: 'stir-fried greens of the day' },
    拍黄瓜: { py: 'pāi huángguā', en: 'smashed cucumber' },
    凉拌木耳: { py: 'liángbàn mù’ěr', en: 'wood-ear mushroom salad' },
    皮蛋豆腐: { py: 'pídàn dòufu', en: 'century egg with tofu', hsk: ['豆腐'] },
    米饭: { py: 'mǐfàn', en: 'rice', note: 'sold by the bowl (碗)', hsk: ['米饭'] },
    蛋炒饭: { py: 'dàn chǎofàn', en: 'egg fried rice', hsk: ['饭'] },
    葱油拌面: { py: 'cōngyóu bànmiàn', en: 'scallion-oil noodles', hsk: ['葱', '油', '面'] },
    酸辣汤: { py: 'suānlà tāng', en: 'hot and sour soup', hsk: ['酸', '辣', '汤'] },
    西红柿鸡蛋汤: { py: 'xīhóngshì jīdàn tāng', en: 'tomato and egg soup', hsk: ['西红柿', '鸡蛋', '汤'] },
    可乐: { py: 'kělè', en: 'cola' },
    雪碧: { py: 'xuěbì', en: 'Sprite' },
    啤酒: { py: 'píjiǔ', en: 'beer', hsk: ['啤酒'] },
    酸梅汤: { py: 'suānméi tāng', en: 'sour plum drink', hsk: ['汤'] },
    鲜榨橙汁: { py: 'xiānzhà chéngzhī', en: 'fresh orange juice' },
    // descriptions
    外婆家的招牌菜: { py: 'wàipó jiā de zhāopái cài', en: 'the house signature dish', hsk: ['家', '的', '菜'] },
    肥而不腻: { py: 'féi ér bú nì', en: 'rich but not greasy' },
    八块钱的招牌: { py: 'bā kuài qián de zhāopái', en: 'the famous eight-yuan dish', hsk: ['八', '块', '钱', '的'] },
    '茄子、土豆和青椒': { py: 'qiézi, tǔdòu hé qīngjiāo', en: 'aubergine, potato and green pepper', hsk: ['和'] },
    今天的新鲜蔬菜: { py: 'jīntiān de xīnxiān shūcài', en: 'today’s fresh vegetables', hsk: ['今天', '的', '新鲜', '菜'] },
    // groups, options, notes
    规格: { py: 'guīgé', en: 'Size' },
    大份: { py: 'dà fèn', en: 'large portion', hsk: ['大', '份'] },
    小份: { py: 'xiǎo fèn', en: 'small portion', note: 'about two thirds of the price', hsk: ['小', '份'] },
    辣度: { py: 'làdù', en: 'Spiciness', hsk: ['辣'] },
    不辣: { py: 'bú là', en: 'not spicy', hsk: ['不', '辣'] },
    不要香菜: { py: 'bú yào xiāngcài', en: 'no coriander', hsk: ['不', '要', '菜'] },
    不要葱: { py: 'bú yào cōng', en: 'no spring onion', hsk: ['不', '要', '葱'] },
    少油: { py: 'shǎo yóu', en: 'less oil', hsk: ['少', '油'] },
    少盐: { py: 'shǎo yán', en: 'less salt', hsk: ['少', '盐'] },
    不吃辣: { py: 'bù chī là', en: "we don't eat spicy food", hsk: ['不', '吃', '辣'] },
    打包: { py: 'dǎbāo', en: 'box up the leftovers', note: 'at a table: take home what is left' },
    // the friend's words
    吃不了太多: { py: 'chī bù liǎo tài duō', en: "can't eat too much", hsk: ['吃', '太', '多'] },
    都要小份的: { py: 'dōu yào xiǎo fèn de', en: 'small portions of both', hsk: ['都', '要', '小', '份', '的'] },
    小份的: { py: 'xiǎo fèn de', en: 'a small portion of', hsk: ['小', '份', '的'] },
    大份的: { py: 'dà fèn de', en: 'a large portion of', hsk: ['大', '份', '的'] },
    再要: { py: 'zài yào', en: 'and also', hsk: ['再', '要'] },
    菜不够: { py: 'cài bú gòu', en: 'not enough food', hsk: ['菜', '不'] },
    都要: { py: 'dōu yào', en: 'both want', hsk: ['都', '要'] },
    都: { py: 'dōu', en: 'both, all', hsk: ['都'] },
  },
};
