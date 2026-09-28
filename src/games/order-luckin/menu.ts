import type { Brand, MenuItem, TaskTemplate, TemplatePick, Want } from '../order-kit/types';

/**
 * 瑞幸咖啡 — the shop, as data.
 *
 * The menu is in luckin's style rather than a copy of today's menu: its
 * signature drinks (生椰拿铁, 酱香拿铁, 标准美式, 橙C美式) with the option
 * groups its sheet shows, in its order — 温度 (only 冰 or 热), 糖度, 奶, 浓度,
 * 杯型 — and list prices with the 预估到手 price after a coupon. What was
 * checked against real screenshots and guides is in docs/ordering-game/brands.md.
 */

const coffee = (o: Partial<MenuItem> & Pick<MenuItem, 'id' | 'zh' | 'cats' | 'price' | 'deal' | 'desc'>): MenuItem => ({
  photo: 'latte',
  groups: ['temp', 'sugar', 'shot', 'cup'],
  hsk: ['咖啡'],
  ...o,
});

const items: MenuItem[] = [
  coffee({ id: 'coconut-latte', zh: '生椰拿铁', cats: ['top', 'coconut'], price: 32, deal: 15.9, desc: '生椰和咖啡的经典搭配', tags: ['爆款'], photo: 'iced-latte', sold: 5000, defaults: { sugar: 'std' } }),
  coffee({ id: 'iced-coconut', zh: '冰吸生椰拿铁', cats: ['coconut'], price: 32, deal: 16.9, desc: '冰冰爽爽，椰香更浓', photo: 'coconut-coffee', only: { temp: ['ice'] }, sold: 1000 }),
  coffee({ id: 'coconut-cloud', zh: '椰云拿铁', cats: ['coconut'], price: 32, deal: 16.9, desc: '椰云奶盖，口感绵密', photo: 'coconut-cream-coffee', sold: 800 }),
  coffee({ id: 'sauce-latte', photo: 'latte-art', zh: '酱香拿铁', cats: ['top', 'new'], price: 32, deal: 19.9, desc: '香气浓郁的新品拿铁', tags: ['新品'], sold: 3000 }),
  coffee({ id: 'latte', zh: '拿铁', cats: ['top', 'latte'], price: 29, deal: 13.9, desc: '经典意式拿铁', tags: ['IIAC金奖豆'], groups: ['temp', 'sugar', 'milk', 'shot', 'cup'], defaults: { sugar: 'none' }, sold: 4000 }),
  coffee({ id: 'velvet-latte', photo: 'latte-glass', zh: '丝绒拿铁', cats: ['latte'], price: 29, deal: 15.9, desc: '口感丝滑', sold: 900 }),
  coffee({ id: 'thick-latte', photo: 'latte-macchiato', zh: '厚乳拿铁', cats: ['latte'], price: 32, deal: 16.9, desc: '奶香更浓', sold: 700 }),
  coffee({ id: 'vanilla-latte', photo: 'vanilla-latte', zh: '香草拿铁', cats: ['latte'], price: 32, deal: 16.9, desc: '香草风味', groups: ['temp', 'sugar', 'milk', 'shot', 'cup'], sold: 600 }),
  coffee({ id: 'cappuccino', photo: 'cappuccino', zh: '卡布奇诺', cats: ['latte'], price: 29, deal: 13.9, desc: '奶泡更多的意式咖啡', groups: ['temp', 'sugar', 'milk', 'shot', 'cup'], defaults: { sugar: 'none' }, sold: 500 }),
  coffee({ id: 'flat-white', zh: '澳瑞白', cats: ['latte'], price: 29, deal: 15.9, desc: '咖啡味更浓的小杯拿铁', photo: 'flat-white', groups: ['temp', 'sugar', 'milk', 'shot'], defaults: { sugar: 'none' }, sold: 400 }),
  coffee({ id: 'mocha', photo: 'mocha', zh: '摩卡', cats: ['latte'], price: 32, deal: 16.9, desc: '巧克力和咖啡', sold: 300 }),
  coffee({ id: 'americano', zh: '标准美式', call: '美式', cats: ['top', 'americano'], price: 24, deal: 9.9, desc: '经典美式咖啡', photo: 'americano', tags: ['IIAC金奖豆'], defaults: { sugar: 'none' }, sold: 4500 }),
  coffee({ id: 'strong-americano', zh: '加浓美式', cats: ['americano'], price: 27, deal: 12.9, desc: '咖啡味更浓', photo: 'long-black', groups: ['temp', 'sugar', 'cup'], defaults: { sugar: 'none' }, sold: 1200 }),
  coffee({ id: 'orange-americano', zh: '橙C美式', cats: ['new', 'americano'], price: 29, deal: 13.9, desc: '橙汁和美式咖啡', tags: ['新品'], photo: 'iced-coffee', only: { temp: ['ice'] }, groups: ['temp', 'sugar', 'cup'], sold: 2000 }),
  { id: 'matcha-frappe', zh: '抹茶瑞纳冰', cats: ['frappe'], price: 32, deal: 16.9, desc: '抹茶冰沙，没有咖啡', photo: 'matcha-frappe', groups: ['temp', 'sugar', 'cup'], only: { temp: ['ice'] }, sold: 600 },
  { id: 'choco-frappe', zh: '巧克力瑞纳冰', cats: ['frappe'], price: 32, deal: 16.9, desc: '巧克力冰沙', photo: 'frappe', groups: ['temp', 'sugar', 'cup'], only: { temp: ['ice'] }, sold: 500 },
  { id: 'jasmine', zh: '轻轻茉莉', cats: ['top', 'tea'], price: 23, deal: 11.9, desc: '清香茉莉花茶', photo: 'tea', hsk: ['茶'], groups: ['temp', 'sugar', 'cup'], sold: 1500 },
  { id: 'lemon-tea', zh: '冰摇柠檬茶', cats: ['tea'], price: 21, deal: 12.9, desc: '柠檬和红茶', photo: 'lemon-tea', hsk: ['茶', '红茶'], groups: ['temp', 'sugar', 'cup'], only: { temp: ['ice'] }, sold: 900 },
  { id: 'kale', zh: '羽衣轻体果蔬茶', cats: ['tea'], price: 22, deal: 13.9, desc: '羽衣甘蓝和水果', photo: 'green-juice', hsk: ['茶', '水果'], groups: ['temp', 'cup'], only: { temp: ['ice'] }, sold: 400 },
  { id: 'croissant', zh: '原味可颂', cats: ['food'], price: 12, deal: 8.9, desc: '外酥里软', photo: 'croissant', groups: [], hsk: ['面包'], sold: 800 },
  { id: 'ham-croissant', zh: '火腿芝士可颂', cats: ['food'], price: 16, desc: '火腿和芝士', photo: 'ham-croissant', groups: [], hsk: ['面包'], sold: 300 },
  { id: 'sandwich', zh: '鸡肉三明治', cats: ['food'], price: 18, desc: '鸡肉和生菜', photo: 'sandwich', groups: [], hsk: ['面包'], sold: 300 },
  { id: 'tiramisu', zh: '提拉米苏', cats: ['food'], price: 18, desc: '咖啡味的蛋糕', photo: 'tiramisu', groups: [], hsk: ['蛋糕'], sold: 200 },
];

