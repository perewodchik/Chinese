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
import { ScriptedDialogue } from '../../src/world/core/dialogue/scripted';
import { advanceQuests } from '../../src/world/core/quests';
import { applyAll, newSave, type SaveAction } from '../../src/world/core/save';
import { autoScene, sceneFor } from '../../src/world/core/scenes';
import type { Scene, WorldSave } from '../../src/world/core/types';
import { readMap, type MapInfo } from '../../src/world/engine/mapdata';
import { checkContent, readLibrary } from './check-content';

const lib = readLibrary();
const lex = libraryLexicon(lib);
export const districts = checkContent('content/world', lib).districts;
const scenes = districts.flatMap((d) => d.scenes);
export const npcs = districts.flatMap((d) => d.npcs);
export const quests = districts.flatMap((d) => d.quests);
const src = new ScriptedDialogue({ scenes, npcs }, lex);
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
  return advanceQuests(applyAll(s, actions, ctx), quests, ctx);
}

function play(s: WorldSave, scene: Scene, short: string[]): WorldSave {
  let t = src.start(scene, s);
  let save = act(s, t.actions, short, scene.id);
  for (let guard = 0; !t.state.ended && guard < 40; guard++) {
    const node = scene.nodes.find((n) => n.id === t.state.node)!;
    t = node.expect?.length ? src.reply(t.state, { text: node.hint?.full ?? '', via: 'keyboard' }) : src.proceed(t.state);
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
  ]);

const chapterOf = new Map(districts.flatMap((d) => d.district.maps.map((m) => [m, d.district.chapter] as const)));

/** Everything that could start now, in the parts of the city the story has reached (a player may wander ahead; the solver follows the story). */
function candidates(s: WorldSave): Scene[] {
  const out: Scene[] = [];
  for (const m of maps) {
    if ((chapterOf.get(m.id) ?? 1) > s.chapter) continue;
    const auto = autoScene(scenes, s, m.id);
    if (auto) out.push(auto);
    const held = Object.entries(s.bag.items).filter(([, n]) => n > 0).map(([k]) => k);
    for (const o of castMap(m.objects, m.id, npcs, s)) {
      const sc = o.kind === 'npc' ? sceneFor(scenes, s, { npc: o.npc }) : o.kind === 'prop' || o.kind === 'sign' ? sceneFor(scenes, s, { look: o.id, map: m.id }) : null;
      if (sc) out.push(sc);
      // using what is in the bag on them (X1)
      for (const use of held) {
        const u = o.kind === 'npc' ? sceneFor(scenes, s, { npc: o.npc, use }) : o.kind === 'prop' || o.kind === 'sign' ? sceneFor(scenes, s, { look: o.id, map: m.id, use }) : null;
        if (u) out.push(u);
      }
    }
  }
  return out;
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

export function solve(start: WorldSave = newSave("solver", 0), maxSteps = 40000): Run {
  let s = start;
  const log: string[] = [];
  const short: string[] = [];
  const chapters = new Map<number, WorldSave>([[s.chapter, s]]);
  const tried = new Set<string>();
  for (let step = 0, idle = 0; step < maxSteps; step++) {
    const key = progress(s);
    const next = candidates(s).find((sc) => !tried.has(`${sc.id}|${key}`));
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
      if (s.chapter >= 2 && !s.flags.includes('rode-bike')) {
        const after = act(act(s, [{ do: 'flag', flag: 'on-bike' }], short, 'bike'), [{ do: 'flag', flag: 'on-bike', value: false }, { do: 'flag', flag: 'rode-bike' }, { do: 'money', amount: -1 }], short, 'bike');
        log.push('bike');
        s = after;
        idle = 0;
        continue;
      }
      // nothing moves: let the day run on to the next part of it
      if (++idle > 8) break;
      const hour = Math.floor(s.clock / 60) % 24;
      const to = [7, 12, 17, 20].find((h) => h > hour) ?? 31;
      s = act(s, [{ do: 'tick', minutes: Math.floor(s.clock / 1440) * 1440 + to * 60 }], short, 'clock');
      continue;
    }
    tried.add(`${next.id}|${key}`);
    const spent: string[] = [];
    const after = play(s, next, spent);
    // a talk that moves nothing is as if it never happened (no buying water twenty times)
    if (progress(after) !== key) {
      idle = 0;
      log.push(next.id);
      short.push(...spent);
      if (after.chapter !== s.chapter) chapters.set(after.chapter, after);
      s = after;
    }
  }
  return { save: s, log, short, chapters };
}

