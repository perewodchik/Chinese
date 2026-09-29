/**
 * The conversations as written: a small graph per scene (prompt §4).
 *
 * At each node the player's line is tried, in order, as
 *   1. a request — 再说一遍, 慢一点, X是什么意思, 听不懂;
 *   2. one of the node's `expect` intents;
 *   3. a polite word — 你好, 谢谢, 再见, 对不起;
 *   4. not Chinese at all → 「听不懂……」 and the companion offers the Chinese;
 *   5. otherwise a miss: 「你说什么？」, and from the second miss in a row the
 *      companion offers the node's hint, one step further each time, the
 *      third step always a whole sentence that works. Never a dead end.
 */

import type { SaveAction } from '../save';
import type { Action, DialogueNode, Hint, Item, NpcCard, Scene, WorldSave } from '../types';
import type { Lexicon } from './lexicon';
import { heardNote, matchIntent, normalize } from './match';
import type { CompanionCue, DialogueSource, DialogueState, Line, Turn, Utterance } from './source';
import { askIntent, explainWord, POLITE_REPLY, politeIntent } from './universal';
import { hintWithName, NAME_SLOT, withName } from '../voice';
import { catNameFrom } from '../room';
import { STICKER_REPLY, STICKERS } from '../photo';
import { cartTotal, cartZh, DONE_WORDS, mischargeDay, parseOrder, PAY_LINES, priceEn, priceZh, SELL_LINES, SHOP_LINES, yuanZh, type Named, type Shop } from '../shop';
import { dayOf } from '../clock';
import { holds } from '../flags';

export const DEFAULT_MISSES = ['你说什么？', '什么？请再说一遍。'];
export const NOT_CHINESE = { zh: '对不起，我听不懂……', en: "Sorry, I don't understand…" };
export const WRONG_CHOICE = [
  { zh: '不是这个，再看看！', en: 'Not that one — look again!' },
  { zh: '不对，不对。你再听听。', en: 'No, no. Listen again.' },
];
export const DONT_KNOW = { zh: '这个……我不知道怎么说。', en: "Hmm… I don't know how to say it." };

export interface ScriptContent {
  scenes: readonly Scene[];
  npcs: readonly NpcCard[];
  /** sellers and the things they sell, for order lines (Y1) */
  shops?: readonly Shop[];
  items?: readonly Item[];
}

/**
 * The name in 「我叫大卫。」 / 「我是小白」 / 「我的名字是 Anna」 (X2), or null. Only
 * the first word-like run after the marker, at most twelve characters.
 */
export function nameFrom(text: string): string | null {
  const m = /(?:我的名字是|我的名字叫|名字是|名字叫|我叫|叫我|我是)\s*([^\s，。！？、,.!?~～]+)/.exec(text.trim());
  if (!m) return null;
  const name = m[1]!.replace(/(吧|啊|呀|哦|呢)$/, '').slice(0, 12);
  return name || null;
}

/** What a patient player does at a line (tests and the solver): the right pick, the writing, or the hint's whole sentence. */
export function answerFor(n: DialogueNode, name = ''): Utterance | null {
  if (n.choose) return { text: '', via: 'keyboard', choice: n.choose.options.find((o) => o.right)?.id ?? '' };
  if (n.trace) return { text: '', via: 'keyboard', traced: true };
  if (n.expect?.length) return n.hint ? { text: hintWithName(n.hint, name).full, via: 'keyboard' } : null;
  return null;
}

/** 「“附近”就是不远的地方。」 from the word and its HSK 1 explanation. */
export function explanationLine(word: string, explain: string): string {
  const body = /^(就是|是|意思是)/.test(explain) ? explain : `就是${explain}`;
  return /[。！？.!?]$/.test(body) ? `“${word}”${body}` : `“${word}”${body}。`;
}

export class ScriptedDialogue implements DialogueSource {
  private scenes = new Map<string, Scene>();
  private npcs = new Map<string, NpcCard>();

  private shops = new Map<string, Shop>();
  private items = new Map<string, Item>();

  constructor(content: ScriptContent, private lex: Lexicon) {
    for (const s of content.scenes) this.scenes.set(s.id, s);
    for (const n of content.npcs) this.npcs.set(n.id, n);
    for (const s of content.shops ?? []) this.shops.set(s.id, s);
    for (const i of content.items ?? []) this.items.set(i.id, i);
  }

