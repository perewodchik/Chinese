/**
 * Side quests you can't miss (§13 Q1). The learner asked for side quests
 * to be explicit — this reverses §10's vague leads: every side quest of the
 * chapters reached is listed by name, who gives it, where, the first thing
 * to do, what it gives, and *when* when it cannot start now ("mornings
 * 6:00–10:00", "at 中秋节", "from chapter 3").
 *
 * The marks over people come from the same reading: a red 「!」 for the
 * person the story needs now, a gold 「!」 for someone with a side quest to
 * start now, a small 「…」 for someone with the next step of a quest under
 * way — each only when their scene would start right now.
 */

import { rewardLine, type RewardNames } from './celebrate';
import { FESTIVALS } from './calendar';
import { holds } from './flags';
import { hoodOf } from './hoods';
import { hoodDistance, npcHome, startScenes, stepMaps, type JournalContent } from './journal';
import { placeOf } from './places';
import { activeQuests } from './quests';
import { sceneFor } from './scenes';
import type { Action, Condition, MapObject, Quest, QuestStep, Scene, WorldSave } from './types';
import { stepIndexOf } from './save';

export interface SideEntry {
  quest: Quest;
  /** `new`: not started yet; `on`: under way */
  state: 'new' | 'on';
  giver?: string;
  giverName?: string;
  /** where to go: the giver's usual map, or where it starts; for one under way, where its step is */
  map?: string;
  hood?: string;
  /** what to do first (or next, when under way) */
  first: string;
  /** what it gives: 🎁 an item, 成语, ♥ a friend, 元 */
  gives: string[];
  /** null: it can start now; else when it can */
  when: string | null;
}

type Content = JournalContent & RewardNames;

// --- when --------------------------------------------------------------------------

const WEATHER: Record<string, string> = { rain: 'on a rainy day', snow: 'on a snowy day', wind: 'on a windy day', clear: 'on a clear day', cloudy: 'on a cloudy day' };

/** A condition that does not hold now, said as when it will: the parts that time brings round, plainly. */
export function whenText(c: Condition | undefined, s: WorldSave, names: Pick<Content, 'npcs'> = { npcs: [] }): string {
  const out: string[] = [];
  const walk = (x: Condition) => {
    if (holds(x, s)) return;
    if ('all' in x) return x.all.forEach(walk);
    if ('any' in x) return walk(x.any[0]!);
    if ('hours' in x) {
      const [a, b] = x.hours;
      const span = `${a}:00–${b === 24 ? 24 : b}:00`;
      out.push(a < 11 && b <= 12 ? `mornings ${span}` : a >= 17 || b <= 6 ? `evenings ${span}` : span);
    } else if ('festival' in x) out.push(`at ${FESTIVALS.find((f) => f.id === x.festival)?.zh ?? x.festival}`);
    else if ('season' in x) out.push(`in ${x.season}`);
    else if ('weather' in x) out.push(WEATHER[x.weather] ?? 'another day');
    else if ('chapter' in x) out.push(`from chapter ${x.chapter}`);
    else if ('hearts' in x) out.push(`once ${names.npcs.find((n) => n.id === x.hearts)?.name ?? 'they'} is a friend (♥${x.min})`);
    else if ('daily' in x || 'fresh' in x || ('not' in x && ('daily' in x.not || 'fresh' in x.not))) out.push('tomorrow');
    else if ('money' in x) out.push(`with ${x.money} 元`);
    else out.push('later in the story');
  };
  if (c) walk(c);
  return [...new Set(out)].join(' · ') || 'later';
}

// --- the list ------------------------------------------------------------------------

/**
 * Every side quest of the chapters reached that is not finished: under way
 * first, then those that can start now, then those that wait — your
 * neighbourhood first within each.
 */
