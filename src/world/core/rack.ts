/**
 * The rack talk (prompt §12, W5): a clothes shop's conversation on top of
 * Y1's shop engine. The seller says 「你好！随便看看。」 and the rack sheet
 * shows what hangs there; you look at a thing (tap its card, or name it),
 * and then, in words or with the sheet's buttons —
 *
 *   「这件多少钱？」 → 「旗袍五百块。有红的、蓝的。」
 *   「有绿的吗？」   → 「有！绿的。」 / 「没有绿的，有红的、蓝的。」
 *   「我可以试试吗？」→ 「可以！试衣间在那儿。」 (the sheet shows you in it)
 *   「太贵了」       → 「对不起，不能便宜。」 — only 潘家园 bargains (Y6's engine)
 *   「我要这件」     → the 支付宝 flow (Y2) → 「谢谢！穿着走吗？」
 *   「穿着走」 / 「不用，放袋子里」 → worn out of the shop, or into the 衣柜
 *
 * The 理发店 is a rack of hair: 「剪短一点」, 「我要马尾」, 「染成棕色」 → the
 * price → 好 → paid, and your hair changes (the one place besides the
 * mirror; it costs money).
 *
 * Pure: `ScriptedDialogue` calls `rackTurn` at a node with `rack`; the lines
 * are HSK 1–2 apart from the clothes' own names (checked by a test).
 */

import { holds } from './flags';
import { haggle, startHaggle, type Bargain, type Haggle } from './bargain';
import { LOOK_NAMES, HAIR_COLOURS, HAIR_STYLES, type HairColour, type HairStyle, type Slot } from './looks';
import { priceZh } from './shop';
import type { ClothesContent, Clothing, Rack } from './wardrobe';
import type { Scene, WorldSave } from './types';

/** The thing looked at: a garment in one colour, tried on or not. */
export interface RackFocus {
  item: string;
  colour: string;
  tried?: boolean;
}

/** What a rack talk keeps between turns. */
export interface RackState {
  /** `item:colour` on sale now (seasons and festivals), fixed as the talk began */
  onSale: string[];
  focus?: RackFocus;
  /** bargaining at 潘家园: the price on the table for the focus */
  haggle?: Haggle;
  /** just paid for: waiting for 穿着走 or 放袋子里 */
  bought?: { id: string; slot: Slot; zh: string; en: string };
  /** at the barber's: the cut and the colour asked for, and the hair you came in with */
  hair?: { style?: HairStyle; colour?: HairColour };
  hairNow?: { style: HairStyle; colour: HairColour };
}

/** The seller's lines around the names (HSK 1–2, plus 随便 and 试衣间 as the situation's words). */
export const RACK_LINES = {
  hello: { zh: '你好！随便看看。', en: 'Hello! Have a look around.' },
  barber: { zh: '你好！今天怎么剪？', en: 'Hello! How shall I cut it today?' },
  which: { zh: '你看哪个？', en: 'Which one are you looking at?' },
  try: { zh: '可以！试衣间在那儿。', en: 'Sure! The fitting room is over there.' },
  tryOn: { zh: '可以！你试试。', en: 'Sure — try it on.' },
  nice: { zh: '很好看！', en: 'It looks good on you!' },
  firm: { zh: '对不起，不能便宜。', en: 'Sorry, the price is the price.' },
  // a reading of its own: the word list reads 穿着 as chuānzhuó (clothing), here it is chuānzhe (wearing it)
  thanks: { zh: '谢谢！穿着走吗？', en: 'Thank you! Will you wear it out?', pinyin: 'Xièxie! Chuānzhe zǒu ma?' },
  wear: { zh: '好看！再见！', en: 'Looks good! Bye!' },
  bag: { zh: '好，给你袋子。再见！', en: 'All right, here’s a bag. Bye!' },
  none: { zh: '对不起，这个我们没有。', en: 'Sorry, we don’t sell that here.' },
  bye: { zh: '好，再见！', en: 'All right — bye!' },
  cutDone: { zh: '好了！你看看，好看吗？', en: 'Done! Have a look — do you like it?' },
  sameHair: { zh: '你的头发已经是这样的了！', en: 'Your hair is like that already!' },
};

/** The garment's colour words as a seller says them: 红的、蓝的 */
const coloursZh = (c: Clothing, onSale: readonly string[]) =>
  c.colours.filter((k) => onSale.includes(`${c.id}:${k.id}`)).map((k) => k.zh).join('、');