  /** A shop's things with names, and whether each is on sale today (as the talk began). */
  private stock(shopId: string, state: DialogueState): (Named & { now: boolean })[] {
    const shop = this.shops.get(shopId);
    if (!shop) return [];
    return shop.stock.map((x) => {
      const it = this.items.get(x.item);
      return { ...x, name: it?.name ?? x.item, en: it?.en ?? x.item, measure: x.measure ?? '个', now: state.onSale ? state.onSale.includes(x.item) : true };
    });
  }

  /** What 💡 offers at a line: its own hint, or at a shop the first thing on sale (and 不要了 once something is ordered). */
  hintAt(state: DialogueState): Hint | undefined {
    const scene = this.scenes.get(state.scene);
    const n = scene?.nodes.find((x) => x.id === state.node);
    if (!n) return undefined;
    if (n.sell) {
      if (state.offer) return { word: '好', frame: '___，卖给你。', full: '好，卖给你。' };
      const first = state.sellable?.[0];
      return first ? { word: first.name, frame: '我有___。', full: `我有${first.name}。` } : { word: '没有', frame: '___了。', full: '没有了。' };
    }
    if (!n.order) return n.hint ? hintWithName(n.hint, state.name ?? '') : undefined;
    if (state.cart?.length) return { word: '不要了', frame: '___，谢谢。', full: '不要了，谢谢。' };
    const first = this.stock(n.order.shop, state).find((x) => x.now);
    return first ? { word: first.name, frame: `我要一${first.measure}___。`, full: `我要一${first.measure}${first.name}。` } : undefined;
  }

  /** What a patient player says here (tests and the solver): the right pick, the writing, the hint's whole sentence. */
  answer(state: DialogueState): Utterance | null {
    const n = this.scenes.get(state.scene)?.nodes.find((x) => x.id === state.node);
    if (!n) return null;
    if (n.sell) return { text: state.offer ? '好' : '没有了', via: 'keyboard' };
    if (n.order) {
      // paying: type what was said (and catch a wrong charge first)
      if (state.due) {
        if (state.due.mode === 'code' && state.due.charged !== state.due.total) return { text: '不对', via: 'keyboard' };
        return { text: '', via: 'keyboard', paid: state.due.mode === 'scan' ? state.due.total : state.due.charged };
      }
      const h = this.hintAt(state);
      return h ? { text: h.full, via: 'keyboard' } : null;
    }
    return answerFor(n, state.name ?? '');
  }