export function sideQuests(s: WorldSave, content: Content): SideEntry[] {
  const out: (SideEntry & { dist: number })[] = [];
  const nameOf = (id?: string) => (id ? content.npcs.find((n) => n.id === id)?.name : undefined);
  for (const q of content.quests) {
    if (q.kind !== 'side' || q.chapter > s.chapter) continue;
    const st = s.quests[q.id];
    if (st?.done) continue;
    const gives = rewardLine(q.reward, content);
    const giverName = nameOf(q.giver);
    if (st) {
      const step = q.steps[stepIndexOf(q, st)] ?? q.steps[0]!;
      const map = stepMaps(step, content, s)[0];
      const hood = map ? hoodOf(map)?.id : undefined;
      out.push({ quest: q, state: 'on', ...(q.giver ? { giver: q.giver } : {}), ...(giverName ? { giverName } : {}), ...(map ? { map } : {}), ...(hood ? { hood } : {}), first: step.now, gives, when: step.when ?? null, dist: hoodDistance(s, hood) });
      continue;
    }
    const starts = startScenes(q, content.scenes);
    const map = (q.giver ? npcHome(q.giver, content) : undefined) ?? starts[0]?.map;
    const hood = map ? hoodOf(map)?.id : undefined;
    const now = !starts.length || starts.some((sc) => holds(sc.when, s));
    const when = now ? null : whenText(starts[0]!.when, s, content);
    out.push({ quest: q, state: 'new', ...(q.giver ? { giver: q.giver } : {}), ...(giverName ? { giverName } : {}), ...(map ? { map } : {}), ...(hood ? { hood } : {}), first: q.steps[0]!.now, gives, when, dist: hoodDistance(s, hood) });
  }
  const rank = (e: SideEntry) => (e.state === 'on' ? 0 : e.when === null ? 1 : 2);
  return out
    .sort((a, b) => rank(a) - rank(b) || a.dist - b.dist || a.quest.chapter - b.quest.chapter || content.quests.indexOf(a.quest) - content.quests.indexOf(b.quest))
    .map(({ dist: _d, ...e }) => e);
}

/** "李阿姨 at 小卖部" — who and where, for a line or a row; a quest with nobody to ask goes by its name ("The hutong cat, in 帽儿胡同"). */
export function whoWhere(e: SideEntry): string {
  const place = e.map ? (placeOf(e.map)?.zh ?? hoodOf(e.map)?.zh) : undefined;
  if (!e.giverName) return place ? `${e.quest.title}, in ${place}` : e.quest.title;
  return place ? `${e.giverName} at ${place}` : e.giverName;
}

// --- marks over people -----------------------------------------------------------------

export type QuestMark = 'main' | 'side' | 'next';
const RANK: Record<QuestMark, number> = { main: 0, side: 1, next: 2 };

const actionsOf = (sc: Scene): Action[] =>
  sc.nodes.flatMap((n) => [...(n.onEnter ?? []), ...(n.onExit ?? []), ...(n.expect ?? []).flatMap((e) => e.actions ?? []), ...(n.choose?.actions ?? []), ...(n.trace?.actions ?? [])]);

const leaves = (c: Condition | undefined): Condition[] =>
  !c ? [] : 'all' in c ? c.all.flatMap(leaves) : 'any' in c ? c.any.flatMap(leaves) : 'not' in c ? [] : [c];

/** Whether playing a scene moves a quest's step on: the step waits for it, or for something it does. */
export function sceneMoves(sc: Scene, q: Quest, step: QuestStep): boolean {
  const acts = actionsOf(sc);
  const here = q.steps.indexOf(step);
  // a quest action counts when it moves the quest forward (a start scene played again does not)
  if (acts.some((a) => (a.do === 'quest_done' && a.quest === q.id) || (a.do === 'quest' && a.quest === q.id && q.steps.findIndex((x) => x.id === a.step) > here))) return true;
  return leaves(step.done).some((c) => {
    if ('scene' in c) return c.scene === sc.id;
    if ('met' in c) return c.met === sc.npc;
    if ('flag' in c) return acts.some((a) => a.do === 'flag' && a.flag === c.flag && a.value !== false);
    if ('spirit' in c) return acts.some((a) => a.do === 'spirit' && a.spirit === c.spirit);
    if ('idiom' in c) return acts.some((a) => a.do === 'idiom' && a.idiom === c.idiom);
    if ('item' in c) return acts.some((a) => (a.do === 'give' || a.do === 'buy') && a.item === c.item);
    return false;
  });
}

