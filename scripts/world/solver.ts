/**
 * The quest solver (prompt X0): from a fresh save it plays the whole game
 * through the core only — no engine, no page — the way a patient player
 * would: at every moment it looks at what can happen on every map (people
 * to talk to, things to look at, scenes that start on arrival), plays the
 * first that moves the game on, answering every line with the node's third
 * hint (the whole sentence 兔儿爷 offers), and when nothing moves it lets
 * the clock run to the next part of the day.
 *
 * It asserts: every quest can be finished; every spirit and 成语 can be
 * found; money never has to go below zero; every person's routine spot is
 * a tile they can stand on. It also leaves snapshots at the start of each
 * chapter — the golden saves.
 */

import { readFileSync } from 'node:fs';
import { castMap } from '../../src/world/core/cast';
import { libraryLexicon } from '../../src/world/core/dialogue/lexicon';
import { answerFor, ScriptedDialogue } from '../../src/world/core/dialogue/scripted';
import { activeQuests, advanceQuests, reindexQuests } from '../../src/world/core/quests';
import { holds } from '../../src/world/core/flags';
import { applyAll, newSave, type SaveAction } from '../../src/world/core/save';
import { autoScene, sceneFor } from '../../src/world/core/scenes';
import type { Scene, WorldSave } from '../../src/world/core/types';
import { readMap, type MapInfo } from '../../src/world/engine/mapdata';
import { checkContent, readLibrary } from './check-content';
import { rackOf, rackScenes } from '../../src/world/core/rack';
import { cutsceneActions, cutscenesDue } from '../../src/world/core/cutscene';
import { BIKE_PARTS, BIKES } from '../../src/world/core/bike';