  /** An order line at a shop (Y1): things named with numbers go into the order, 多少钱 is answered, 不要了 pays. */
  private orderReply(scene: Scene, n: DialogueNode, state: DialogueState, u: Utterance): Turn | null {
    const order = n.order!;
    const stock = this.stock(order.shop, state);
    const text = u.text.trim();
    const cart = state.cart ?? [];
    const say = (zh: string, en: string, extra: Partial<Turn> = {}): Turn => ({ kind: 'match', intent: 'order', say: this.aside(scene, zh, en), actions: [], state, ...extra });
    const asked = parseOrder(text, stock);
    const price = /多少钱|几块|什么价|多少/.test(text);
    if (price) {
      const one = asked[0] && stock.find((x) => x.item === asked[0]!.item);
      if (one) return say(`${one.name}${priceZh(one.price)}一${one.measure}。`, `${one.en}: ${priceEn(one.price)} each.`);
      if (cart.length) return say(`一共${priceZh(cartTotal(cart, stock))}。`, `That comes to ${priceEn(cartTotal(cart, stock))}.`);
    }
    const now = asked.filter((c) => stock.find((x) => x.item === c.item)?.now);
    const later = asked.find((c) => !stock.find((x) => x.item === c.item)?.now);
    if (now.length) {
      const next = [...cart];
      for (const c of now) {
        const cur = next.find((x) => x.item === c.item);
        if (cur) cur.n += c.n;
        else next.push({ ...c });
      }
      const total = cartTotal(next, stock);
      return say(`${cartZh(next, stock)}，一共${priceZh(total)}。${SHOP_LINES.more.zh}`, `${next.map((c) => `${c.n} × ${stock.find((x) => x.item === c.item)!.en}`).join(', ')} — ${priceEn(total)} in all. ${SHOP_LINES.more.en}`, {
        state: { ...state, cart: next, misses: 0, hint: 0 },
      });
    }
    if (later) {
      const s = stock.find((x) => x.item === later.item)!;
      return say(`现在没有${s.name}。`, `No ${s.en} at the moment.`);
    }
    const done = DONE_WORDS.some((w) => text.includes(w)) || (cart.length > 0 && /谢谢|好的|行|对/.test(text));
    if (!done) return null;
    if (!cart.length) {
      if (order.go) return say(SHOP_LINES.hello.zh, SHOP_LINES.hello.en);
      return { kind: 'polite', intent: 'bye', say: this.aside(scene, SHOP_LINES.bye.zh, SHOP_LINES.bye.en), actions: this.finish(scene), end: true, state: { ...state, ended: true } };
    }
    const total = cartTotal(cart, stock);
    if ((state.wallet ?? Infinity) < total) {
      return say(`一共${priceZh(total)}……${SHOP_LINES.short.zh}`, `${priceEn(total)}… ${SHOP_LINES.short.en}`, {
        state: { ...state, cart: [] },
        companion: { kind: 'heard', text: `That is ${priceEn(total)} and you have ${priceEn(state.wallet ?? 0)} — order a little less, or come back with more money.` },
      });
    }
    // Paying (Y2): the seller says the total; you scan the stall's code and type it, or the cashier scans yours.
    const shop = this.shops.get(order.shop)!;
    const mode = shop.pay ?? 'scan';
    // now and then a cashier rings up one thing too many (a reading drill, never a trap)
    const extra = mode === 'code' && state.mischarge ? (stock.find((x) => x.item === cart[0]!.item)?.price ?? 0) : 0;
    const due = { total, charged: total + extra, mode, name: shop.name, cart };
    const l = mode === 'scan' ? PAY_LINES.scan(priceZh(total)) : PAY_LINES.code(priceZh(total));
    return say(l.zh, `${priceEn(total)} in all.${l.en ? ` ${l.en}` : ''}`, { intent: 'due', state: { ...state, cart: [], due, misses: 0, hint: 0 } });
  }

  /** Selling to the recycler (Y3): name a thing from your bag, hear his offer, 好 — the money arrives on your phone. */
  private sellReply(scene: Scene, state: DialogueState, u: Utterance): Turn | null {
    const text = u.text.trim();
    const aside = (zh: string, en: string) => this.aside(scene, zh, en);
    const list = state.sellable ?? [];
    const named = parseOrder(text, list)[0];
    if (named) {
      const o = list.find((x) => x.item === named.item)!;
      return { kind: 'match', intent: 'offer', say: aside(`${o.name}？${priceZh(o.price)}。`, `The ${this.items.get(o.item)?.en ?? o.item}? ${priceEn(o.price)}.`), actions: [], state: { ...state, offer: o } };
    }
    if (state.offer && /好|行|可以|卖|对|要/.test(text) && !/不/.test(text)) {
      const o = state.offer;
      const box = PAY_LINES.box(yuanZh(o.price));
      const left = list.filter((x) => x.item !== o.item);
      return {
        kind: 'match',
        intent: 'sell',
        chime: { speaker: 'speaker-box', zh: box.zh, en: box.en, node: '' },
        say: aside(SELL_LINES.more.zh, SELL_LINES.more.en),
        actions: [{ do: 'take', item: o.item }, { do: 'money', amount: o.price }],
        state: { ...state, offer: undefined, sellable: left },
      };
    }
    if (DONE_WORDS.some((w) => text.includes(w)) || /不卖|没有/.test(text)) {
      return { kind: 'polite', intent: 'bye', say: aside(SHOP_LINES.bye.zh, SHOP_LINES.bye.en), actions: this.finish(scene), end: true, state: { ...state, ended: true } };
    }
    return null;
  }