/* ------------------------------------------------------------- templates */

const TEMP_EN: Record<string, string> = { ice: 'iced', hot: 'hot' };
const TEMP_ZH: Record<string, string> = { ice: '冰', hot: '热' };

/** What a friend says for each sugar level — "不加糖", where the app says 不另外加糖. */
const SUGAR_SAY: Record<string, [string, string]> = {
  none: ['不加糖', 'no sugar'],
  ll: ['少少甜', 'just a little sweet'],
  less: ['少甜', 'less sweet'],
  std: ['标准甜', 'normal sweetness'],
};

const DINE_SAY: [string, '堂食' | '外带', string][] = [
  ['打包', '外带', 'to take away'],
  ['带走', '外带', 'to take away'],
  ['在店里喝', '堂食', "I'll drink it in the shop"],
];

const drinks = (b: Brand) => b.items.filter((i) => i.groups.includes('temp'));
const food = (b: Brand) => b.items.filter((i) => !i.groups.length);
const temps = (b: Brand, i: MenuItem) => (i.only?.temp ?? b.groups.temp.options.map((o) => o.id));
const both = (b: Brand) => drinks(b).filter((i) => temps(b, i).length === 2);
const withGroup = (b: Brand, g: string) => drinks(b).filter((i) => i.groups.includes(g));
const call = (i: MenuItem) => i.call ?? i.zh;
const enOf = (b: Brand, zh: string) => b.glossary[zh]?.en ?? zh;

/** A drink and its temperature: "冰拿铁" says 冰; a drink that is only iced says nothing. */
function tempOf(p: TemplatePick, i: MenuItem) {
  const ts = temps(p.brand, i);
  if (ts.length === 1) return { zh: '', en: '', want: {} as Record<string, string>, chip: [] as string[] };
  const t = p.pick(ts);
  return { zh: TEMP_ZH[t], en: TEMP_EN[t], want: { temp: t } as Record<string, string>, chip: [TEMP_ZH[t]] };
}

const sugarOf = (p: TemplatePick, i: MenuItem) => {
  const s = p.pick(p.brand.groups.sugar.options.map((o) => o.id).filter((id) => id !== (i.defaults?.sugar ?? 'std')));
  return { id: s, zh: SUGAR_SAY[s][0], en: SUGAR_SAY[s][1] };
};