const lib = readLibrary();
const lex = libraryLexicon(lib);
const checked = checkContent('content/world', lib);
export const districts = checked.districts;
const clothes = checked.clothes;
// the clothes racks and the barber's menu talk like shops (§12 W5)
const scenes = [...rackScenes(clothes), ...districts.flatMap((d) => d.scenes)];
export const npcs = districts.flatMap((d) => d.npcs);
export const quests = districts.flatMap((d) => d.quests);
const stampIds = districts.flatMap((d) => d.stamps.map((x) => x.id));
/** everything a quest or scene wants photographed (X6): `<map>:<object>` */
const photoSubjects = [...new Set([...JSON.stringify(districts).matchAll(/"photo":"([^"]+)"/g)].map((m) => m[1]!))];
const shops = districts.flatMap((d) => d.shops ?? []);
export const cutscenes = new Map(districts.flatMap((d) => d.cutscenes ?? []).map((c) => [c.id, c]));
const items = new Map(districts.flatMap((d) => d.items).map((i) => [i.id, i]));
const src = new ScriptedDialogue({ scenes, npcs, shops, items: [...items.values()], clothes }, lex);
export const maps: MapInfo[] = districts
  .flatMap((d) => d.district.maps)
  .map((id) => readMap(id, JSON.parse(readFileSync(`public/world/maps/${id}.json`, 'utf8'))));

export interface Run {
  save: WorldSave;
  /** scenes in the order played */
  log: string[];
  /** payments the purse could not cover */
  short: string[];
  /** a save at the moment each chapter began */
  chapters: Map<number, WorldSave>;
}

function act(s: WorldSave, actions: readonly SaveAction[], short: string[], where: string): WorldSave {
  let money = s.bag.money;
  for (const a of actions) if (a.do === 'money') {
    if (money + a.amount < 0) short.push(`${where}: needs ${-a.amount} 元, has ${money}`);
    money += a.amount;
  }
  const ctx = { now: 1, quests: new Map(quests.map((q) => [q.id, q])) };
  const after = advanceQuests(applyAll(s, actions, ctx), quests, ctx);
  // cutscenes (§13 K1) play headless: said in these actions, or started by a quest step done — each ends, and what it gives is given
  const due = [...cutsceneActions(actions), ...cutscenesDue(s, after, quests)].filter((id, i, all) => all.indexOf(id) === i && !after.cutscenes.includes(id));
  if (!due.length) return after;
  const then: SaveAction[] = due.flatMap((id) => {
    const cs = cutscenes.get(id);
    if (!cs) short.push(`${where}: no cutscene "${id}"`);
    return [{ do: 'watched' as const, id }, ...(cs?.then ?? [])];
  });
  return act(after, then, short, `cutscene ${due.join(', ')}`);
}

/** A quest waits for your own bike and you have none (§13 L1): even a spendthrift saves up for it, and works the jobs until it can. */
const saving = (s: WorldSave) => !s.bike && s.bag.money < 250 && activeQuests(s, quests).some((a) => JSON.stringify(a.step.done ?? {}).includes('"bike":"owned"'));

/** What a patient player goes shopping for now: things the current step of a quest waits for, and things a scene could be used with right now. */
let spendAll = false;

/** How often a patient player buys the same thing: food a few times (the cat eats every day), anything else once. */
const bought = new Map<string, number>();
const buyLimit = (item: string) => (['food', 'drink'].includes(items.get(item)?.kind ?? '') ? 5 : 1);

function wantedNow(s: WorldSave): Set<string> {
  const out = new Set<string>();
  for (const a of activeQuests(s, quests)) for (const m of JSON.stringify(a.step.done ?? {}).matchAll(/"item":"([^"]+)"/g)) out.add(m[1]!);
  for (const sc of scenes) if (sc.use && holds(sc.when, s)) out.add(sc.use);
  return out;
}

function play(s: WorldSave, scene: Scene, short: string[]): WorldSave {
  let t = src.start(scene, s);
  let save = act(s, t.actions, short, scene.id);
  for (let guard = 0; !t.state.ended && guard < 40; guard++) {
    const node = scene.nodes.find((n) => n.id === t.state.node)!;
    // at a shop: buy one thing something is waiting for (or the first thing, for a story order), then pay (Y1)
    // paying on the phone (Y2): type the amount heard, or catch a wrong charge first
    if ((node.order || node.bargain || node.rack || node.bikes) && t.state.due) {
      t = src.reply(t.state, src.answer(t.state)!);
      for (const a of t.actions) if (a.do === 'give' || a.do === 'buy') bought.set(a.item, (bought.get(a.item) ?? 0) + 1);
      save = act(save, t.actions, short, scene.id);
      continue;
    }
    // a clothes rack (§12 W5): only a spendthrift buys — the cheapest thing not owned yet, tried on and worn out;
    // at the barber's a shorter cut. Anyone else says goodbye (nothing in the story needs clothes).
    if (node.rack) {
      const rack = rackOf(clothes, node.rack.rack)!;
      const r = t.state.rack!;
      let say: { text: string; choice?: string } = { text: '再见' };
      if (spendAll && !saving(save) && !r.bought) {
        const want = r.onSale
          .filter((id) => !save.wardrobe.includes(id))
          .map((id) => ({ id, price: clothes.clothes.find((c) => c.id === id.split(':')[0])!.price }))
          .sort((a, b) => a.price - b.price)[0];
        if (rack.hair) say = { text: r.hair?.style ? '好' : save.look.hair.style !== 'bald' && save.bag.money >= rack.hair.cut ? '剪短一点' : '再见' };
        else if (want && want.price <= save.bag.money) say = !r.focus || `${r.focus.item}:${r.focus.colour}` !== want.id ? { text: '', choice: want.id } : { text: src.answer(t.state)!.text };
      } else if (r.bought) say = { text: '穿着走' };
      t = src.reply(t.state, { via: 'keyboard', ...say });
      save = act(save, t.actions, short, scene.id);
      continue;
    }
    // the bike shop (§13 L1): a bike when a quest waits for one (and money enough), parts for a spendthrift; else goodbye
    if (node.bikes) {
      const r = t.state.bikes!;
      const wantsBike = !r.owned && activeQuests(save, quests).some((a) => JSON.stringify(a.step.done ?? {}).includes('"bike":"owned"'));
      const cheapest = Math.min(...BIKES.filter((b) => b.shop === 'zixingche').map((b) => b.price));
      const go = r.owned ? spendAll && BIKE_PARTS.some((p) => !r.owned!.parts.includes(p.id) && p.price <= save.bag.money) : wantsBike && save.bag.money >= cheapest;
      const hint = go ? src.answer(t.state) : null;
      // the cheapest bike, then its test ride and 我要这辆 (the hint's own path)
      const say = !go || !hint ? { text: '再见' } : !r.owned && !r.focus ? { text: '', choice: BIKES.filter((b) => b.shop === 'zixingche').sort((a, b) => a.price - b.price)[0]!.id } : { text: hint.text };
      t = src.reply(t.state, { via: 'keyboard', ...say });
      save = act(save, t.actions, short, scene.id);
      continue;
    }
    if (node.order) {
      const shop = shops.find((x) => x.id === node.order!.shop)!;
      const wanted = wantedNow(save);
      const need = shop.stock.find(
        (x) => wanted.has(x.item) && !(save.bag.items[x.item] ?? 0) && (t.state.onSale ?? []).includes(x.item) && (bought.get(x.item) ?? 0) < buyLimit(x.item),
      );
      const any = spendAll && !saving(save) ? shop.stock.find((x) => (t.state.onSale ?? []).includes(x.item) && !bought.has(x.item)) : undefined;
      const pick = need ?? any ?? (node.order.go ? shop.stock.find((x) => (t.state.onSale ?? []).includes(x.item)) : undefined);
      const name = pick && items.get(pick.item)?.name;
      const say = t.state.cart?.length || !name ? '不要了' : `我要一${pick!.measure ?? '个'}${name}`;
      t = src.reply(t.state, { text: say, via: 'keyboard' });
      // only what was paid for counts as bought
      for (const a of t.actions) if (a.do === 'give' || a.do === 'buy') bought.set(a.item, (bought.get(a.item) ?? 0) + 1);
      save = act(save, t.actions, short, scene.id);
      continue;
    }
    const answer = answerFor(node, t.state.name ?? '');
    t = answer ? src.reply(t.state, answer) : node.expect?.length ? src.reply(t.state, { text: '', via: 'keyboard' }) : src.proceed(t.state);
    save = act(save, t.actions, short, scene.id);
  }
  return save;
}

/** What counts as the game moving on: not money, not the clock, not who has been met. */
const progress = (s: WorldSave) =>
  JSON.stringify([
    [...s.flags].sort(),
    Object.entries(s.quests).sort(),
    Object.keys(s.spirits).sort(),
    Object.keys(s.idioms).sort(),
    Object.keys(s.stamps).sort(),
    Object.entries(s.bag.items).filter(([, n]) => n > 0).map(([k]) => k).sort(),
    [...s.scenes].sort(),
    s.chapter,
    s.bag.card !== null,
    [...s.stations].sort(),
    // short of money, a day's job is worth doing (Y3)
    s.bag.money < (saving(s) ? 250 : spendAll ? 160 : 100) ? s.daily : null,
    // a spendthrift's new clothes and haircuts count too (§12 W5)
    spendAll ? [s.wardrobe.length, s.look.hair.style] : null,
  ]);

const chapterOf = new Map(districts.flatMap((d) => d.district.maps.map((m) => [m, d.district.chapter] as const)));

/** Everything that could start now, in the parts of the city the story has reached (a player may wander ahead; the solver follows the story). */
function candidates(s: WorldSave): Scene[] {
  const out: Scene[] = [];
  const held = new Set(Object.entries(s.bag.items).filter(([, n]) => n > 0).map(([k]) => k));
  for (const m of maps) {
    if ((chapterOf.get(m.id) ?? 1) > s.chapter) continue;
    const auto = autoScene(autoIdx.get(m.id) ?? [], s, m.id);
    if (auto) out.push(auto);
    for (const o of castMap(m.objects, m.id, npcs, s)) {
      const list = o.kind === 'npc' ? talkIdx.get(o.npc) : o.kind === 'prop' || o.kind === 'sign' ? lookIdx.get(`${m.id}|${o.id}`) : undefined;
      if (!list) continue;
      const who = o.kind === 'npc' ? { npc: o.npc } : { look: o.id, map: m.id };
      const sc = sceneFor(list, s, who);
      // a stall's bargain is struck once (buying a coin and selling it back forever moves nothing)
      // clothes racks only for the spendthrift check: nothing in the story needs them
      if (sc && !(sc.nodes.some((n) => n.bargain) && s.scenes.includes(sc.id)) && ((spendAll && !saving(s)) || !sc.id.startsWith('rack-'))) out.push(sc);
      // using what is in the bag on them (X1): only the items some scene here is written for
      for (const use of new Set(list.map((x) => x.use).filter((u): u is string => !!u && held.has(u)))) {
        const u = sceneFor(list, s, { ...who, use });
        if (u) out.push(u);
      }
    }
  }
  return out;
}

/** Scenes by who or what they belong to, so a step looks at a handful instead of all of them. */
const talkIdx = new Map<string, Scene[]>();
const lookIdx = new Map<string, Scene[]>();
const autoIdx = new Map<string, Scene[]>();
for (const sc of scenes) {
  const key = sc.trigger === 'talk' && sc.npc ? sc.npc : sc.trigger === 'look' ? `${sc.map}|${sc.object ?? sc.id}` : sc.trigger === 'auto' ? sc.map : null;
  const idx = sc.trigger === 'talk' ? talkIdx : sc.trigger === 'look' ? lookIdx : sc.trigger === 'auto' ? autoIdx : null;
  if (!key || !idx) continue;
  idx.set(key, [...(idx.get(key) ?? []), sc]);
}

/** One talk with each person on the maps reached whom today's talk has not warmed yet (the page's small talk). */
function chatRound(s: WorldSave, short: string[]): WorldSave {
  const today = Math.floor(s.clock / 1440) + 1;
  const who = new Set<string>();
  for (const m of maps) {
    if ((chapterOf.get(m.id) ?? 1) > s.chapter) continue;
    for (const o of castMap(m.objects, m.id, npcs, s)) if (o.kind === 'npc') who.add(o.npc);
  }
  const actions: SaveAction[] = [];
  for (const npc of [...who].sort()) {
    const mem = s.npcs[npc];
    if (mem && (mem.hearts >= 5 || mem.talk === today)) continue;
    actions.push({ do: 'meet', npc }, { do: 'talked', npc });
  }
  return actions.length ? act(s, actions, short, 'chat') : s;
}

/** The first station with a map not yet visited that a ride can reach now: a card for the subway and buses, a ticket for the train. */
function rideTo(s: WorldSave): { to: string; actions: SaveAction[] } | null {
  if (s.bag.card === null) return null;
  for (const m of maps) {
    if ((chapterOf.get(m.id) ?? 1) > s.chapter) continue;
    const sub = /^station-(.+)$/.exec(m.id)?.[1];
    const stop = /^stop-(.+)$/.exec(m.id)?.[1];
    const id = sub ?? stop;
    if (!id || s.stations.includes(id)) continue;
    const train = id === 'badalingchangcheng';
    if (train && !s.flags.includes('train-ticket')) continue;
    const fare = train ? 0 : sub ? 3 : 2;
    if (s.bag.card < fare) continue;
    return { to: id, actions: [{ do: 'card', amount: -fare }, { do: 'station', station: id }] };
  }
  return null;
}

/**
 * `goal`: stop as soon as it holds (the golden saves only need the main
 * story), and wait through the calendar only while it does not. Without one
 * the solver plays everything: every quest and every stamp.
 */
export interface SolveOptions {
  /** buy everything every shop offers (once each): the "can a spendthrift soft-lock?" check (Y3) */
  spendAll?: boolean;
}

export function solve(start: WorldSave = newSave("solver", 0), maxSteps = 40000, goal?: (s: WorldSave) => boolean, opts: SolveOptions = {}): Run {
  spendAll = !!opts.spendAll;
  // a save made before a chapter was deepened keeps its step (§13 S1)
  let s = reindexQuests(start, quests);
  bought.clear();
  const log: string[] = [];
  const short: string[] = [];
  const chapters = new Map<number, WorldSave>([[s.chapter, s]]);
  const tried = new Set<string>();
  for (let step = 0, idle = 0; step < maxSteps; step++) {
    if (goal?.(s)) break;
    const key = progress(s);
    // a shop is worth another visit when something new is wanted (rain brings the umbrella, winter the couplets)
    const want = [...wantedNow(s)].sort().join(',');
    const tryKey = (sc: Scene) => `${sc.id}|${key}${sc.id.startsWith('shop-') || sc.id.startsWith('rack-') ? `|${want}|${Math.floor(s.bag.money / 10)}` : ''}`;
    // a patient player puts a decoration on an empty spot, and does not keep swapping them round
    const swaps = (sc: Scene) => sc.nodes.some((n) => n.onEnter?.some((x) => x.do === 'place' && s.room[x.spot]));
    const next = candidates(s).find((sc) => !tried.has(tryKey(sc)) && !swaps(sc));
    if (!next) {
      // a ride somewhere new (the page's ride sheet: out at a station, the fare from the card)
      const ride = rideTo(s);
      if (ride) {
        const after = act(s, ride.actions, short, `ride to ${ride.to}`);
        if (progress(after) !== key) {
          log.push(`ride:${ride.to}`);
          if (after.chapter !== s.chapter) chapters.set(after.chapter, after);
          s = after;
          idle = 0;
          continue;
        }
      }
      // a shared bike (the page's stands): ride one, then park
      // …and again while a quest waits for a ride (side-bike): a real player rides whenever they like
      const bikeWanted = activeQuests(s, quests).some((a) => JSON.stringify(a.step.done ?? {}).includes('"flag":"on-bike"'));
      if (s.chapter >= 2 && (!s.flags.includes('rode-bike') || bikeWanted) && s.bag.money >= 1) {
        const after = act(act(s, [{ do: 'flag', flag: 'on-bike' }], short, 'bike'), [{ do: 'flag', flag: 'on-bike', value: false }, { do: 'flag', flag: 'rode-bike' }, { do: 'money', amount: -1 }], short, 'bike');
        log.push('bike');
        s = after;
        idle = 0;
        continue;
      }
      // photos of what someone asked for, where the story has reached (X6)
      const shots = photoSubjects.filter((p) => !s.photos.includes(p) && (chapterOf.get(p.split(':')[0]!) ?? 99) <= s.chapter && (s.stations.length > 0 || p.startsWith('gulou')));
      if (shots.length) {
        log.push('photo');
        s = act(s, [{ do: 'photo', subjects: shots }], short, 'photo');
        idle = 0;
        continue;
      }
      // a patient player chats with everyone about once a day (X2): friendship grows, stories open
      const chatted = chatRound(s, short);
      if (chatted !== s) {
        log.push('chat');
        s = chatted;
        idle = 0;
      }
      // nothing moves: let the day run on to the next part of it — through a whole
      // year of game days while a quest still waits for rain, snow or a festival (X4)
      const waiting = goal ? !goal(s) : quests.some((q) => !s.quests[q.id]?.done) || stampIds.some((id) => s.stamps[id] === undefined);
      if (++idle > (waiting ? 4 * 60 : 8)) break;
      const hour = Math.floor(s.clock / 60) % 24;
      const to = [7, 12, 17, 20].find((h) => h > hour) ?? 31;
      s = act(s, [{ do: 'tick', minutes: Math.floor(s.clock / 1440) * 1440 + to * 60 }], short, 'clock');
      continue;
    }
    tried.add(tryKey(next));
    const spent: string[] = [];
    const after = play(s, next, spent);
    // a talk that moves nothing is as if it never happened (no buying water twenty times)
    if (progress(after) !== key) {
      idle = 0;
      log.push(next.id + (after.bag.money !== s.bag.money ? `(${after.bag.money - s.bag.money})` : ""));
      short.push(...spent);
      if (after.chapter !== s.chapter) chapters.set(after.chapter, after);
      s = after;
    }
  }
  return { save: s, log, short, chapters };
}