/** The stems 红 蓝 黑 … and the colour ids they name, from every garment. */
function colourStems(clothes: Pick<ClothesContent, 'clothes'>): Array<{ stem: string; id: string }> {
  const out = new Map<string, string>();
  for (const c of clothes.clothes) for (const k of c.colours) out.set(k.zh.replace(/的$/, ''), k.id);
  return [...out].map(([stem, id]) => ({ stem, id })).sort((a, b) => b.stem.length - a.stem.length);
}

/** The rack's things now (by `item`), and which of their colours. */
export function rackStock(rack: Rack, clothes: Pick<ClothesContent, 'clothes'>, save?: WorldSave): string[] {
  return clothes.clothes
    .filter((c) => c.shop === rack.id && (!save || holds(c.when, save)))
    .flatMap((c) => c.colours.filter((k) => !save || holds(k.when, save)).map((k) => `${c.id}:${k.id}`));
}

/** The price of the focus: what the seller has come down to at 潘家园, else the tag. */
export function focusPrice(c: Clothing, r: RackState): number {
  return r.haggle && r.focus?.item === c.id ? r.haggle.price : c.price;
}

/** 潘家园's lowest for a garment: about three fifths, a nice number. */
export function rackBargain(c: Clothing): Bargain {
  const v = c.price * 0.6;
  const step = v >= 20 ? 5 : 1;
  return { open: c.price, limit: Math.ceil(v / step) * step };
}

/** A rack's conversation: one line that looks, asks, tries and buys (the engine does the rest). */
export function rackScene(rack: Rack, clothes: Pick<ClothesContent, 'clothes'>): Scene {
  const things = clothes.clothes.filter((c) => c.shop === rack.id);
  const menu = rack.hair
    ? `a cut ${rack.hair.cut} 元, a colour ${rack.hair.dye} 元`
    : things.map((c) => `${c.zh} (${c.en}) ${c.price} 元`).join(' · ');
  const how = rack.hair
    ? 'Say what you want — 「剪短一点」, 「我要马尾」, 「染成棕色」 — then 「好」 and pay.'
    : `Tap a card or name a thing and ask 「这件多少钱？」, 「有红的吗？」, 「我可以试试吗？」, then 「我要这件」.${rack.bargain ? ' Here you can bargain: 「太贵了」, 「三十块行吗？」.' : ''}`;
  const hello = rack.hair ? RACK_LINES.barber : RACK_LINES.hello;
  return {
    id: `rack-${rack.id}`,
    map: rack.map,
    npc: rack.npc,
    trigger: 'talk',
    // below the story (lower first) and a first meeting, above small talk
    priority: 3.5,
    ...(rack.when ? { when: rack.when } : {}),
    start: 'a',
    nodes: [{ id: 'a', say: hello.zh, translate: hello.en, rack: { rack: rack.id }, why: `${rack.about} ${menu}. ${how}` }],
  };
}

export interface RackTurn {
  zh: string;
  en: string;
  rack: RackState;
  /** pay this now (the phone), for the focus or the hair */
  due?: { total: number; clothes?: RackState['bought']; hair?: RackState['hair'] };
  /** wear it out (`wear`) or into the wardrobe (`bag`): the talk ends */
  after?: 'wear' | 'bag';
  /** walked away */
  bye?: boolean;
}

const TRY = /试/;
const PRICE = /多少钱|几块|多少|什么价/;
const BUY = /我要|要这|买|就这|就要/;
const NO_BUY = /不要|不买/;
const CHEAPER = /太贵|便宜|贵了|少一点|少点/;
const WEAR = /穿着走|穿着|穿上|现在穿|就穿/;
const BAG = /袋|放|不用|不穿|回家/;
const BYE = /再见|拜拜|不要了|不买了|算了|走了|没有了|就这些/;
const YES = /^(好|好的|行|可以|对|嗯|是)/;