const templates: TaskTemplate[] = [
  {
    id: 'one-temp',
    level: 1,
    build: (p) => {
      const i = p.pick(both(p.brand));
      const t = tempOf(p, i);
      return {
        message: `帮我买一杯${t.zh}${call(i)}。`,
        en: `Buy me a ${t.en} ${enOf(p.brand, call(i))}, please.`,
        parts: [...t.chip, call(i)],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: t.want }] as Want[],
      };
    },
  },
  {
    id: 'want-drink',
    level: 1,
    build: (p) => {
      const i = p.pick(both(p.brand));
      const t = tempOf(p, i);
      return {
        message: `我想喝${call(i)}，要${t.zh}的。`,
        en: `I'd like a ${enOf(p.brand, call(i))} — ${t.en}.`,
        parts: [call(i), `${t.zh}的`],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: t.want }] as Want[],
      };
    },
  },
  {
    id: 'one-food',
    level: 1,
    build: (p) => {
      const i = p.pick(food(p.brand));
      return {
        message: `帮我买一个${call(i)}。`,
        en: `Buy me a ${enOf(p.brand, call(i))}, please.`,
        parts: ['一个', call(i)],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: {} }] as Want[],
      };
    },
  },
  {
    id: 'sugar-dine',
    level: 2,
    build: (p) => {
      const i = p.pick(withGroup(p.brand, 'sugar'));
      const t = tempOf(p, i);
      const s = sugarOf(p, i);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `帮我买一杯${t.zh}${call(i)}，${s.zh}，${say}。`,
        en: `Buy me a ${t.en} ${enOf(p.brand, call(i))}, ${s.en}, ${dineEn}.`.replace('  ', ' '),
        parts: [...t.chip, call(i), s.zh, say],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { ...t.want, sugar: s.id } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'oat-milk',
    level: 2,
    build: (p) => {
      const i = p.pick(withGroup(p.brand, 'milk'));
      const t = tempOf(p, i);
      const s = sugarOf(p, i);
      return {
        message: `帮我买一杯${t.zh}${call(i)}，${s.zh}，要燕麦奶。我在外面等你，打包。`,
        en: `Buy me a ${t.en} ${enOf(p.brand, call(i))}, ${s.en}, with oat milk. I'm waiting outside — to take away.`,
        parts: [...t.chip, call(i), s.zh, '燕麦奶', '打包'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { ...t.want, sugar: s.id, milk: 'oat' } },
          { kind: 'dine', value: '外带' },
        ] as Want[],
      };
    },
  },
  {
    id: 'big-cup',
    level: 2,
    build: (p) => {
      const i = p.pick(both(p.brand).filter((x) => x.groups.includes('cup')));
      const t = tempOf(p, i);
      return {
        message: `我要一杯${call(i)}，${t.zh}的，超大杯。`,
        en: `I want a ${enOf(p.brand, call(i))}, ${t.en}, extra large.`,
        parts: [call(i), `${t.zh}的`, '超大杯'],
        wants: [{ kind: 'line', item: i.id, qty: 1, choices: { ...t.want, cup: 'xl' } }] as Want[],
      };
    },
  },
  {
    id: 'double-shot',
    level: 2,
    build: (p) => {
      const i = p.pick(withGroup(p.brand, 'shot'));
      const t = tempOf(p, i);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `帮我买一杯${t.zh}${call(i)}，要双份浓缩，${say}。`,
        en: `Buy me a ${t.en} ${enOf(p.brand, call(i))} with a double shot, ${dineEn}.`.replace('  ', ' '),
        parts: [...t.chip, call(i), '双份浓缩', say],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { ...t.want, shot: 'double' } },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'hot-and-iced',
    level: 3,
    build: (p) => {
      const i = p.pick(both(p.brand));
      return {
        message: `帮我买两杯${call(i)}：一杯冰的，一杯热的。都打包。`,
        en: `Buy me two ${enOf(p.brand, call(i))}s: one iced, one hot. Both to take away.`,
        parts: ['两杯', call(i), '冰的', '热的', '打包'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { temp: 'ice' } },
          { kind: 'line', item: i.id, qty: 1, choices: { temp: 'hot' } },
          { kind: 'dine', value: '外带' },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-less-ice',
    level: 3,
    build: (p) => {
      const i = p.pick(withGroup(p.brand, 'sugar'));
      const t = temps(p.brand, i).length === 2 ? '冰' : '';
      const s = sugarOf(p, i);
      return {
        message: `帮我买两杯${t}${call(i)}，${s.zh}，要少冰。`,
        en: `Buy me two iced ${enOf(p.brand, call(i))}s, ${s.en}, with less ice.`,
        parts: ['两杯', ...(t ? [t] : []), call(i), s.zh, '少冰'],
        wants: [
          { kind: 'line', item: i.id, qty: 2, choices: { ...(t ? { temp: 'ice' } : {}), sugar: s.id } },
          { kind: 'note', value: '少冰' },
        ] as Want[],
      };
    },
  },
  {
    id: 'drink-and-food',
    level: 3,
    build: (p) => {
      const i = p.pick(withGroup(p.brand, 'sugar'));
      const t = tempOf(p, i);
      const s = sugarOf(p, i);
      const f = p.pick(food(p.brand));
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `我要一杯${t.zh}${call(i)}，${s.zh}；再要一个${call(f)}。${say}。`,
        en: `I want a ${t.en} ${enOf(p.brand, call(i))}, ${s.en}; and a ${enOf(p.brand, call(f))} too. ${dineEn[0].toUpperCase()}${dineEn.slice(1)}.`.replace('  ', ' '),
        parts: [...t.chip, call(i), s.zh, '一个', call(f), say],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: { ...t.want, sugar: s.id } },
          { kind: 'line', item: f.id, qty: 1, choices: {} },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'two-drinks',
    level: 3,
    build: (p) => {
      const [a, b] = p.sample(drinks(p.brand), 2);
      const ta = tempOf(p, a);
      const tb = tempOf(p, b);
      const [say, dine, dineEn] = p.pick(DINE_SAY);
      return {
        message: `一杯${ta.zh}${call(a)}，一杯${tb.zh}${call(b)}。${say}，谢谢！`,
        en: `One ${ta.en} ${enOf(p.brand, call(a))}, one ${tb.en} ${enOf(p.brand, call(b))}. ${dineEn[0].toUpperCase()}${dineEn.slice(1)}, thanks!`.replace(/ {2,}/g, ' '),
        parts: [...ta.chip, call(a), ...tb.chip, call(b), say],
        wants: [
          { kind: 'line', item: a.id, qty: 1, choices: ta.want },
          { kind: 'line', item: b.id, qty: 1, choices: tb.want },
          { kind: 'dine', value: dine },
        ] as Want[],
      };
    },
  },
  {
    id: 'oat-no-sugar-two',
    level: 3,
    build: (p) => {
      const i = p.pick(withGroup(p.brand, 'milk').filter((x) => temps(p.brand, x).length === 2));
      return {
        message: `帮我买两杯热${call(i)}，要燕麦奶，不加糖，在店里喝。`,
        en: `Buy me two hot ${enOf(p.brand, call(i))}s with oat milk, no sugar — we'll drink them in the shop.`,
        parts: ['两杯', '热', call(i), '燕麦奶', '不加糖', '在店里喝'],
        wants: [
          { kind: 'line', item: i.id, qty: 2, choices: { temp: 'hot', milk: 'oat', sugar: 'none' } },
          { kind: 'dine', value: '堂食' },
        ] as Want[],
      };
    },
  },
  {
    id: 'deliver-office',
    level: 2,
    extra: true,
    build: (p) => {
      const i = p.pick(both(p.brand));
      const t = tempOf(p, i);
      return {
        message: `帮我点一杯${t.zh}${call(i)}，送到公司。不要餐具。`,
        en: `Order me a ${t.en} ${enOf(p.brand, call(i))}, delivered to the office. No cutlery.`,
        parts: ['外送', ...t.chip, call(i), '公司', '不要餐具'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: t.want },
          { kind: 'mode', value: '外送' },
          { kind: 'address', value: 'office' },
          { kind: 'cutlery', n: 0 },
        ] as Want[],
      };
    },
  },
  {
    id: 'deliver-home',
    level: 3,
    extra: true,
    build: (p) => {
      const i = p.pick(drinks(p.brand));
      return {
        message: `帮我点两杯${call(i)}，送到家里，要两份餐具。`,
        en: `Order me two ${enOf(p.brand, call(i))}s, delivered home, with two sets of cutlery.`,
        parts: ['外送', '两杯', call(i), '家', '两份餐具'],
        wants: [
          { kind: 'line', item: i.id, qty: 2, choices: {} },
          { kind: 'mode', value: '外送' },
          { kind: 'address', value: 'home' },
          { kind: 'cutlery', n: 2 },
        ] as Want[],
      };
    },
  },
  {
    id: 'budget',
    level: 2,
    extra: true,
    build: (p) => {
      const coffees = drinks(p.brand).filter((i) => i.hsk?.includes('咖啡'));
      const cheapest = [...coffees].sort((a, b) => (a.deal ?? a.price) - (b.deal ?? b.price))[0];
      return {
        message: `我只有15块，帮我买一杯最便宜的咖啡。`,
        en: `I only have ¥15 — buy me the cheapest coffee.`,
        parts: ['我只有', '15块', '最便宜', '咖啡'],
        wants: [
          { kind: 'line', item: cheapest.id, qty: 1, choices: {} },
          { kind: 'budget', max: 15 },
        ] as Want[],
      };
    },
  },
  {
    id: 'other-coupon',
    level: 3,
    extra: true,
    build: (p) => {
      const i = p.pick(drinks(p.brand).filter((x) => x.price >= 30));
      const t = tempOf(p, i);
      return {
        message: `帮我买一杯${t.zh}${call(i)}，用满30减5的券，饮品券我下次再用。`,
        en: `Buy me a ${t.en} ${enOf(p.brand, call(i))}. Use the ¥5-off-¥30 coupon — I'm keeping the drink coupon for next time.`,
        parts: [...t.chip, call(i), '优惠券', '满30减5'],
        wants: [
          { kind: 'line', item: i.id, qty: 1, choices: t.want },
          { kind: 'coupon', id: 'off30' },
        ] as Want[],
      };
    },
  },
];