/** Whether a scene starts a side quest not yet begun. */
export function sceneStartsSide(sc: Scene, s: WorldSave, quests: readonly Quest[]): boolean {
  return actionsOf(sc).some((a) => {
    if (a.do !== 'quest') return false;
    const q = quests.find((x) => x.id === a.quest);
    return !!q && q.kind === 'side' && !s.quests[q.id] && q.steps[0]?.id === a.step;
  });
}

/** What a person's scene now would do for your quests, as a mark — or none. */
export function markOf(sc: Scene | null, s: WorldSave, quests: readonly Quest[]): QuestMark | null {
  if (!sc) return null;
  let best: QuestMark | null = null;
  const take = (m: QuestMark) => (best = best === null || RANK[m] < RANK[best] ? m : best);
  for (const a of activeQuests(s, quests)) if (sceneMoves(sc, a.quest, a.step)) take(a.quest.kind === 'main' ? 'main' : 'next');
  if (sceneStartsSide(sc, s, quests)) take('side');
  return best;
}

/** The marks for the people standing on a map now, by their object id. */
export function questMarks(s: WorldSave, content: Pick<JournalContent, 'scenes' | 'quests'>, objects: readonly MapObject[]): Record<string, QuestMark> {
  const out: Record<string, QuestMark> = {};
  for (const o of objects) {
    if (o.kind !== 'npc') continue;
    const m = markOf(sceneFor(content.scenes, s, { npc: o.npc }), s, content.quests);
    if (m) out[o.id] = m;
  }
  return out;
}

/** Maps with a mark, for the minimap: where the story waits, where a side quest can start now, where a step under way waits. */
export function markedMaps(s: WorldSave, content: Content): Map<string, QuestMark> {
  const out = new Map<string, QuestMark>();
  const put = (map: string | undefined, m: QuestMark) => {
    if (!map) return;
    const cur = out.get(map);
    if (!cur || RANK[m] < RANK[cur]) out.set(map, m);
  };
  for (const a of activeQuests(s, content.quests)) for (const map of stepMaps(a.step, content, s)) put(map, a.quest.kind === 'main' ? 'main' : 'next');
  for (const e of sideQuests(s, content)) if (e.state === 'new' && e.when === null) put(e.map, 'side');
  return out;
}

/** Per neighbourhood: side quests that can start now, and ones under way there (the metro map's "3 new · 1 on"). */
export function hoodCounts(s: WorldSave, content: Content): Map<string, { new: number; on: number }> {
  const out = new Map<string, { new: number; on: number }>();
  for (const e of sideQuests(s, content)) {
    if (!e.hood || (e.state === 'new' && e.when !== null)) continue;
    const c = out.get(e.hood) ?? { new: 0, on: 0 };
    if (e.state === 'new') c.new++;
    else c.on++;
    out.set(e.hood, c);
  }
  return out;
}

// --- 兔儿爷's nudges ---------------------------------------------------------------------

/** The `seen` key that keeps the arrival nudge to once per neighbourhood per chapter. */
export const nudgeKey = (hood: string, chapter: number) => `nudge:${hood}:${chapter}`;

/** On arriving in a neighbourhood: one line about someone here who could use a hand now — once per chapter. */
export function arrivalNudge(s: WorldSave, content: Content, hood: string): string | null {
  if ((s.seen?.[nudgeKey(hood, s.chapter)] ?? 0) > 0) return null;
  const e = sideQuests(s, content).find((x) => x.hood === hood && x.state === 'new' && x.when === null);
  return e ? `Someone here could use a hand — ${whoWhere(e)}.` : null;
}

/** The neighbourhoods a chapter's story walks through: where its main steps are. */
export function chapterHoods(content: Content, chapter: number): Set<string> {
  const out = new Set<string>();
  for (const q of content.quests)
    if (q.kind === 'main' && q.chapter === chapter)
      for (const st of q.steps) for (const m of stepMaps(st, content)) {
        const h = hoodOf(m)?.id;
        if (h) out.add(h);
      }
  return out;
}

/** Before a chapter's finale: up to two side quests open in its neighbourhoods (can start now, or under way). */
export function openBeforeFinale(s: WorldSave, content: Content, hoods: ReadonlySet<string>): SideEntry[] {
  return sideQuests(s, content)
    .filter((e) => !!e.hood && hoods.has(e.hood) && (e.state === 'on' || e.when === null))
    .slice(0, 2);
}