  /** The phone (Y2): the amount typed at a stall, the charge accepted at a cashier's, or 不对. */
  private payReply(scene: Scene, n: DialogueNode, state: DialogueState, u: Utterance): Turn | null {
    const due = state.due!;
    const text = u.text.trim();
    const aside = (zh: string, en: string) => this.aside(scene, zh, en);
    if (u.paid === undefined) {
      if (due.mode === 'code' && /不对|错|只买了|不是/.test(text)) {
        if (due.charged !== due.total) {
          const l = PAY_LINES.sorry(priceZh(due.total));
          const fixed: SaveAction[] = [
            ...(scene.npc ? [{ do: 'hearts' as const, npc: scene.npc, delta: 1 }] : []),
            { do: 'flag', flag: `mischarged-${state.mischarge ?? 0}` },
          ];
          const { mischarge: _m, ...rest } = state;
          return { kind: 'match', intent: 'dispute', say: aside(l.zh, l.en), actions: fixed, state: { ...rest, due: { ...due, charged: due.total } } };
        }
        const l = PAY_LINES.right(priceZh(due.total));
        return { kind: 'match', intent: 'dispute', say: aside(l.zh, l.en), actions: [], state };
      }
      return null;
    }
    if (due.mode === 'scan' && u.paid !== due.total) {
      const misses = state.misses + 1;
      const l = u.paid > due.total ? PAY_LINES.more : PAY_LINES.less(priceZh(due.total));
      // from the second wrong amount the phone fills it in (help is free)
      return { kind: 'wrong', say: aside(l.zh, l.en), actions: [], state: { ...state, misses, hint: misses >= 2 ? 3 : state.hint } };
    }
    const paid = due.mode === 'scan' ? due.total : due.charged;
    const buy: SaveAction[] = [
      { do: 'money', amount: -paid },
      ...due.cart.map((c) => ({ do: 'give' as const, item: c.item, count: c.n })),
      ...(paid !== due.total ? [{ do: 'flag' as const, flag: `mischarged-${state.mischarge ?? 0}` }] : []),
    ];
    const box = PAY_LINES.box(yuanZh(paid));
    const chime: Line = { speaker: due.mode === 'scan' ? 'speaker-box' : scene.npc ?? 'companion', zh: box.zh, en: box.en, node: '' };
    const after = { ...state, due: undefined, wallet: (state.wallet ?? 0) - paid, misses: 0, hint: 0 };
    const missed =
      paid !== due.total ? { companion: { kind: 'heard' as const, text: `The cashier charged ${priceEn(paid)}, but it should have been ${priceEn(due.total)}. Next time say 「不对」 before you pay.` } } : {};
    if (n.order?.go) return { kind: 'match', intent: 'pay', chime, ...missed, ...this.move(scene, n, n.order.go, false, buy, after) };
    return {
      kind: 'match',
      intent: 'pay',
      chime,
      say: aside(SHOP_LINES.thanks.zh, SHOP_LINES.thanks.en),
      actions: [...buy, ...this.finish(scene)],
      end: true,
      ...missed,
      state: { ...after, ended: true },
    };
  }

  private scene(id: string): Scene {
    const s = this.scenes.get(id);
    if (!s) throw new Error(`unknown scene ${id}`);
    return s;
  }

  private node(scene: Scene, id: string): DialogueNode {
    const n = scene.nodes.find((x) => x.id === id);
    if (!n) throw new Error(`scene ${scene.id} has no node ${id}`);
    return n;
  }

  private line(scene: Scene, n: DialogueNode, variant: 'say' | 'simpler' = 'say', slow = false, name = ''): Line {
    const simpler = variant === 'simpler' && n.simpler;
    const tpl = simpler ? n.simpler! : n.say;
    return {
      speaker: n.speaker ?? scene.npc ?? 'companion',
      zh: withName(tpl, name),
      ...(tpl.includes(NAME_SLOT) ? { tpl } : {}),
      // A manual reading belongs to `say`; the simpler line gets the build's.
      ...(n.pinyin && !simpler ? { pinyin: n.pinyin } : {}),
      en: withName(n.translate, name),
      ...(n.key ? { key: true } : {}),
      ...(n.listen && !simpler ? { listen: true } : {}),
      node: n.id,
      ...(slow ? { slow: true } : {}),
    };
  }

  /** A line of the NPC's own that is not in the graph. */
  private aside(scene: Scene, zh: string, en: string): Line {
    return { speaker: scene.npc ?? 'companion', zh, en, node: '' };
  }

  /** Arriving at a node: its onEnter, and a key line pins itself to 📜. */
  private enter(scene: Scene, n: DialogueNode): Action[] {
    return [...(n.onEnter ?? []), ...(n.key ? [{ do: 'pin' as const, riddle: `${scene.id}/${n.id}` }] : [])];
  }

