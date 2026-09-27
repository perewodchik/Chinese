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
  // counter shops
  到店点餐: { py: 'dào diàn diǎncān', en: 'order in the shop' },
  取餐号: { py: 'qǔcān hào', en: 'pickup number', note: 'called out when your food is ready' },
  请留意叫号: { py: 'qǐng liúyì jiào hào', en: 'please listen for your number', hsk: ['请', '叫'] },
  取餐号是多少: { py: 'qǔcān hào shì duōshao', en: 'what is the pickup number?', hsk: ['是', '多少'] },
  // table service
  扫码点餐: { py: 'sǎo mǎ diǎncān', en: 'scan the code to order', note: 'the QR code on the table' },
  桌号: { py: 'zhuōhào', en: 'table number' },
  就餐人数: { py: 'jiùcān rénshù', en: 'number of diners' },
  人: { py: 'rén', en: 'people', hsk: ['人'] },
  选茶: { py: 'xuǎn chá', en: 'choose the tea', hsk: ['茶'] },
  开始点餐: { py: 'kāishǐ diǎncān', en: 'start ordering', hsk: ['开始'] },
  位: { py: 'wèi', en: 'per person', note: 'a polite measure word for people', hsk: ['位'] },
  选好了: { py: 'xuǎn hǎo le', en: 'done choosing', hsk: ['好'] },
  确认下单: { py: 'quèrèn xiàdān', en: 'confirm the order' },
  下单: { py: 'xiàdān', en: 'place the order', note: 'sends it to the kitchen' },
  下单成功: { py: 'xiàdān chénggōng', en: 'order placed' },
  菜品正在准备中: { py: 'càipǐn zhèngzài zhǔnbèi zhōng', en: 'the dishes are being prepared', hsk: ['正在', '准备'] },
  已点菜品: { py: 'yǐ diǎn càipǐn', en: 'dishes ordered' },
  加菜: { py: 'jiā cài', en: 'add more dishes', note: 'goes onto the same bill', hsk: ['菜'] },
  呼叫服务员: { py: 'hūjiào fúwùyuán', en: 'call a waiter', hsk: ['服务员'] },
  已通知服务员: { py: 'yǐ tōngzhī fúwùyuán', en: 'the waiter has been told', hsk: ['服务员'] },
  催单: { py: 'cuī dān', en: 'hurry the order', note: 'asks the kitchen to speed up' },
  已催单: { py: 'yǐ cuī dān', en: 'the kitchen has been reminded' },
  去买单: { py: 'qù mǎidān', en: 'go and pay the bill', note: '买单 = pay the bill', hsk: ['去', '买'] },
  买单: { py: 'mǎidān', en: 'the bill', hsk: ['买'] },
  菜品: { py: 'càipǐn', en: 'dishes', hsk: ['菜'] },
  买单成功: { py: 'mǎidān chénggōng', en: 'bill paid' },
  欢迎再次光临: { py: 'huānyíng zàicì guānglín', en: 'welcome back any time', hsk: ['欢迎'] },
  桌号是多少: { py: 'zhuōhào shì duōshao', en: 'what is the table number?', hsk: ['是', '多少'] },
  茶位费一共多少: { py: 'cháwèi fèi yígòng duōshao', en: 'how much is the tea charge in all?', hsk: ['茶', '一共', '多少'] },
  // delivery
  收货地址: { py: 'shōuhuò dìzhǐ', en: 'delivery address' },
  选择收货地址: { py: 'xuǎnzé shōuhuò dìzhǐ', en: 'choose the delivery address' },
  预计送达: { py: 'yùjì sòngdá', en: 'expected delivery (at)', hsk: ['送'] },
  起送: { py: 'qǐ sòng', en: 'minimum order for delivery' },
  差: { py: 'chà', en: 'short by', hsk: ['差'] },
  满减: { py: 'mǎn jiǎn', en: 'spend-and-save discount' },
  餐具数量: { py: 'cānjù shùliàng', en: 'how many sets of cutlery' },
  无需餐具: { py: 'wúxū cānjù', en: 'no cutlery needed' },
  份: { py: 'fèn', en: '(measure word: a portion, a set)', hsk: ['份'] },
  骑手正在赶来: { py: 'qíshǒu zhèngzài gǎn lái', en: 'the rider is on the way', hsk: ['正在', '来'] },
  商家已接单: { py: 'shāngjiā yǐ jiē dān', en: 'the shop has accepted the order' },
  几点送到: { py: 'jǐ diǎn sòng dào', en: 'what time will it arrive?', hsk: ['几', '点', '送', '到'] },
  // the friend, more
  我们是: { py: 'wǒmen shì', en: 'we are', hsk: ['我们', '是'] },
  个人: { py: 'ge rén', en: 'people', hsk: ['个', '人'] },
  我们要喝: { py: 'wǒmen yào hē', en: 'we want to drink', hsk: ['我们', '要', '喝'] },
  我要外送: { py: 'wǒ yào wàisòng', en: 'I want it delivered', hsk: ['我', '要'] },
  送到: { py: 'sòng dào', en: 'deliver to', hsk: ['送', '到'] },
  不要餐具: { py: 'bú yào cānjù', en: 'no cutlery', hsk: ['不', '要'] },
  份餐具: { py: 'fèn cānjù', en: 'sets of cutlery', hsk: ['份'] },
  用: { py: 'yòng', en: 'use', hsk: ['用'] },
  那张券: { py: 'nà zhāng quàn', en: 'that coupon', hsk: ['那', '张'] },
  用一下优惠券嘛: { py: 'yòng yíxià yōuhuìquàn ma', en: 'use a coupon, go on', hsk: ['用', '一下'] },
  太贵了: { py: 'tài guì le', en: 'too expensive', hsk: ['太', '贵'] },
  我只有: { py: 'wǒ zhǐ yǒu', en: 'I only have', hsk: ['我', '有'] },
  块: { py: 'kuài', en: 'yuan (spoken)', hsk: ['块'] },
  // measure words the menus sell by
  杯: { py: 'bēi', en: 'cup (measure word)', hsk: ['杯'] },
  碗: { py: 'wǎn', en: 'bowl (measure word)', hsk: ['碗'] },
  笼: { py: 'lóng', en: 'steamer basket (measure word)', note: 'dim sum comes by the basket' },
  只: { py: 'zhī', en: '(measure word for birds, animals)', hsk: ['只'] },
  两: { py: 'liǎng', en: 'liang (50 g)', note: 'a weight: dumplings are sold by the 两; 一两 is about 6', hsk: ['两'] },
  盘: { py: 'pán', en: 'plate (measure word)' },
  瓶: { py: 'píng', en: 'bottle (measure word)' },
  个: { py: 'gè', en: '(the general measure word)', hsk: ['个'] },
  // how friends order at a table
  我们: { py: 'wǒmen', en: 'we', hsk: ['我们'] },
  一个人: { py: 'yí ge rén', en: 'one person', hsk: ['一', '个', '人'] },
  一碗: { py: 'yì wǎn', en: 'one bowl of', hsk: ['一', '碗'] },
  一瓶: { py: 'yì píng', en: 'one bottle of', hsk: ['一'] },
  一份: { py: 'yí fèn', en: 'one portion of', hsk: ['一', '份'] },
  两个人: { py: 'liǎng ge rén', en: 'two people', hsk: ['两', '个', '人'] },
  两碗: { py: 'liǎng wǎn', en: 'two bowls of', hsk: ['两', '碗'] },
  两瓶: { py: 'liǎng píng', en: 'two bottles of', hsk: ['两'] },
  两份: { py: 'liǎng fèn', en: 'two portions of', hsk: ['两', '份'] },
  三个人: { py: 'sān ge rén', en: 'three people', hsk: ['三', '个', '人'] },
  三碗: { py: 'sān wǎn', en: 'three bowls of', hsk: ['三', '碗'] },
  三瓶: { py: 'sān píng', en: 'three bottles of', hsk: ['三'] },
  三份: { py: 'sān fèn', en: 'three portions of', hsk: ['三', '份'] },
  四个人: { py: 'sì ge rén', en: 'four people', hsk: ['四', '个', '人'] },
  四碗: { py: 'sì wǎn', en: 'four bowls of', hsk: ['四', '碗'] },
  四瓶: { py: 'sì píng', en: 'four bottles of', hsk: ['四'] },
  四份: { py: 'sì fèn', en: 'four portions of', hsk: ['四', '份'] },
  五个人: { py: 'wǔ ge rén', en: 'five people', hsk: ['五', '个', '人'] },
  五碗: { py: 'wǔ wǎn', en: 'five bowls of', hsk: ['五', '碗'] },
  五瓶: { py: 'wǔ píng', en: 'five bottles of', hsk: ['五'] },
  五份: { py: 'wǔ fèn', en: 'five portions of', hsk: ['五', '份'] },
  六个人: { py: 'liù ge rén', en: 'six people', hsk: ['六', '个', '人'] },
  六碗: { py: 'liù wǎn', en: 'six bowls of', hsk: ['六', '碗'] },
  六瓶: { py: 'liù píng', en: 'six bottles of', hsk: ['六'] },
  六份: { py: 'liù fèn', en: 'six portions of', hsk: ['六', '份'] },
  点: { py: 'diǎn', en: 'order (a dish)', hsk: ['点'] },
  先点: { py: 'xiān diǎn', en: 'order first', hsk: ['先', '点'] },
  再加: { py: 'zài jiā', en: 'add more', hsk: ['再'] },
  吧: { py: 'ba', en: '(makes it a suggestion)', hsk: ['吧'] },
  只有: { py: 'zhǐ yǒu', en: 'only have', hsk: ['有'] },
  和: { py: 'hé', en: 'and', hsk: ['和'] },
  一个: { py: 'yí ge', en: 'one', hsk: ['一', '个'] },
  两个: { py: 'liǎng ge', en: 'two', note: '两, not 二, before a measure word', hsk: ['两', '个'] },
  要: { py: 'yào', en: 'want', hsk: ['要'] },
  的: { py: 'de', en: '(links a description to a noun)', hsk: ['的'] },
  不够: { py: 'bú gòu', en: 'not enough', hsk: ['不'] },
  还要: { py: 'hái yào', en: 'also want', hsk: ['还', '要'] },
  // fees and marks every shop may show
  餐具: { py: 'cānjù', en: 'cutlery (and the charge for it)' },
  茶位费: { py: 'cháwèi fèi', en: 'tea charge', note: 'per person, for the tea and the seat', hsk: ['茶'] },
  调料: { py: 'tiáoliào', en: 'sauces', note: 'the sauce bar, charged per person' },
  配送费: { py: 'pèisòng fèi', en: 'delivery fee' },
  打包费: { py: 'dǎbāo fèi', en: 'packing fee' },
  微辣: { py: 'wēi là', en: 'mildly spicy' },
  中辣: { py: 'zhōng là', en: 'medium spicy' },
  特辣: { py: 'tè là', en: 'very spicy' },
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
