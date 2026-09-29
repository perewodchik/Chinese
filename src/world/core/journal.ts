/**
 * The journal (prompt §10 J1–J2): where a quest's step happens, the way
 * there as legs to draw, and the journal itself — the quest you follow,
 * the others under way, the story so far chapter by chapter, and leads to
 * side quests not yet started. Pure: the Journal tab only draws this.
 */

import { dayOf } from './clock';
import { holds } from './flags';
import { HOODS, hoodOf, wayThere } from './hoods';
import { placeOf, walkPath, type MapLinks } from './places';
import { activeQuests, type Now } from './quests';
import { DONE_AT } from './save';
import type { Shop } from './shop';
import { findRoute, type Mode } from './travel';
import type { Condition, NpcCard, Quest, QuestState, QuestStep, Scene, WorldSave } from './types';

/** What the journal reads of the content. */
export interface JournalContent {
  quests: readonly Quest[];
  scenes: readonly Scene[];
  npcs: readonly NpcCard[];
  shops?: readonly Shop[];
}

/** A step with no place at all ("ride a shared bike anywhere"). */
export const ANYWHERE = 'anywhere';

/**
 * Where a person usually is: the first stop of their day, else the map
 * where people talk to them (the maps place most people by the map, not
 * by a timetable).
 */