  /** The talk is over by the script: the scene is done, its stamp given, and a talk with someone warms the friendship (once a day). */
  private finish(scene: Scene): SaveAction[] {
    return [
      { do: 'scene_done', scene: scene.id },
      ...(scene.stamp ? [{ do: 'stamp' as const, stamp: scene.stamp }] : []),
      ...(scene.npc && !scene.id.startsWith('line-') ? [{ do: 'talked' as const, npc: scene.npc }] : []),
    ];
  }

  start(scene: Scene, save?: WorldSave): Turn {
    this.scenes.set(scene.id, scene);
    const n = this.node(scene, scene.start);
    const meet: SaveAction[] = scene.npc ? [{ do: 'meet', npc: scene.npc }] : [];
    // a scene that buys from you: what is in your bag that he would take, at his share of its price (Y3)
    const share = scene.nodes.find((x) => x.sell)?.sell?.share;
    const sellable =
      share !== undefined && save
        ? Object.entries(save.bag.items)
            .filter(([, k]) => k > 0)
            .map(([id]) => this.items.get(id))
            .filter((it): it is Item => !!it && it.kind !== 'key' && !!it.price)
            .map((it) => ({ item: it.id, name: it.name, price: Math.max(0.5, Math.round(it.price! * share * 2) / 2) }))
        : undefined;
    // a scene with an order line keeps the money and today's stock from the start (Y1)
    const shopId = scene.nodes.find((x) => x.order)?.order?.shop;
    const shop = shopId ? this.shops.get(shopId) : undefined;
    const state: DialogueState = {
      scene: scene.id,
      node: n.id,
      misses: 0,
      hint: 0,
      ended: false,
      ...(save?.name ? { name: save.name } : {}),
      ...(sellable ? { sellable } : {}),
      ...(save && scene.npc
        ? {
            held: Object.entries(save.bag.items)
              .filter(([, k]) => k > 0)
              .map(([id]) => this.items.get(id))
              .filter((it): it is Item => !!it)
              .map((it) => ({ item: it.id, name: it.name })),
          }
        : {}),
      ...(shop && save
        ? {
            wallet: save.bag.money,
            onSale: shop.stock.filter((x) => holds(x.when, save)).map((x) => x.item),
            ...(shop.mischarge && mischargeDay(dayOf(save.clock)) && !save.flags.includes(`mischarged-${dayOf(save.clock)}`) ? { mischarge: dayOf(save.clock) } : {}),
          }
        : {}),
    };
    return { kind: 'start', say: this.line(scene, n, 'say', false, state.name), actions: [...meet, ...this.enter(scene, n)], state };
  }

  /** Leave `from` for `to` (or end), with the actions on the way. */
  private move(scene: Scene, from: DialogueNode, to: string | undefined, end: boolean, via: readonly SaveAction[], state: DialogueState): Omit<Turn, 'kind'> {
    const actions: SaveAction[] = [...via, ...(from.onExit ?? [])];
    if (!to || end) {
      const last = to ? this.node(scene, to) : null;
      if (last) actions.push(...this.enter(scene, last), ...(last.onExit ?? []));
      actions.push(...this.finish(scene));
      return { say: last ? this.line(scene, last, 'say', false, state.name) : null, actions, end: true, state: { ...state, node: to ?? state.node, misses: 0, hint: 0, ended: true } };
    }
    const next = this.node(scene, to);
    actions.push(...this.enter(scene, next));
    // A node that expects nothing and leads nowhere is the last word.
    const final = !next.expect?.length && !next.next && !next.choose && !next.trace;
    if (final) actions.push(...(next.onExit ?? []), ...this.finish(scene));
    return {
      say: this.line(scene, next, 'say', false, state.name),
      actions,
      ...(final ? { end: true } : {}),
      state: { ...state, node: next.id, misses: 0, hint: 0, ended: final },
    };
  }

  proceed(state: DialogueState): Turn {
    const scene = this.scene(state.scene);
    const n = this.node(scene, state.node);
    if (state.ended) return { kind: 'continue', say: null, actions: [], end: true, state };
    // a pick-or-write line waits for the pick, not a tap (X8)
    if (n.choose || n.trace) return { kind: 'continue', say: null, actions: [], state };
    return { kind: 'continue', ...this.move(scene, n, n.next, false, [], state) };
  }

  private hintCue(h: Hint | undefined, step: number): CompanionCue | undefined {
    if (!h || step < 1) return undefined;
    const s = Math.min(3, step) as 1 | 2 | 3;
    return { kind: 'hint', step: s, text: s === 1 ? h.word : s === 2 ? h.frame : h.full };
  }