/** The garments of the whole content named in the text, longest names first: `[id, where]`. */
function named(text: string, clothes: Pick<ClothesContent, 'clothes'>): Clothing[] {
  const found: Array<[number, Clothing]> = [];
  let rest = text;
  for (const c of [...clothes.clothes].sort((a, b) => b.zh.length - a.zh.length)) {
    const i = rest.indexOf(c.zh);
    if (i < 0) continue;
    found.push([i, c]);
    rest = rest.slice(0, i) + ' '.repeat(c.zh.length) + rest.slice(i + c.zh.length);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}

/** The colour asked for (红 in 「有红的吗」, 「红的」, 「红色」), after the garments' own names are taken out. */
function colourAsked(text: string, clothes: Pick<ClothesContent, 'clothes'>): string | null {
  let rest = text;
  for (const c of clothes.clothes) rest = rest.split(c.zh).join(' ');
  for (const { stem } of colourStems(clothes)) if (new RegExp(`${stem}(的|色)`).test(rest)) return stem;
  return null;
}

/** The price line: 「旗袍五百块。有红的、蓝的。」 */
function priceLine(c: Clothing, r: RackState): { zh: string; en: string } {
  const cols = c.colours.filter((k) => r.onSale.includes(`${c.id}:${k.id}`));
  const p = focusPrice(c, r);
  return {
    zh: `${c.zh}${priceZh(p)}。${cols.length > 1 ? `有${coloursZh(c, r.onSale)}。` : ''}`,
    en: `The ${c.en}: ${p} 元.${cols.length > 1 ? ` In ${cols.map((k) => k.en).join(', ')}.` : ''}`,
  };
}

/** One line of yours at a clothes rack (null: not rack words — the usual requests and misses take it). */
export function rackTurn(rack: Rack, clothes: Pick<ClothesContent, 'clothes'>, r: RackState, text: string, choice?: string): RackTurn | null {
  const t = text.trim();
  if (rack.hair) return hairTurn(rack, r, t);
  const say = (zh: string, en: string, next: RackState = r, extra: Partial<RackTurn> = {}): RackTurn => ({ zh, en, rack: next, ...extra });

  // just paid: wear it out, or into a bag
  if (r.bought) {
    if (WEAR.test(t) || (YES.test(t) && !/不/.test(t))) return say(RACK_LINES.wear.zh, RACK_LINES.wear.en, r, { after: 'wear' });
    if (BAG.test(t) || /^不/.test(t) || BYE.test(t)) return say(RACK_LINES.bag.zh, RACK_LINES.bag.en, r, { after: 'bag' });
    return null;
  }

  const byId = (id: string) => clothes.clothes.find((c) => c.id === id);
  const onRack = (c: Clothing) => c.shop === rack.id;
  const onSale = (c: Clothing) => c.colours.some((k) => r.onSale.includes(`${c.id}:${k.id}`));
  const firstColour = (c: Clothing) => c.colours.find((k) => r.onSale.includes(`${c.id}:${k.id}`))?.id ?? c.colours[0]!.id;
  const refocus = (c: Clothing, colour?: string): RackState => {
    const same = r.focus?.item === c.id;
    const { haggle: h, ...rest } = r;
    return { ...rest, focus: { item: c.id, colour: colour ?? (same ? r.focus!.colour : firstColour(c)), ...(same && r.focus?.tried ? { tried: true } : {}) }, ...(same && h ? { haggle: h } : {}) };
  };

  // a card tapped on the sheet: `item` or `item:colour`
  let next = r;
  let picked = false;
  if (choice) {
    const [id, col] = choice.split(':');
    const c = id ? byId(id) : undefined;
    if (c && onRack(c) && onSale(c)) {
      next = refocus(c, col && r.onSale.includes(`${c.id}:${col}`) ? col : undefined);
      picked = true;
    }
  }
  // a thing named
  const names = named(t, clothes);
  const here = names.find((c) => onRack(c));
  if (!here && names.length && !picked) return say(RACK_LINES.none.zh, RACK_LINES.none.en);
  if (here) {
    if (!onSale(here)) return say(`现在没有${here.zh}。`, `No ${here.en} at the moment.`);
    next = refocus(here);
    picked = true;
  }
  const focus = next.focus && byId(next.focus.item);

  // a colour asked for
  const stem = colourAsked(t, clothes);
  if (stem) {
    if (!focus) return say(RACK_LINES.which.zh, RACK_LINES.which.en, next);
    const k = focus.colours.find((x) => x.zh.replace(/的$/, '') === stem);
    if (k && next.onSale.includes(`${focus.id}:${k.id}`)) {
      next = { ...next, focus: { ...next.focus!, colour: k.id } };
      // 「我要红的」: the colour, and the buying below
      if (!(BUY.test(t) && !NO_BUY.test(t)) && !TRY.test(t)) return say(`有！${k.zh}。`, `Yes! In ${k.en}.`, next);
    } else {
      const others = coloursZh(focus, next.onSale);
      return say(`没有${stem}的，有${others}。`, `Not in that colour — ${focus.colours.filter((x) => next.onSale.includes(`${focus.id}:${x.id}`)).map((x) => x.en).join(', ')}.`, next);
    }
  }

  // trying on
  if (TRY.test(t)) {
    if (!focus) return say(RACK_LINES.which.zh, RACK_LINES.which.en, next);
    const l = focus.slot === 'top' || focus.slot === 'bottom' ? RACK_LINES.try : RACK_LINES.tryOn;
    return say(l.zh, l.en, { ...next, focus: { ...next.focus!, tried: true } });
  }

  // bargaining: only at 潘家园
  if (focus && rack.bargain) {
    const b = rackBargain(focus);
    const h = haggle(b, next.haggle ?? startHaggle(b), t);
    if (h && h.kind === 'gone') return say(h.zh, h.en, next, { bye: true });
    if (h && h.kind === 'deal') {
      const bargained = { ...next, haggle: h.haggle };
      return say(h.zh, h.en, bargained, { due: { total: h.haggle.price, clothes: boughtOf(focus, next.focus!.colour) } });
    }
    if (h && h.kind !== 'price') return say(h.zh, h.en, { ...next, haggle: h.haggle });
  } else if (CHEAPER.test(t)) {
    return say(RACK_LINES.firm.zh, RACK_LINES.firm.en, next);
  }

  // the price
  if (PRICE.test(t)) {
    if (!focus) return say(RACK_LINES.which.zh, RACK_LINES.which.en, next);
    const l = priceLine(focus, next);
    return say(l.zh, l.en, next);
  }

  // buying
  if (BUY.test(t) && !NO_BUY.test(t)) {
    if (!focus) return say(RACK_LINES.which.zh, RACK_LINES.which.en, next);
    return say('', '', next, { due: { total: focusPrice(focus, next), clothes: boughtOf(focus, next.focus!.colour) } });
  }

  if (BYE.test(t)) return say(RACK_LINES.bye.zh, RACK_LINES.bye.en, next, { bye: true });

  // only a thing named or picked: its price
  if (picked && focus) {
    const l = priceLine(focus, next);
    return say(l.zh, l.en, next);
  }
  return null;
}

function boughtOf(c: Clothing, colour: string): NonNullable<RackState['bought']> {
  const k = c.colours.find((x) => x.id === colour) ?? c.colours[0]!;
  const col = c.colours.length > 1 ? k.zh.replace(/的$/, '') : '';
  const name = `${c.colours.length > 1 ? `${k.en} ` : ''}${c.en}`;
  return { id: `${c.id}:${k.id}`, slot: c.slot, zh: `一${c.measure}${col}${c.zh}`, en: `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}` };
}

// ---------------------------------------------------------------------------
// The barber's: hair
// ---------------------------------------------------------------------------

/** Which style is one shorter (剪短一点). */
export const SHORTER: Record<HairStyle, HairStyle> = {
  long: 'bob', ponytail: 'bob', buns: 'bob', curly: 'short', bob: 'short', fringe: 'short', side: 'short', short: 'buzz', buzz: 'bald', bald: 'bald',
};

/** 「染成棕色」: the hair colours by their Chinese names (棕色, 金色 …), longest first. */
const HAIR_COLOUR_WORDS: Array<[string, HairColour]> = (HAIR_COLOURS as readonly HairColour[])
  .map((c) => [LOOK_NAMES.colour[c][0], c] as [string, HairColour])
  .sort((a, b) => b[0].length - a[0].length);

const HAIR_STYLE_WORDS: Array<[string, HairStyle]> = (HAIR_STYLES as readonly HairStyle[])
  .flatMap((s) => [[LOOK_NAMES.hair[s][0], s] as [string, HairStyle]])
  .concat([['光头', 'bald'], ['寸头', 'buzz'], ['马尾', 'ponytail'], ['丸子头', 'buns'], ['卷', 'curly'], ['刘海', 'fringe']])
  .sort((a, b) => b[0].length - a[0].length);

/** The barber's price for a cut and/or a colour. */
export const hairPrice = (rack: Rack, h: RackState['hair']) => (h?.style ? rack.hair!.cut : 0) + (h?.colour ? rack.hair!.dye : 0);

/** 「剪短一点，三十块。」 / 「染成棕色，四十块。」 */
export function hairAsk(h: NonNullable<RackState['hair']>, rack: Rack): { zh: string; en: string } {
  const parts: string[] = [];
  const en: string[] = [];
  if (h.style) {
    parts.push(LOOK_NAMES.hair[h.style][0]);
    en.push(`a ${LOOK_NAMES.hair[h.style][1]} cut`);
  }
  if (h.colour) {
    parts.push(`染成${LOOK_NAMES.colour[h.colour][0]}`);
    en.push(`dyed ${LOOK_NAMES.colour[h.colour][1]}`);
  }
  const p = hairPrice(rack, h);
  return { zh: `${parts.join('，')}，${priceZh(p)}。好吗？`, en: `${en.join(' and ')}: ${p} 元. All right?` };
}

/** A line at the barber's: a cut (剪短一点, a style's name), a colour (染成棕色), the price, 好. */
function hairTurn(rack: Rack, r: RackState, t: string): RackTurn | null {
  const say = (zh: string, en: string, next: RackState = r, extra: Partial<RackTurn> = {}): RackTurn => ({ zh, en, rack: next, ...extra });
  const want = { ...r.hair };
  let asked = false;
  if (/短一点|短点|剪短/.test(t)) {
    const from = want.style ?? r.hairNow?.style ?? 'short';
    want.style = SHORTER[from];
    asked = true;
  } else {
    const s = HAIR_STYLE_WORDS.find(([w]) => t.includes(w));
    if (s) {
      want.style = s[1];
      asked = true;
    }
  }
  const c = /染|色/.test(t) ? HAIR_COLOUR_WORDS.find(([w]) => t.includes(w) || (/染/.test(t) && t.includes(w.replace(/色$/, '')))) : undefined;
  if (c) {
    want.colour = c[1];
    asked = true;
  }
  if (asked) {
    const same = (!want.style || want.style === r.hairNow?.style) && (!want.colour || want.colour === r.hairNow?.colour);
    if (same) return say(RACK_LINES.sameHair.zh, RACK_LINES.sameHair.en, { ...r, hair: {} });
    const l = hairAsk(want, rack);
    return say(l.zh, l.en, { ...r, hair: want });
  }
  if (PRICE.test(t)) {
    if (want.style || want.colour) {
      const p = hairPrice(rack, want);
      return say(`${priceZh(p)}。`, `${p} 元.`);
    }
    return say(`剪头${priceZh(rack.hair!.cut)}，染头发${priceZh(rack.hair!.dye)}。`, `A cut is ${rack.hair!.cut} 元, a colour ${rack.hair!.dye} 元.`);
  }
  if ((want.style || want.colour) && ((YES.test(t) && !/不/.test(t)) || BUY.test(t))) {
    return say('', '', r, { due: { total: hairPrice(rack, want), hair: want } });
  }
  if (BYE.test(t) || /^不/.test(t)) return say(RACK_LINES.bye.zh, RACK_LINES.bye.en, r, { bye: true });
  return null;
}

/** What a patient player says at a rack (💡 and the solver): look at the first thing, try it, buy it, wear it out. */
export function rackHint(rack: Rack, clothes: Pick<ClothesContent, 'clothes'>, r: RackState): { word: string; frame: string; full: string } | undefined {
  if (rack.hair) {
    if (r.hair?.style || r.hair?.colour) return { word: '好', frame: '___，谢谢。', full: '好，谢谢。' };
    return { word: '短', frame: '剪___一点。', full: '剪短一点。' };
  }
  if (r.bought) return { word: '穿着走', frame: '我___。', full: '我穿着走。' };
  const focus = r.focus && clothes.clothes.find((c) => c.id === r.focus!.item);
  if (!focus) {
    const first = clothes.clothes.find((c) => c.shop === rack.id && c.colours.some((k) => r.onSale.includes(`${c.id}:${k.id}`)));
    return first ? { word: first.zh, frame: `这${first.measure}___多少钱？`, full: `这${first.measure}${first.zh}多少钱？` } : undefined;
  }
  if (!r.focus!.tried) return { word: '试试', frame: '我可以___吗？', full: '我可以试试吗？' };
  if (rack.bargain && !r.haggle) {
    const b = rackBargain(focus);
    const offer = priceZh(b.limit);
    return { word: offer, frame: '___行吗？', full: `${offer}行吗？` };
  }
  return { word: '要', frame: `我___这${focus.measure}。`, full: `我要这${focus.measure}。` };
}

/** Readings the word list gets wrong here (发 is fà in hair, 着 is zhe when wearing): cut and read as whole words. */
export const RACK_WORDS: Record<string, string> = {
  短发: 'duǎnfà', 长发: 'chángfà', 卷发: 'juǎnfà', 短发齐耳: 'duǎnfàqí\'ěr', 寸头: 'cùntóu', 分头: 'fēntóu', 马尾: 'mǎwěi', 丸子头: 'wánzitóu',
  刘海: 'liúhǎi', 光头: 'guāngtóu', 穿着走: 'chuānzhezǒu', 试衣间: 'shìyījiān',
};

export const rackOf = (clothes: Pick<ClothesContent, 'racks'>, id: string) => clothes.racks.find((r) => r.id === id);
export { HAIR_STYLE_WORDS, HAIR_COLOUR_WORDS };

/** Every rack's scene (the page, the solver and the tests add them to the districts' scenes). */
export const rackScenes = (clothes: Pick<ClothesContent, 'racks' | 'clothes'>): Scene[] => clothes.racks.map((r) => rackScene(r, clothes));
