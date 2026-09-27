import type { Brand, Gloss } from './types';

/**
 * Every Chinese string the kit itself shows — the WeChat chrome, the cart,
 * checkout and payment — with pinyin and English. A brand's glossary adds its
 * own menu to this; a test walks both and fails on any string without an
 * entry, so everything offered on the screen can be looked up.
 */
export const KIT_GLOSSARY: Record<string, Gloss> = {
  // WeChat
  微信: { py: 'Wēixìn', en: 'WeChat' },
  小程序: { py: 'xiǎochéngxù', en: 'mini-program', note: 'an app that runs inside WeChat' },
  练习模式: { py: 'liànxí móshì', en: 'practice mode' },
  // start screen
  距您: { py: 'jù nín', en: 'distance from you', hsk: ['您'] },
  到店取: { py: 'dào diàn qǔ', en: 'pick up in store' },
  下单免排队: { py: 'xiàdān miǎn páiduì', en: 'order ahead, skip the queue' },
  送到你身边: { py: 'sòng dào nǐ shēnbiān', en: 'brought to where you are', hsk: ['送', '到', '你', '身边'] },
  会员: { py: 'huìyuán', en: 'member' },
  新品推荐: { py: 'xīnpǐn tuījiàn', en: 'new drinks we recommend' },
  仅冰饮: { py: 'jǐn bīng yǐn', en: 'iced only' },
  // tab bar
  首页: { py: 'shǒuyè', en: 'home' },
  菜单: { py: 'càidān', en: 'menu' },
  点单: { py: 'diǎndān', en: 'order', note: 'the ordering tab; 点 = to choose from a list' },
  购物车: { py: 'gòuwùchē', en: 'cart', note: 'literally "shopping cart"' },
  订单: { py: 'dìngdān', en: 'orders' },
  我的: { py: 'wǒ de', en: 'me', note: 'the account tab' },
  暂无订单: { py: 'zàn wú dìngdān', en: 'no orders yet' },
  // menu
  选规格: { py: 'xuǎn guīgé', en: 'choose options', note: 'opens the sheet of options (size, sugar, …)' },
  规格: { py: 'guīgé', en: 'options, specification' },
  预估到手: { py: 'yùgū dàoshǒu', en: 'estimated price', note: 'what you pay after the best coupon' },
  月售: { py: 'yuè shòu', en: 'sold this month' },
  未选购商品: { py: 'wèi xuǎngòu shāngpǐn', en: 'nothing chosen yet', note: 'the empty cart bar' },
  去结算: { py: 'qù jiésuàn', en: 'check out', note: 'literally "go and settle the bill"' },
  已加入购物车: { py: 'yǐ jiārù gòuwùchē', en: 'added to cart' },
  请选择: { py: 'qǐng xuǎnzé', en: 'please choose' },
  加入购物车: { py: 'jiārù gòuwùchē', en: 'add to cart' },
  立即购买: { py: 'lìjí gòumǎi', en: 'buy now', note: 'skips the cart and goes straight to checkout' },
  清空购物车: { py: 'qīngkōng gòuwùchē', en: 'empty the cart' },
  已选商品: { py: 'yǐ xuǎn shāngpǐn', en: 'chosen items' },
  // checkout
  确认订单: { py: 'quèrèn dìngdān', en: 'confirm order' },
  自提: { py: 'zìtí', en: 'pickup', note: 'you collect it yourself' },
  外送: { py: 'wàisòng', en: 'delivery' },
  外送即将开放: { py: 'wàisòng jíjiāng kāifàng', en: 'delivery is coming soon', note: 'not in this practice version yet' },
  取餐门店: { py: 'qǔcān méndiàn', en: 'pickup store' },
  预计: { py: 'yùjì', en: 'expected (at)' },
  可取: { py: 'kě qǔ', en: 'ready to collect' },
  取餐方式: { py: 'qǔcān fāngshì', en: 'how you take it', note: 'eat in or take away' },
  堂食: { py: 'tángshí', en: 'eat in', note: 'drink it in the shop' },
  外带: { py: 'wàidài', en: 'take away', note: 'the same as 打包 or 带走' },
  优惠券: { py: 'yōuhuìquàn', en: 'coupon' },
  张: { py: 'zhāng', en: '(measure word for coupons, tickets, paper)', hsk: ['张'] },
  已选: { py: 'yǐ xuǎn', en: 'chosen' },
  可用: { py: 'kěyòng', en: 'can be used' },
  不可用: { py: 'bù kěyòng', en: 'cannot be used' },
  不使用优惠券: { py: 'bù shǐyòng yōuhuìquàn', en: "don't use a coupon" },
  选择优惠券: { py: 'xuǎnzé yōuhuìquàn', en: 'choose a coupon' },
  备注: { py: 'bèizhù', en: 'note', note: 'wishes for the barista: less ice, no ice…' },
  口味偏好: { py: 'kǒuwèi piānhào', en: 'taste preferences' },
  其他要求: { py: 'qítā yāoqiú', en: 'other requests' },
  无: { py: 'wú', en: 'none' },
  确定: { py: 'quèdìng', en: 'OK' },
  支付方式: { py: 'zhīfù fāngshì', en: 'payment method' },
  微信支付: { py: 'Wēixìn zhīfù', en: 'WeChat Pay' },
  商品金额: { py: 'shāngpǐn jīn’é', en: 'items total' },
  合计: { py: 'héjì', en: 'total' },
  已优惠: { py: 'yǐ yōuhuì', en: 'saved' },
  去支付: { py: 'qù zhīfù', en: 'pay', note: 'literally "go and pay"' },
  共: { py: 'gòng', en: 'in all' },
  件: { py: 'jiàn', en: '(measure word for items)', hsk: ['件'] },
  // pay
  零钱: { py: 'língqián', en: 'wallet balance', note: 'money kept in WeChat itself' },
  输入支付密码: { py: 'shūrù zhīfù mìmǎ', en: 'enter your payment PIN' },
  支付成功: { py: 'zhīfù chénggōng', en: 'payment successful' },
  完成: { py: 'wánchéng', en: 'done' },
  // pickup
  取餐码: { py: 'qǔcān mǎ', en: 'pickup code', note: 'the number the barista calls out' },
  已下单: { py: 'yǐ xiàdān', en: 'ordered' },
  制作中: { py: 'zhìzuò zhōng', en: 'being made' },
  请取餐: { py: 'qǐng qǔcān', en: 'please collect' },
  分钟后可取: { py: 'fēnzhōng hòu kě qǔ', en: 'minutes until it is ready' },
  订单详情: { py: 'dìngdān xiángqíng', en: 'order details' },
  下单时间: { py: 'xiàdān shíjiān', en: 'time ordered' },
  实付: { py: 'shífù', en: 'paid' },
  // the friend
  不对哦: { py: 'bú duì o', en: "that's not right", hsk: ['不', '对'] },
  好的: { py: 'hǎo de', en: 'OK', hsk: ['好'] },
  我要的是: { py: 'wǒ yào de shì', en: 'what I wanted is', hsk: ['我', '要', '的', '是'] },
  我要: { py: 'wǒ yào', en: 'I want', hsk: ['我', '要'] },
  我只要: { py: 'wǒ zhǐ yào', en: 'I only want', hsk: ['我', '要'] },
  我没要: { py: 'wǒ méi yào', en: "I didn't ask for", hsk: ['我', '没', '要'] },
  哦: { py: 'o', en: '(softens the sentence)' },
  备注里要写: { py: 'bèizhù lǐ yào xiě', en: 'the note should say', hsk: ['里', '要', '写'] },
  // the reading check
  取餐码是多少: { py: 'qǔcān mǎ shì duōshao', en: 'what is the pickup code?', hsk: ['是', '多少'] },
  一共多少钱: { py: 'yígòng duōshao qián', en: 'how much was it in all?', hsk: ['一共', '多少', '钱'] },
  几点可以取: { py: 'jǐ diǎn kěyǐ qǔ', en: 'what time can it be collected?', hsk: ['几', '点', '可以'] },
  优惠了多少: { py: 'yōuhuì le duōshao', en: 'how much was saved?', hsk: ['多少'] },
  点一下: { py: 'diǎn yíxià', en: 'tap it', note: 'tap the answer on the screen' },
  对: { py: 'duì', en: 'right', hsk: ['对'] },
  再看看: { py: 'zài kànkan', en: 'look again', hsk: ['再', '看'] },
};