export function npcHome(npc: string, c: Pick<JournalContent, 'npcs' | 'scenes'>): string | undefined {
  const card = c.npcs.find((n) => n.id === npc);
  const routine = card?.routine.find((r) => r.map !== 'school')?.map;
  if (routine) return routine;
  const counts = new Map<string, number>();
  for (const sc of c.scenes) if (sc.npc === npc && sc.trigger === 'talk') counts.set(sc.map, (counts.get(sc.map) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * The maps a condition points at: a scene's map, a station, where a person
 * is, the map a photo is taken on, the shop that sells a thing, the cat's
 * lane. With a save, only the parts that do not hold yet count (what is
 * done is no longer somewhere to go).
 */
export function conditionMaps(c: Condition, content: Omit<JournalContent, 'quests'>, s?: WorldSave): string[] {
  const out = new Set<string>();
  const walk = (x: Condition) => {
    if (s && holds(x, s)) return;
    if ('all' in x) x.all.forEach(walk);
    else if ('any' in x) x.any.forEach(walk);
    else if ('scene' in x) {
      const map = content.scenes.find((sc) => sc.id === x.scene)?.map;
      if (map) out.add(map);
    } else if ('station' in x) out.add(`station-${x.station}`);
    else if ('met' in x) {
      const map = npcHome(x.met, content);
      if (map) out.add(map);
    } else if ('photo' in x) {
      const [map] = x.photo.split(':');
      if (map && map !== 'npc') out.add(map);
    } else if ('item' in x && !('count' in x && x.count === 0)) {
      const shop = content.shops?.find((sh) => sh.stock.some((st) => st.item === x.item));
      if (shop) out.add(shop.map);
    } else if ('cat' in x) out.add('hutong-home');
  };
  walk(c);
  return [...out];
}

/** The maps of a step: what its condition points at, else its `where` (none for `anywhere`). */
export function stepMaps(step: QuestStep, content: Omit<JournalContent, 'quests'>, s?: WorldSave): string[] {
  const from = step.done ? conditionMaps(step.done, content, s) : [];
  if (from.length) return from;
  return step.where && step.where !== ANYWHERE ? [step.where] : [];
}

/**
 * The content check for the journal (J1): a kind on every quest (the
 * schema), a blurb on side quests, a place for every main step, and every
 * `where` a real map. `maps` is the set of built map ids.
 */
export function checkJournal(content: JournalContent, maps: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  for (const q of content.quests) {
    if (q.kind === 'side' && !q.blurb) errors.push(`quest ${q.id}: a side quest needs a blurb`);
    if (q.giver && !content.npcs.some((n) => n.id === q.giver)) errors.push(`quest ${q.id}: unknown giver ${q.giver}`);
    for (const st of q.steps) {
      if (st.where && st.where !== ANYWHERE && !maps.has(st.where)) errors.push(`quest ${q.id}/${st.id}: where "${st.where}" is not a map`);
      if (q.kind === 'main' && st.where !== ANYWHERE && !stepMaps(st, content).length) errors.push(`quest ${q.id}/${st.id}: a main step needs a place (a scene, station, person … or where)`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// J2: targets, directions, the journal
// ---------------------------------------------------------------------------

export interface Target {
  map: string;
  /** its neighbourhood (core/hoods.ts), and that neighbourhood's station */
  hood?: string;
  station?: string;
}

const target = (map: string): Target => {
  const h = hoodOf(map);
  return { map, ...(h ? { hood: h.id, station: h.stations[0] } : {}) };
};

/** Where a quest's current step waits (none when it is finished, not started, or has no place). */
export function stepTargets(s: WorldSave, quest: Quest, content: Omit<JournalContent, 'quests'>): Target[] {
  const st = s.quests[quest.id];
  if (!st || st.done) return [];
  const step = quest.steps[st.index] ?? quest.steps.find((x) => x.id === st.step);
  return step ? stepMaps(step, content, s).map(target) : [];
}

/** The quest being followed: the tracked one while it is under way, else the current main step, else any quest under way. */
export function trackedQuest(s: WorldSave, quests: readonly Quest[]): Now | undefined {
  const active = activeQuests(s, quests);
  const id = s.tracked?.quest;
  return (id ? active.find((a) => a.quest.id === id) : undefined) ?? active.find((a) => a.quest.kind === 'main') ?? active[0];
}

// --- directions --------------------------------------------------------------

/** One piece of the way, to draw as a chip: on foot through maps, a ride on a line, a change of line. */
export type RouteLeg =
  | { kind: 'walk'; maps: string[] }
  | { kind: 'ride'; line: string; mode: Exclude<Mode, never>; direction: string; from: string; to: string; stops: string[] }
  | { kind: 'change'; at: string; line: string };

export interface Directions {
  kind: 'here' | 'walk' | 'ride' | 'none';
  legs: RouteLeg[];
  /** yuan for the whole ride, 0 on foot */
  fare: number;
  /** a 交通卡 bought, and enough on it for this ride */
  hasCard: boolean;
  enough: boolean;
  /** why there is no way, for `none` */
  note?: string;
}

const stationMap = (id: string, index: MapLinks) => [`station-${id}`, `stop-${id}`].find((m) => index[m]) ?? `station-${id}`;

/**
 * The way from where you stand to a map, as legs (J2): on foot through the
 * maps; or on foot to your neighbourhood's station, the rides with their
 * line, direction and stops, the changes between them, and on foot from
 * the station you get off at. Built on the same walks and routes as the
 * 🗺 panel's `wayThere`.
 */
export function directions(s: WorldSave, to: string, index: MapLinks): Directions {
  const card = s.bag.card;
  const base = { fare: 0, hasCard: card !== null, enough: card !== null };
  const way = wayThere(s, to, index);
  if (way.kind === 'here') return { kind: 'here', legs: [], ...base };
  if (way.kind === 'walk') return { kind: 'walk', legs: [{ kind: 'walk', maps: way.path }], ...base };
  if (way.kind === 'none') return { kind: 'none', legs: [], ...base, note: way.text };
  const r = findRoute(way.from, way.to);
  if (!r) return { kind: 'none', legs: [], ...base, note: way.text };
  const legs: RouteLeg[] = [];
  const first = walkPath(index, s.place.map, stationMap(way.from, index));
  if (first && first.length > 1) legs.push({ kind: 'walk', maps: first });
  let prev: string | null = null;
  for (const l of r.legs) {
    if (l.mode === 'walk') {
      legs.push({ kind: 'walk', maps: [stationMap(l.from, index), stationMap(l.to, index)] });
      prev = null;
      continue;
    }
    if (prev) legs.push({ kind: 'change', at: l.from, line: l.line });
    legs.push({ kind: 'ride', line: l.line, mode: l.mode, direction: l.direction, from: l.from, to: l.to, stops: l.stops });
    prev = l.line;
  }
  if (way.then && way.then.length > 1) legs.push({ kind: 'walk', maps: way.then });
  return { kind: 'ride', legs, fare: r.fare, hasCard: card !== null, enough: card !== null && card >= r.fare };
}

// --- the journal ------------------------------------------------------------

export interface JournalQuest {
  quest: Quest;
  step: QuestStep;
  targets: Target[];
  /** the step's timing note */
  when?: string;
  giver?: string;
  /** the steps done so far, oldest first: their past line and the game day (none for "earlier") */
  log: { step: string; past: string; day?: number }[];
  /** the latest minute anything happened in it (for "newest first") */
  latest: number;
}

export interface StoryEntry {
  quest: string;
  step: string;
  past: string;
  day?: number;
}

export interface StoryChapter {
  chapter: number;
  /** the main quest's id and title */
  quest?: string;
  title: string;
  done: boolean;
  entries: StoryEntry[];
  /** side quests finished while this chapter was the story's */
  side: { quest: Quest; entries: StoryEntry[]; day?: number }[];
  /** first and last day with a stamp */
  days?: readonly [number, number];
}

export interface Lead {
  quest: Quest;
  text: string;
  /** where to look: the giver's usual map (or where the quest starts) */
  map?: string;
  hood?: string;
}

export interface Journal {
  tracked?: JournalQuest;
  active: JournalQuest[];
  story: StoryChapter[];
  leads: Lead[];
}

/** The steps a quest has left behind it, each told in its past line, with the day it was done. */
function logOf(q: Quest, st: QuestState): StoryEntry[] {
  const upto = st.done ? q.steps.length : st.index;
  const out: StoryEntry[] = [];
  for (let i = 0; i < upto; i++) {
    const step = q.steps[i]!;
    // a step is done when a later one is reached (steps can be skipped), the last when the quest is finished
    const at = [...q.steps.slice(i + 1).map((x) => x.id), DONE_AT].map((k) => st.at?.[k]).find((m) => m !== undefined);
    out.push({ quest: q.id, step: step.id, past: step.past, ...(at !== undefined ? { day: dayOf(at) } : {}) });
  }
  return out;
}

const latestOf = (st: QuestState) => Math.max(-1, ...Object.values(st.at ?? {}));

function journalQuest(s: WorldSave, now: Now, content: JournalContent): JournalQuest {
  const st = s.quests[now.quest.id]!;
  return {
    quest: now.quest,
    step: now.step,
    targets: stepMaps(now.step, content, s).map(target),
    ...(now.step.when ? { when: now.step.when } : {}),
    ...(now.quest.giver ? { giver: now.quest.giver } : {}),
    log: logOf(now.quest, st).map(({ step, past, day }) => ({ step, past, ...(day !== undefined ? { day } : {}) })),
    latest: latestOf(st),
  };
}

/** Conditions that time, the weather or a festival will bring round by themselves, or a friendship one heart away. */
function couldHold(c: Condition | undefined, s: WorldSave): boolean {
  if (!c) return true;
  if ('all' in c) return c.all.every((x) => couldHold(x, s));
  if ('any' in c) return c.any.some((x) => couldHold(x, s));
  if ('not' in c) return !holds(c.not, s) || comesRound(c.not);
  if (comesRound(c)) return true;
  if ('hearts' in c) return (s.npcs[c.hearts]?.hearts ?? 0) >= c.min - 1;
  return holds(c, s);
}
/** Whether a condition waits for a festival or a season (weeks away, not hours). */
function seasonal(c: Condition | undefined): boolean {
  if (!c) return false;
  if ('all' in c) return c.all.some(seasonal);
  if ('any' in c) return c.any.every(seasonal);
  return 'festival' in c || 'season' in c;
}
const comesRound = (c: Condition) => 'hours' in c || 'weather' in c || 'festival' in c || 'season' in c || 'fresh' in c || 'daily' in c || ('cat' in c && c.cat === 'fed-today');

/** quest id → the scenes that start it (they move it to its first step), once per content */
const starters = new WeakMap<readonly Scene[], Map<string, Scene[]>>();

/** The scenes that start a quest. */
export function startScenes(q: Quest, scenes: readonly Scene[]): Scene[] {
  let by = starters.get(scenes);
  if (!by) {
    by = new Map();
    for (const sc of scenes)
      for (const n of sc.nodes)
        for (const a of [...(n.onEnter ?? []), ...(n.onExit ?? []), ...(n.expect ?? []).flatMap((e) => e.actions ?? []), ...(n.choose?.actions ?? []), ...(n.trace?.actions ?? [])])
          if (a.do === 'quest') {
            const key = `${a.quest}/${a.step}`;
            const list = by.get(key) ?? [];
            if (!list.includes(sc)) list.push(sc);
            by.set(key, list);
          }
    starters.set(scenes, by);
  }
  return by.get(`${q.id}/${q.steps[0]?.id}`) ?? [];
}

/** How far a neighbourhood is from where you stand: 0 for this one, else the stops of the ride. */
export function hoodDistance(s: WorldSave, hood: string | undefined): number {
  const here = hoodOf(s.place.map);
  if (!hood || !here) return 99;
  if (hood === here.id) return 0;
  const a = here.stations[0];
  const b = HOODS.find((h) => h.id === hood)?.stations[0];
  const r = a && b ? findRoute(a, b) : null;
  return r ? r.stops + r.changes * 2 : 50;
}

export const MAX_LEADS = 5;

/**
 * (Superseded in the UI by §13 Q1's explicit Journal → Side, `sidequests.ts`;
 * kept for its tests and any caller that wants only the near ones.)
 * Side quests not yet started that the player has a way into (J2): their
 * giver met, or the giver's neighbourhood walked in — and whose start could
 * hold now or soon (a time of day, the weather, a festival and one more
 * heart all come by themselves). Nearest first, then the earlier chapter;
 * five at most. The text is the quest's own `lead`, never the answer.
 */
export function leads(s: WorldSave, content: JournalContent): Lead[] {
  const visited = new Set((s.visited ?? []).map((m) => hoodOf(m)?.id).filter(Boolean));
  const out: (Lead & { dist: number; later: boolean })[] = [];
  for (const q of content.quests) {
    if (q.kind !== 'side' || s.quests[q.id]) continue;
    const starts = startScenes(q, content.scenes);
    const map = (q.giver ? npcHome(q.giver, content) : undefined) ?? starts[0]?.map;
    const hood = map ? hoodOf(map)?.id : undefined;
    const known = (q.giver && s.npcs[q.giver]) || (hood && visited.has(hood));
    if (!known) continue;
    if (starts.length && !starts.some((sc) => couldHold(sc.when, s))) continue;
    const name = q.giver ? content.npcs.find((n) => n.id === q.giver)?.name : undefined;
    const place = map ? (placeOf(map)?.zh ?? hoodOf(map)?.zh) : undefined;
    const text = q.lead ?? `${name ?? 'Someone'}${place ? ` at ${place}` : ''} seems to want a hand with something.`;
    // what could start today before what waits for a season or a festival
    const later = !!starts.length && starts.every((sc) => seasonal(sc.when) && !holds(sc.when, s));
    out.push({ quest: q, text, ...(map ? { map } : {}), ...(hood ? { hood } : {}), dist: hoodDistance(s, hood), later });
  }
  return out
    .sort((a, b) => a.dist - b.dist || Number(a.later) - Number(b.later) || a.quest.chapter - b.quest.chapter || content.quests.indexOf(a.quest) - content.quests.indexOf(b.quest))
    .slice(0, MAX_LEADS)
    .map(({ dist: _d, later: _l, ...l }) => l);
}

/** The chapter the story was in at a game minute: the main quest reached last before it. */
function chapterAt(s: WorldSave, mains: readonly Quest[], minute: number): number | undefined {
  let best: number | undefined;
  for (const q of mains) {
    const first = s.quests[q.id]?.at?.[q.steps[0]!.id];
    if (first !== undefined && first <= minute && (best === undefined || q.chapter > best)) best = q.chapter;
  }
  return best;
}

/** The story so far (J2): each chapter's steps told in the past, and the side quests finished in its time. */
export function story(s: WorldSave, content: JournalContent): StoryChapter[] {
  const mains = content.quests.filter((q) => q.kind === 'main').sort((a, b) => a.chapter - b.chapter);
  const chapters: StoryChapter[] = mains
    .filter((q) => s.quests[q.id])
    .map((q) => ({ chapter: q.chapter, quest: q.id, title: q.title, done: !!s.quests[q.id]!.done, entries: logOf(q, s.quests[q.id]!), side: [] }));
  for (const q of content.quests) {
    const st = s.quests[q.id];
    if (q.kind !== 'side' || !st?.done) continue;
    const doneAt = st.at?.[DONE_AT];
    const ch = (doneAt !== undefined ? chapterAt(s, mains, doneAt) : undefined) ?? Math.min(q.chapter, s.chapter);
    const into = [...chapters].reverse().find((c) => c.chapter <= ch) ?? chapters[0];
    if (!into) continue;
    into.side.push({ quest: q, entries: logOf(q, st), ...(doneAt !== undefined ? { day: dayOf(doneAt) } : {}) });
  }
  for (const c of chapters) {
    c.side.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
    const days = [...c.entries.map((e) => e.day), ...c.side.map((x) => x.day)].filter((d): d is number => d !== undefined);
    if (days.length) c.days = [Math.min(...days), Math.max(...days)];
  }
  return chapters;
}

/** The whole journal: the quest followed, the others under way (story first, then newest), the story so far and the leads. */
export function journal(s: WorldSave, content: JournalContent): Journal {
  const followed = trackedQuest(s, content.quests);
  const all = activeQuests(s, content.quests).map((n) => journalQuest(s, n, content));
  const active = all
    .filter((j) => j.quest.id !== followed?.quest.id)
    .sort((a, b) => Number(b.quest.kind === 'main') - Number(a.quest.kind === 'main') || b.latest - a.latest);
  return {
    ...(followed ? { tracked: all.find((j) => j.quest.id === followed.quest.id)! } : {}),
    active,
    story: story(s, content),
    leads: leads(s, content),
  };
}

/** Where the followed quest waits — the 🗺 task ring and the minimap follow it. */
export function trackedMaps(s: WorldSave, content: Omit<JournalContent, 'shops'> & { shops?: readonly Shop[] }): string[] {
  const t = trackedQuest(s, content.quests);
  return t ? stepMaps(t.step, content, s) : [];
}