  reply(state: DialogueState, u: Utterance): Turn {
    // A sticker means its word; if that fits nothing here, the person just smiles at it — never a miss.
    if (u.sticker) {
      const def = STICKERS.find((x) => x.id === u.sticker);
      const t = def ? this.reply(state, { text: def.says, via: 'keyboard' }) : null;
      if (t && t.kind !== 'miss' && t.kind !== 'not_chinese') return t;
      const sc = this.scene(state.scene);
      return { kind: 'polite', intent: 'sticker', say: this.aside(sc, STICKER_REPLY.zh, STICKER_REPLY.en), actions: [], state };
    }
    const scene = this.scene(state.scene);
    const n = this.node(scene, state.node);
    const npc = scene.npc ? this.npcs.get(scene.npc) : undefined;
    if (!state.ended && n.sell) {
      const t = this.sellReply(scene, state, u);
      if (t) return t;
    }
    // An order at a shop (Y1); anything it does not take goes on to the usual requests and misses below.
    if (!state.ended && n.order) {
      const t = state.due ? this.payReply(scene, n, state, u) : this.orderReply(scene, n, state, u);
      if (t) return t;
      // anything else while a payment waits: the seller says the total again
      if (state.due && !u.text.trim().match(/什么意思|再说|慢/)) {
        const l = state.due.mode === 'scan' ? PAY_LINES.scan(priceZh(state.due.total)) : PAY_LINES.code(priceZh(state.due.total));
        return { kind: 'repeat', say: this.aside(scene, l.zh, `${priceEn(state.due.total)} in all.`), actions: [], state };
      }
    }
    // Doing what the line says (X8): a pick or a written character moves on; a wrong pick is never a dead end.
    if (!state.ended && (n.choose || n.trace)) {
      if (n.trace && u.traced) return { kind: 'match', intent: 'trace', ...this.move(scene, n, n.trace.go, !n.trace.go, n.trace.actions ?? [], state) };
      if (n.choose && u.choice) {
        const o = n.choose.options.find((x) => x.id === u.choice);
        if (o?.right) return { kind: 'match', intent: o.id, ...this.move(scene, n, n.choose.go, !n.choose.go, n.choose.actions ?? [], state) };
        const misses = state.misses + 1;
        const w = WRONG_CHOICE[(misses - 1) % WRONG_CHOICE.length]!;
        // from the second wrong pick the page shows the right one (hint 3)
        return { kind: 'wrong', say: this.aside(scene, w.zh, w.en), actions: [], state: { ...state, misses, hint: misses >= 2 ? 3 : state.hint } };
      }
    }
    const input = normalize(u.text, this.lex);
    const stay = (kind: Turn['kind'], say: Line, extra: Partial<Turn> = {}): Turn => ({ kind, say, actions: [], state, ...extra });

    if (state.ended) return { kind: 'continue', say: null, actions: [], end: true, state };
    const nm = state.name;
    if (input.kind === 'empty') return stay('repeat', this.line(scene, n, 'say', false, nm));

    // Words at a pick-or-write line: questions are answered, anything else hears the line again.
    if ((n.choose || n.trace) && !n.order) {
      const known = [...Object.keys(npc?.explains ?? {}), ...(scene.words ?? []).map((w) => w.w)];
      const word = explainWord(input, this.lex, known);
      const explain = word ? (npc?.explains[word] ?? scene.words?.find((w) => w.w === word)?.explain) : undefined;
      if (word && explain) return stay('explain', this.aside(scene, explanationLine(word, explain), `An explanation of ${word}.`), { intent: 'explain' });
      const ask = askIntent(input, this.lex);
      if (ask === 'slower' || ask === 'simpler') return stay(ask, this.line(scene, n, 'simpler', ask === 'slower', nm), { intent: ask });
      return stay('repeat', this.line(scene, n, 'say', false, nm), { intent: 'repeat' });
    }

    // A node with nothing to expect: whatever is said, go on (an order or a selling line waits for its words).
    if (!n.expect?.length && !n.order && !n.sell) {
      const polite = politeIntent(input, this.lex);
      if (polite === 'bye') return { kind: 'polite', intent: 'bye', say: this.aside(scene, POLITE_REPLY.bye.zh, POLITE_REPLY.bye.en), actions: [], end: true, state: { ...state, ended: true } };
      return this.proceed(state);
    }

    // 1. Requests.
    const known = [...Object.keys(npc?.explains ?? {}), ...(scene.words ?? []).map((w) => w.w)];
    const word = explainWord(input, this.lex, known);
    if (word) {
      const own = npc?.explains[word];
      const sit = scene.words?.find((w) => w.w === word);
      const explain = own ?? sit?.explain;
      if (explain) {
        return stay('explain', this.aside(scene, explanationLine(word, explain), sit?.en ? `"${word}" means ${sit.en}.` : `An explanation of ${word}.`), { intent: 'explain' });
      }
      const g = this.lex.gloss(word);
      return stay('explain', this.aside(scene, DONT_KNOW.zh, DONT_KNOW.en), {
        intent: 'explain',
        companion: { kind: 'explain', word, ...(g ? { py: g.py, en: g.en } : {}) },
      });
    }
    const ask = askIntent(input, this.lex);
    if (ask === 'repeat') return stay('repeat', this.line(scene, n, 'say', false, nm), { intent: 'repeat' });
    if (ask === 'slower') return stay('slower', this.line(scene, n, 'simpler', true, nm), { intent: 'slower' });
    if (ask === 'simpler') return stay('simpler', this.line(scene, n, 'simpler', false, nm), { intent: 'simpler' });

    // 2. The scene's own intents.
    const m = matchIntent(n.expect ?? [], input, this.lex);
    // A homophone picked by mistake from a keyboard is kept too, with the same note.
    if (m) {
      const note = m.heard.length ? m.heard.map((h) => heardNote(h, this.lex)).join(' ') : undefined;
      // 「我叫大卫。」: the name is kept, and the lines from here on say it.
      const told = m.expect.capture === 'name' ? nameFrom(u.text) : null;
      // 「它叫小花。」: the cat's name (X5)
      const cat = m.expect.capture === 'cat' ? catNameFrom(u.text) : null;
      const via: SaveAction[] = [
        ...(told ? [{ do: 'name' as const, name: told }] : []),
        ...(cat ? [{ do: 'cat_name' as const, name: cat }] : []),
        ...(m.expect.actions ?? []),
      ];
      const moved = this.move(scene, n, m.expect.go, !!m.expect.end, via, told ? { ...state, name: told } : state);
      return {
        kind: 'match',
        intent: m.expect.intent,
        ...moved,
        ...(note ? { note, companion: { kind: 'heard' as const, text: note } } : {}),
      };
    }

    // 2½. 「给你糖葫芦」 / 「我有雨伞」 / 「这个给你」: hand over something from the bag (Y4).
    if (scene.npc && state.held?.length && /给你|给您|我有|送你|送给你/.test(u.text)) {
      const h = parseOrder(u.text, state.held)[0];
      if (h) return { kind: 'polite', intent: 'give', gift: h.item, say: null, actions: [], end: true, state: { ...state, ended: true } };
    }

    // 3. Polite words.
    const polite = politeIntent(input, this.lex);
    if (polite) {
      const r = POLITE_REPLY[polite];
      return {
        kind: 'polite',
        intent: polite,
        say: this.aside(scene, r.zh, r.en),
        actions: [],
        ...(r.end ? { end: true } : {}),
        state: r.end ? { ...state, ended: true } : state,
      };
    }

    // 4. Not Chinese.
    if (input.kind === 'other') {
      return stay('not_chinese', this.aside(scene, NOT_CHINESE.zh, NOT_CHINESE.en), {
        intent: 'not_chinese',
        ...(n.hint ? { companion: { kind: 'not_chinese' as const, text: hintWithName(n.hint, nm ?? '').full } } : {}),
      });
    }

    // 5. A miss.
    const misses = state.misses + 1;
    const hint = misses >= 2 ? Math.min(3, Math.max(state.hint, 0) + 1) : state.hint;
    const lines = npc?.misses?.length ? npc.misses : DEFAULT_MISSES;
    const zh = lines[(misses - 1) % lines.length]!;
    const cue = misses >= 2 ? this.hintCue(this.hintAt(state), hint) : undefined;
    return {
      kind: 'miss',
      say: this.aside(scene, zh, 'What did you say?'),
      actions: [],
      ...(cue ? { companion: cue } : {}),
      state: { ...state, misses, hint },
    };
  }
}