const PUNCT = /[\s，。；：～！？、,.;:!?~·/（）()\-—+¥￥0-9A-Za-z%]/;

/** The brand's words and the kit's, together. */
export const glossaryOf = (brand: Brand): Record<string, Gloss> => ({ ...KIT_GLOSSARY, ...brand.glossary });

/**
 * Split a Chinese sentence into glossary entries, longest first. Punctuation,
 * digits and Latin letters are passed through as they are. `null` marks a
 * character with no entry — a test makes sure no shown text has one.
 */
export function segment(text: string, gl: Record<string, Gloss>): { t: string; g: Gloss | null }[] {
  const out: { t: string; g: Gloss | null }[] = [];
  let max = 1;
  for (const k of Object.keys(gl)) max = Math.max(max, k.length);
  let i = 0;
  while (i < text.length) {
    let hit = 0;
    for (let n = Math.min(max, text.length - i); n > 0; n--) {
      if (gl[text.slice(i, i + n)]) {
        hit = n;
        break;
      }
    }
    if (hit) {
      const t = text.slice(i, i + hit);
      out.push({ t, g: gl[t] });
      i += hit;
      continue;
    }
    const last = out[out.length - 1];
    if (PUNCT.test(text[i]) && last && !last.g && isPunct(last.t)) last.t += text[i];
    else out.push({ t: text[i], g: null });
    i++;
  }
  return out;
}

export const isPunct = (t: string) => [...t].every((c) => PUNCT.test(c));

/** Characters in `text` no glossary entry covers. */
export const uncovered = (text: string, gl: Record<string, Gloss>) =>
  segment(text, gl)
    .filter((s) => !s.g && !isPunct(s.t))
    .map((s) => s.t);

/** A text's gloss: its own entry, or one built from its pieces. */
export function glossFor(text: string, gl: Record<string, Gloss>): Gloss & { parts: { t: string; g: Gloss }[] } {
  const own = gl[text];
  if (own) return { ...own, parts: [] };
  const segs = segment(text, gl);
  const parts = segs.filter((s): s is { t: string; g: Gloss } => !!s.g);
  return {
    py: segs.map((s) => (s.g ? s.g.py : s.t)).join(' ').replace(/\s+([，。；：～！？、,.])/g, '$1'),
    en: parts.map((p) => p.g.en).join(' · '),
    parts,
  };
}

/** The HSK words a text is made of, by the glossary's reckoning. */
export function hskWords(text: string, gl: Record<string, Gloss>, has: (w: string) => boolean): string[] {
  const out = new Set<string>();
  for (const s of segment(text, gl)) {
    if (!s.g) continue;
    if (s.g.hsk) s.g.hsk.forEach((w) => has(w) && out.add(w));
    else if (has(s.t)) out.add(s.t);
  }
  return [...out];
}