/* ------------------------------------------------------------------ brand */

export const luckin: Brand = {
  id: 'luckin',
  model: 'chain',
  name: '瑞幸咖啡',
  latin: 'luckin coffee',
  merchant: '瑞幸咖啡',
  pitch: 'Order coffee the way you would at a luckin in Beijing: pick the drink, the options, eat in or take away, and pay.',
  colours: { brand: '#1b3a8c', soft: '#e7ecf7', ink: '#ffffff', darkBrand: '#7d98e3', darkSoft: '#1c2438' },
  store: { zh: '北京三里屯店', distance: '350m' },
  categories: [
    { id: 'top', zh: '人气TOP' },
    { id: 'new', zh: '新品' },
    { id: 'coconut', zh: '生椰家族' },
    { id: 'latte', zh: '经典拿铁' },
    { id: 'americano', zh: '美式家族' },
    { id: 'frappe', zh: '瑞纳冰' },
    { id: 'tea', zh: '果蔬茶' },
    { id: 'food', zh: '轻食' },
  ],
  items,
  groups: {
    temp: {
      id: 'temp',
      zh: '温度',
      kind: 'one',
      required: true,
      options: [
        { id: 'ice', zh: '冰' },
        { id: 'hot', zh: '热' },
      ],
    },
    sugar: {
      id: 'sugar',
      zh: '糖度',
      kind: 'one',
      required: true,
      default: 'std',
      options: [
        { id: 'none', zh: '不另外加糖' },
        { id: 'll', zh: '少少甜', sub: '约25%' },
        { id: 'less', zh: '少甜', sub: '约50%' },
        { id: 'std', zh: '标准甜' },
      ],
    },
    milk: {
      id: 'milk',
      zh: '奶',
      kind: 'one',
      required: true,
      default: 'whole',
      options: [
        { id: 'whole', zh: '纯牛奶' },
        { id: 'oat', zh: '燕麦奶' },
        { id: 'thick', zh: '厚乳' },
      ],
    },
    shot: {
      id: 'shot',
      zh: '浓度',
      kind: 'one',
      required: true,
      default: 'std',
      options: [
        { id: 'std', zh: '标准' },
        { id: 'double', zh: '双份浓缩', delta: 3 },
      ],
    },
    cup: {
      id: 'cup',
      zh: '杯型',
      kind: 'one',
      required: true,
      default: 'big',
      options: [
        { id: 'big', zh: '大杯', sub: '16oz' },
        { id: 'xl', zh: '超大杯', sub: '20oz', delta: 3 },
      ],
    },
  },
  rules: [],
  autoCoupon: true,
  fees: [
    { zh: '配送费', amount: 3, per: 'order', delivery: true },
    { zh: '打包费', amount: 1, per: 'item', delivery: true },
  ],
  dine: ['堂食', '外带'],
  code: { zh: '取餐码' },
  delivery: {
    min: 20,
    promo: { min: 30, off: 8 },
    addresses: [
      { id: 'office', zh: '公司', sub: '朝阳区光华路8号' },
      { id: 'home', zh: '家', sub: '朝阳区团结湖路12号' },
    ],
  },
  coupons: [
    { id: 'drink', zh: '饮品券', sub: '一杯饮品享预估到手价', kind: 'deal' },
    { id: 'off30', zh: '满30减5', sub: '满30元可用', kind: 'off', min: 30, value: 5 },
    { id: 'off50', zh: '满50减10', sub: '满50元可用', kind: 'off', min: 50, value: 10 },
  ],
  notes: ['少冰', '去冰', '多加冰', '不要吸管'],
  flow: [
    { id: 'chat', zh: '微信', en: 'the message' },
    { id: 'home', zh: '首页', en: 'home' },
    { id: 'menu', zh: '菜单', en: 'menu' },
    { id: 'spec', zh: '选规格', en: 'options' },
    { id: 'cart', zh: '购物车', en: 'cart' },
    { id: 'checkout', zh: '确认订单', en: 'checkout' },
    { id: 'pay', zh: '微信支付', en: 'pay' },
    { id: 'pickup', zh: '取餐码', en: 'pickup' },
  ],
  tips: {
    chat: 'Orders come from a friend on WeChat. Press and hold any Chinese to see what it means.',
    home: 'Most people use 到店取 (pick up in store): order on the way, collect at the counter without queueing.',
    menu: 'The big price is 预估到手 — what you pay after the best coupon. The crossed-out number is the list price.',
    spec: 'luckin offers only 冰 (iced) or 热 (hot). Less ice or no ice (少冰, 去冰) is written in 备注 at checkout.',
    cart: 'Each different set of options is its own line: an iced and a hot latte are two lines.',
    checkout: '打包 and 带走 both mean 外带. The app picks the best coupon by itself — 已选1张. For 外送, choose the address and 餐具数量.',
    pay: 'In real life this is your WeChat Pay PIN or Face ID. Here any six taps will do.',
    pickup: 'After paying, the 取餐码 is what the barista calls out, and what the screen by the counter shows.',
  },
  tour: [
    { target: 'store', zh: '取餐门店', en: 'The store you collect from, and how far it is. Check it before you order.' },
    { target: 'mode', zh: '自提', en: '自提 is pickup, 外送 is delivery.' },
    { target: 'rail', zh: '菜单', en: 'The categories. Tap one to jump to it; the list keeps them in step as you scroll.' },
    { target: 'add', zh: '选规格', en: '选规格 opens the options (iced or hot, sugar, milk, size). A round + adds food straight to the cart.' },
    { target: 'cart-bar', zh: '购物车', en: 'The cart: how many things, and the total so far.' },
    { target: 'checkout-btn', zh: '去结算', en: '去结算 — check out when the order is complete.' },
  ],
  words: [
    { en: 'Drinks and food', words: ['咖啡', '拿铁', '美式', '生椰拿铁', '燕麦奶', '纯牛奶', '厚乳', '瑞纳冰', '果蔬茶', '轻食', '可颂'] },
    { en: 'Options', words: ['温度', '冰', '热', '糖度', '不另外加糖', '少少甜', '少甜', '标准甜', '奶', '浓度', '双份浓缩', '杯型', '大杯', '超大杯'] },
    { en: 'Checkout', words: ['去结算', '确认订单', '自提', '外送', '取餐方式', '堂食', '外带', '打包', '带走', '优惠券', '备注', '少冰', '去冰', '多加冰'] },
    { en: 'Delivery', words: ['外送', '收货地址', '公司', '家', '预计送达', '配送费', '打包费', '满减', '起送', '餐具数量', '无需餐具'] },
    { en: 'Paying and pickup', words: ['去支付', '微信支付', '零钱', '输入支付密码', '支付成功', '合计', '已优惠', '取餐码', '制作中', '请取餐'] },
  ],
  templates,
  photos: {
    'ham-croissant': {},
    'matcha-frappe': {},
    'long-black': {},
    'mocha': {},
    'flat-white': {},
    'cappuccino': {},
    'vanilla-latte': {},
    'latte-macchiato': {},
    'latte-glass': {},
    'latte-art': {},
    'coconut-cream-coffee': {},
    'coconut-coffee': {},
    latte: { word: '咖啡' },
    'iced-latte': {},
    americano: { word: '咖啡' },
    'iced-coffee': {},
    frappe: {},
    tea: { word: '绿茶' },
    'lemon-tea': { word: '红茶' },
    'green-juice': {},
    croissant: { word: '面包' },
    sandwich: {},
    tiramisu: {},
    banner: { word: '咖啡' },
  },
  banner: { photo: 'banner', zh: '新品上市', sub: '酱香拿铁' },
  friend: '小林',
  glossary: {
    瑞幸咖啡: { py: 'Ruìxìng kāfēi', en: 'luckin coffee', hsk: ['咖啡'] },
    瑞幸: { py: 'Ruìxìng', en: 'luckin' },
    小林: { py: 'Xiǎo Lín', en: 'Xiao Lin (your friend)' },
    北京三里屯店: { py: 'Běijīng Sānlǐtún diàn', en: 'the Sanlitun store, Beijing', hsk: ['北京'] },
    // home
    新品上市: { py: 'xīnpǐn shàngshì', en: 'new on the menu' },
    // categories and tags
    人气TOP: { py: 'rénqì TOP', en: 'most popular' },
    新品: { py: 'xīnpǐn', en: 'new' },
    生椰家族: { py: 'shēngyē jiāzú', en: 'the coconut-milk family' },
    经典拿铁: { py: 'jīngdiǎn nátiě', en: 'classic lattes' },
    美式家族: { py: 'měishì jiāzú', en: 'the americano family' },
    瑞纳冰: { py: 'ruìnà bīng', en: 'frappé', note: 'blended ice drinks — luckin’s name' },
    果蔬茶: { py: 'guǒshū chá', en: 'fruit & vegetable teas', hsk: ['茶'] },
    轻食: { py: 'qīngshí', en: 'light food' },
    爆款: { py: 'bàokuǎn', en: 'best-seller' },
    IIAC金奖豆: { py: 'IIAC jīnjiǎng dòu', en: 'IIAC gold-medal beans', note: 'a coffee-bean award luckin advertises' },
    // items
    生椰拿铁: { py: 'shēngyē nátiě', en: 'coconut latte', note: 'luckin’s most famous drink: coffee with fresh coconut milk' },
    冰吸生椰拿铁: { py: 'bīngxī shēngyē nátiě', en: 'iced coconut latte (iced only)' },
    椰云拿铁: { py: 'yēyún nátiě', en: 'coconut-cloud latte' },
    酱香拿铁: { py: 'jiàngxiāng nátiě', en: 'Moutai-flavoured latte', note: 'made with a little baijiu liqueur' },
    拿铁: { py: 'nátiě', en: 'latte' },
    丝绒拿铁: { py: 'sīróng nátiě', en: 'velvet latte' },
    厚乳拿铁: { py: 'hòurǔ nátiě', en: 'rich-milk latte' },
    香草拿铁: { py: 'xiāngcǎo nátiě', en: 'vanilla latte' },
    卡布奇诺: { py: 'kǎbùqínuò', en: 'cappuccino' },
    澳瑞白: { py: 'àoruìbái', en: 'flat white' },
    摩卡: { py: 'mókǎ', en: 'mocha' },
    标准美式: { py: 'biāozhǔn měishì', en: 'americano', note: 'people just say 美式' },
    美式: { py: 'měishì', en: 'americano', note: 'on the menu as 标准美式' },
    加浓美式: { py: 'jiānóng měishì', en: 'strong americano' },
    橙C美式: { py: 'chéng C měishì', en: 'orange-juice americano (iced only)' },
    抹茶瑞纳冰: { py: 'mǒchá ruìnà bīng', en: 'matcha frappé' },
    巧克力瑞纳冰: { py: 'qiǎokèlì ruìnà bīng', en: 'chocolate frappé' },
    轻轻茉莉: { py: 'qīngqīng mòlì', en: 'light jasmine tea' },
    冰摇柠檬茶: { py: 'bīngyáo níngméng chá', en: 'iced shaken lemon tea', hsk: ['茶'] },
    羽衣轻体果蔬茶: { py: 'yǔyī qīngtǐ guǒshū chá', en: 'kale fruit-and-veg drink', hsk: ['茶'] },
    原味可颂: { py: 'yuánwèi kěsòng', en: 'plain croissant' },
    火腿芝士可颂: { py: 'huǒtuǐ zhīshì kěsòng', en: 'ham and cheese croissant' },
    鸡肉三明治: { py: 'jīròu sānmíngzhì', en: 'chicken sandwich' },
    提拉米苏: { py: 'tílāmǐsū', en: 'tiramisu' },
    可颂: { py: 'kěsòng', en: 'croissant' },
    咖啡: { py: 'kāfēi', en: 'coffee' },
    // descriptions
    生椰和咖啡的经典搭配: { py: 'shēngyē hé kāfēi de jīngdiǎn dāpèi', en: 'coconut milk and coffee, the classic pair', hsk: ['和', '咖啡', '的'] },
    '冰冰爽爽，椰香更浓': { py: 'bīngbīng shuǎngshuǎng, yē xiāng gèng nóng', en: 'ice-cold, with more coconut' },
    '椰云奶盖，口感绵密': { py: 'yēyún nǎigài, kǒugǎn miánmì', en: 'coconut foam on top, soft and smooth' },
    香气浓郁的新品拿铁: { py: 'xiāngqì nóngyù de xīnpǐn nátiě', en: 'a new latte with a rich aroma' },
    经典意式拿铁: { py: 'jīngdiǎn yìshì nátiě', en: 'a classic Italian latte' },
    口感丝滑: { py: 'kǒugǎn sīhuá', en: 'silky smooth' },
    奶香更浓: { py: 'nǎi xiāng gèng nóng', en: 'more milky' },
    香草风味: { py: 'xiāngcǎo fēngwèi', en: 'vanilla flavour' },
    奶泡更多的意式咖啡: { py: 'nǎipào gèng duō de yìshì kāfēi', en: 'Italian coffee with more milk foam', hsk: ['多', '的', '咖啡'] },
    咖啡味更浓的小杯拿铁: { py: 'kāfēi wèi gèng nóng de xiǎo bēi nátiě', en: 'a small latte that tastes more of coffee', hsk: ['咖啡', '小', '杯'] },
    巧克力和咖啡: { py: 'qiǎokèlì hé kāfēi', en: 'chocolate and coffee', hsk: ['和', '咖啡'] },
    经典美式咖啡: { py: 'jīngdiǎn měishì kāfēi', en: 'a classic americano', hsk: ['咖啡'] },
    咖啡味更浓: { py: 'kāfēi wèi gèng nóng', en: 'tastes more of coffee', hsk: ['咖啡'] },
    橙汁和美式咖啡: { py: 'chéngzhī hé měishì kāfēi', en: 'orange juice and americano', hsk: ['和', '咖啡'] },
    '抹茶冰沙，没有咖啡': { py: 'mǒchá bīngshā, méiyǒu kāfēi', en: 'matcha slush, no coffee', hsk: ['没有', '咖啡'] },
    巧克力冰沙: { py: 'qiǎokèlì bīngshā', en: 'chocolate slush' },
    清香茉莉花茶: { py: 'qīngxiāng mòlìhuā chá', en: 'fragrant jasmine tea', hsk: ['茶'] },
    柠檬和红茶: { py: 'níngméng hé hóngchá', en: 'lemon and black tea', hsk: ['和', '红茶'] },
    羽衣甘蓝和水果: { py: 'yǔyī gānlán hé shuǐguǒ', en: 'kale and fruit', hsk: ['和', '水果'] },
    外酥里软: { py: 'wài sū lǐ ruǎn', en: 'crisp outside, soft inside' },
    火腿和芝士: { py: 'huǒtuǐ hé zhīshì', en: 'ham and cheese', hsk: ['和'] },
    鸡肉和生菜: { py: 'jīròu hé shēngcài', en: 'chicken and lettuce', hsk: ['和'] },
    咖啡味的蛋糕: { py: 'kāfēi wèi de dàngāo', en: 'a coffee-flavoured cake', hsk: ['咖啡', '的', '蛋糕'] },
    // option groups
    温度: { py: 'wēndù', en: 'Temperature' },
    冰: { py: 'bīng', en: 'iced', hsk: ['冰'] },
    热: { py: 'rè', en: 'hot', hsk: ['热'] },
    糖度: { py: 'tángdù', en: 'Sugar' },
    不另外加糖: { py: 'bú lìngwài jiā táng', en: 'no added sugar', note: 'what the app says for "no sugar"' },
    少少甜: { py: 'shǎoshǎo tián', en: 'a little sweet', note: '≈ 25% sugar' },
    少甜: { py: 'shǎo tián', en: 'less sweet', note: '≈ 50% sugar', hsk: ['少'] },
    标准甜: { py: 'biāozhǔn tián', en: 'normal sweetness' },
    约: { py: 'yuē', en: 'about' },
    奶: { py: 'nǎi', en: 'Milk' },
    纯牛奶: { py: 'chún niúnǎi', en: 'whole milk', hsk: ['牛奶'] },
    燕麦奶: { py: 'yànmài nǎi', en: 'oat milk' },
    厚乳: { py: 'hòurǔ', en: 'extra-rich milk' },
    浓度: { py: 'nóngdù', en: 'Strength' },
    标准: { py: 'biāozhǔn', en: 'standard' },
    双份浓缩: { py: 'shuāngfèn nóngsuō', en: 'double shot', note: 'two shots of espresso; costs ¥3 more' },
    杯型: { py: 'bēixíng', en: 'Cup size', hsk: ['杯'] },
    大杯: { py: 'dà bēi', en: 'large', note: 'the usual size, 16oz', hsk: ['大', '杯'] },
    超大杯: { py: 'chāo dà bēi', en: 'extra large', note: '+¥3', hsk: ['大', '杯'] },
    // coupons and notes
    饮品券: { py: 'yǐnpǐn quàn', en: 'drink coupon' },
    一杯饮品享预估到手价: { py: 'yì bēi yǐnpǐn xiǎng yùgū dàoshǒu jià', en: 'one drink at its estimated price' },
    满30减5: { py: 'mǎn sānshí jiǎn wǔ', en: '¥5 off when you spend ¥30' },
    满50减10: { py: 'mǎn wǔshí jiǎn shí', en: '¥10 off when you spend ¥50' },
    满30元可用: { py: 'mǎn sānshí yuán kěyòng', en: 'for orders of ¥30 or more' },
    满50元可用: { py: 'mǎn wǔshí yuán kěyòng', en: 'for orders of ¥50 or more' },
    少冰: { py: 'shǎo bīng', en: 'less ice', note: 'not a 温度 option: write it in 备注', hsk: ['少', '冰'] },
    去冰: { py: 'qù bīng', en: 'no ice', hsk: ['冰'] },
    多加冰: { py: 'duō jiā bīng', en: 'extra ice', hsk: ['多', '冰'] },
    不要吸管: { py: 'bú yào xīguǎn', en: 'no straw', hsk: ['不', '要'] },
    // the friend's words
    帮我: { py: 'bāng wǒ', en: 'for me (help me)', hsk: ['帮', '我'] },
    买: { py: 'mǎi', en: 'buy', hsk: ['买'] },
    一杯: { py: 'yì bēi', en: 'a cup of', hsk: ['一', '杯'] },
    两杯: { py: 'liǎng bēi', en: 'two cups of', note: '两, not 二, before a measure word', hsk: ['两', '杯'] },
    一个: { py: 'yí ge', en: 'one', hsk: ['一', '个'] },
    我想喝: { py: 'wǒ xiǎng hē', en: "I'd like to drink", hsk: ['我', '想', '喝'] },
    要: { py: 'yào', en: 'want, with', hsk: ['要'] },
    热的: { py: 'rè de', en: 'hot', hsk: ['热', '的'] },
    冰的: { py: 'bīng de', en: 'iced', hsk: ['冰', '的'] },
    不加糖: { py: 'bù jiā táng', en: 'no sugar', note: 'the app says 不另外加糖' },
    打包: { py: 'dǎbāo', en: 'to take away', note: 'choose 外带 at checkout' },
    带走: { py: 'dàizǒu', en: 'to take away', note: 'choose 外带 at checkout', hsk: ['走'] },
    在店里喝: { py: 'zài diàn lǐ hē', en: 'drink it in the shop', note: 'choose 堂食 at checkout', hsk: ['在', '里', '喝'] },
    我在外面等你: { py: 'wǒ zài wàimiàn děng nǐ', en: "I'm waiting for you outside", hsk: ['我', '在', '外面', '等', '你'] },
    都: { py: 'dōu', en: 'both, all', hsk: ['都'] },
    再要: { py: 'zài yào', en: 'and also', hsk: ['再', '要'] },
    谢谢: { py: 'xièxie', en: 'thanks', hsk: ['谢谢'] },
    帮我点: { py: 'bāng wǒ diǎn', en: 'order for me', hsk: ['帮', '我', '点'] },
    公司: { py: 'gōngsī', en: 'the office', hsk: ['公司'] },
    家: { py: 'jiā', en: 'home', hsk: ['家'] },
    家里: { py: 'jiā lǐ', en: 'home', hsk: ['家', '里'] },
    两份餐具: { py: 'liǎng fèn cānjù', en: 'two sets of cutlery', hsk: ['两', '份'] },
    最便宜: { py: 'zuì piányi', en: 'the cheapest', hsk: ['最', '便宜'] },
    的: { py: 'de', en: '(links a description to a noun)', hsk: ['的'] },
    券: { py: 'quàn', en: 'coupon' },
    我下次再用: { py: 'wǒ xià cì zài yòng', en: "I'll use it next time", hsk: ['我', '下次', '再', '用'] },
    朝阳区光华路8号: { py: 'Cháoyáng qū Guānghuá lù bā hào', en: 'No. 8 Guanghua Road, Chaoyang', hsk: ['号'] },
    朝阳区团结湖路12号: { py: 'Cháoyáng qū Tuánjiéhú lù shí’èr hào', en: 'No. 12 Tuanjiehu Road, Chaoyang', hsk: ['号'] },
  },
};
