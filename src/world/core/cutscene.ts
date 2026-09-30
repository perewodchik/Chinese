/**
 * Cutscenes (§13 K1): short scripted moments on a map — the lantern
 * breaking, a spirit going home, 王阿姨 remembering — that show the learner
 * what they did, with every line on screen (they make sense with sound off).
 *
 * Pure: the types, the check of a script against its map (tiles in bounds,
 * walkable where someone walks, actors on the cast or the map), how long a
 * script runs, the lines it says (for the word budget and the voice
 * builder), and which cutscenes a change to the save starts. The engine
 * (`engine/cutscene.ts`) plays the steps; the page shows the lines.
 */

import { findPath, walkable, type Grid } from './grid';
import type { Action, Condition, DialogueNode, Facing, MapObject, Quest, Scene, SituationWord, Tile, WorldSave } from './types';
import { stepIndexOf } from './save';

/**
 * Who moves or speaks: the hero, 兔儿爷, a person by their card id, a spirit
 * (`spirit:<id>`), or a nameless extra drawn from the chars atlas
 * (`extra:<sprite>`).
 */
export type Actor = string;

export type Emote = 'happy' | 'sulky' | 'sleepy' | 'proud' | 'blush' | 'surprised';
export const EMOTES: readonly Emote[] = ['happy', 'sulky', 'sleepy', 'proud', 'blush', 'surprised'];

/** `danmaku`, `seal` and `lantern` (the 走马灯 card, `text` = the spirit ids lighting now) are drawn by the page */
export type Fx = 'sparkle' | 'petals' | 'snow' | 'lanterns-rise' | 'fireworks' | 'butterflies' | 'incense' | 'danmaku' | 'seal' | 'lantern';
export const FXS: readonly Fx[] = ['sparkle', 'petals', 'snow', 'lanterns-rise', 'fireworks', 'butterflies', 'incense', 'danmaku', 'seal', 'lantern'];

/** The synthesized sounds a cutscene can play (audio/ambient.ts). */
export type CutSound = 'chime' | 'blip' | 'wood' | 'gong' | 'bell' | 'drum';
export const CUT_SOUNDS: readonly CutSound[] = ['chime', 'blip', 'wood', 'gong', 'bell', 'drum'];

/** The music under a cutscene: as it was, softer, or silent while it runs. */
export type CutMusic = 'on' | 'soft' | 'hush';

export type CutStep =
  /** pan to a tile or follow an actor; integer zooms only */
  | { camera: Tile | Actor; ms?: number; zoom?: number }
  /** walk along tiles, or by A* to one tile */
  | { move: Actor; to: Tile | Tile[]; speed?: 'walk' | 'run' | 'slow' }
  /** float through the air by so many tiles (a spirit going home, a kite): not bound to the ground */
  | { fly: Actor; by: readonly [number, number]; ms?: number }
  | { face: Actor; dir: Facing }
  /** a thing on the map changes its picture (the lantern breaks, is lit): a props-atlas frame */
  | { prop: string; frame: string }
  | { emote: Actor; kind: Emote }
  /** a line in the dialogue box, read-only; tap to go on. 兔儿爷 speaks English only (no `zh`). */
  | { say: Actor; zh?: string; en: string; pinyin?: string; key?: boolean }
  | { wait: number }
  | { fade: 'in' | 'out'; ms?: number; colour?: string }
  | { flash: true }
  | { shake: number }
  /** a chapter card: big 楷 title, English under */
  | { title: { zh: string; en: string } }
  | { fx: Fx; at?: Tile | Actor; n?: number; text?: string[] }
  | { sound: CutSound }
  | { music: CutMusic }
  | { spawn: Actor; at: Tile; facing?: Facing }
  | { despawn: Actor }
  /** steps that run at once; the group ends when the longest does */
  | { together: CutStep[] };

export interface CastMember {
  actor: Actor;
  at: Tile;
  facing?: Facing;
}

export interface Cutscene {
  id: string;
  map: string;
  /** the chapter it belongs to (Journal → Story shows ▶ there); none for substories and replays elsewhere */
  chapter?: number;
  title?: { zh: string; en: string };
  /** black bars top and bottom (a transform, never a layout change) */
  letterbox?: boolean;
  /** a chapter finale may run 90 s; anything else 40 s */
  finale?: boolean;
  music?: CutMusic;
  /** who stands where when it starts; people already on the map may be used too */
  cast?: CastMember[];
  steps: CutStep[];
  /** actions when it ends (or is skipped): items, flags, the story moving on */
  then?: Action[];
  /** situation words of its lines (as in a scene, §5) */
  words?: SituationWord[];
  /** plays by itself on arriving on its map once this holds, once (a memory at home, §13 K2) */
  auto?: Condition;
  /** the map whose arrival starts an `auto` cutscene, when not its own (a new game's opening starts in your room, plays in the lane) */
  on?: string;
  /** a scene to start when it ends (§13 K3): the talk that follows the moment */
  talk?: string;
}

export const MAX_MS = 40_000;
export const FINALE_MS = 90_000;

/** How the engine times things — shared so the check and the runner agree. */
export const TIMING = {
  walkMs: 180,
  runMs: 100,
  slowMs: 320,
  cameraMs: 600,
  fadeMs: 400,
  titleMs: 2600,
  flashMs: 150,
  /** a line stays until tapped; the check counts the time to read it */
  sayBaseMs: 1400,
  sayPerCharMs: 160,
} as const;

// --- actors -------------------------------------------------------------------

export const isSpiritActor = (a: Actor) => a.startsWith('spirit:');
export const isExtra = (a: Actor) => a.startsWith('extra:');

/** Every actor a script names, in order of first use. */
export function actorsOf(cs: Cutscene): Actor[] {
  const out = new Set<Actor>();
  for (const c of cs.cast ?? []) out.add(c.actor);
  const walk = (s: CutStep) => {
    if ('together' in s) return s.together.forEach(walk);
    for (const k of ['move', 'fly', 'face', 'emote', 'say', 'spawn', 'despawn'] as const) {
      const v = (s as Record<string, unknown>)[k];
      if (typeof v === 'string') out.add(v);
    }
    if ('camera' in s && typeof s.camera === 'string') out.add(s.camera);
    if ('fx' in s && typeof s.at === 'string') out.add(s.at);
  };
  cs.steps.forEach(walk);
  return [...out];
}

const isTile = (v: unknown): v is Tile => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));

// --- the check against the map --------------------------------------------------

export interface CutsceneContext {
  /** the map the script runs on: its walk grid and its objects (people standing there) */
  grid: Grid;
  objects: readonly MapObject[];
  npcs: ReadonlySet<string>;
  spirits: ReadonlySet<string>;
}

/**
 * What is wrong with a script on its map: tiles out of bounds, a walk onto
 * a wall or with no way there, an actor used before it is on the cast or the
 * map (or after it left), a line with no words, a script too long.
 */
export function checkCutscene(cs: Cutscene, ctx: CutsceneContext): string[] {
  const errors: string[] = [];
  const at = (i: string) => `cutscene ${cs.id}${i}`;
  const { grid } = ctx;
  const inBounds = ([x, y]: Tile) => x >= 0 && y >= 0 && x < grid.width && y < grid.height;
  const known = (a: Actor) =>
    a === 'hero' || a === 'rabbit' || isExtra(a) || (isSpiritActor(a) ? ctx.spirits.has(a.slice(7)) : ctx.npcs.has(a));
  // where each actor stands as the script goes (hero and rabbit are always there)
  const where = new Map<Actor, Tile | null>();
  for (const o of ctx.objects) if (o.kind === 'npc') where.set(o.npc, o.tile);
  (cs.cast ?? []).forEach((c, i) => {
    if (!known(c.actor)) errors.push(at(`.cast[${i}]: unknown actor "${c.actor}"`));
    if (!inBounds(c.at)) errors.push(at(`.cast[${i}]: ${c.at.join(',')} is off the map`));
    where.set(c.actor, c.at);
  });
  const present = (a: Actor) => a === 'hero' || a === 'rabbit' || (where.get(a) ?? null) !== null;
  const need = (a: Actor, p: string) => {
    if (!known(a)) errors.push(at(`${p}: unknown actor "${a}"`));
    else if (!present(a)) errors.push(at(`${p}: "${a}" is not on the map (put them in the cast, or spawn them first)`));
  };
  const walk = (s: CutStep, p: string) => {
    if ('together' in s) return s.together.forEach((x, j) => walk(x, `${p}.together[${j}]`));
    if ('move' in s) {
      need(s.move, p);
      const path = isTile(s.to) ? [s.to] : (s.to as Tile[]);
      if (!path.length) errors.push(at(`${p}: a move needs somewhere to go`));
      let from = where.get(s.move) ?? null;
      for (const t of path) {
        if (!inBounds(t)) errors.push(at(`${p}: ${t.join(',')} is off the map`));
        else if (!walkable(grid, t[0], t[1])) errors.push(at(`${p}: ${t.join(',')} is not walkable`));
        else if (from && isTile(s.to) && !findPath(grid, from, [t])) errors.push(at(`${p}: no way from ${from.join(',')} to ${t.join(',')}`));
        from = t;
      }
      if (from && s.move !== 'hero' && s.move !== 'rabbit') where.set(s.move, from);
      return;
    }
    if ('fly' in s) return need(s.fly, p);
    if ('face' in s) return need(s.face, p);
    if ('prop' in s) {
      if (!ctx.objects.some((o) => o.kind === 'prop' && o.id === s.prop)) errors.push(at(`${p}: no prop "${s.prop}" on the map`));
      return;
    }
    if ('emote' in s) return need(s.emote, p);
    if ('say' in s) {
      if (s.say !== 'rabbit' && s.say !== 'hero' && !known(s.say)) errors.push(at(`${p}: unknown speaker "${s.say}"`));
      if (s.say === 'rabbit' && s.zh) errors.push(at(`${p}: 兔儿爷 speaks English — no zh`));
      if (s.say !== 'rabbit' && !s.zh) errors.push(at(`${p}: a line needs its Chinese`));
      return;
    }
    if ('spawn' in s) {
      if (!known(s.spawn)) errors.push(at(`${p}: unknown actor "${s.spawn}"`));
      if (!inBounds(s.at)) errors.push(at(`${p}: ${s.at.join(',')} is off the map`));
      where.set(s.spawn, s.at);
      return;
    }
    if ('despawn' in s) {
      need(s.despawn, p);
      where.set(s.despawn, null);
      return;
    }
    if ('camera' in s) {
      if (isTile(s.camera)) {
        if (!inBounds(s.camera)) errors.push(at(`${p}: ${s.camera.join(',')} is off the map`));
      } else need(s.camera, p);
      if (s.zoom !== undefined && (!Number.isInteger(s.zoom) || s.zoom < 1 || s.zoom > 4)) errors.push(at(`${p}: zoom is a whole number 1–4`));
      return;
    }
    if ('fx' in s && s.at !== undefined) {
      if (isTile(s.at)) {
        if (!inBounds(s.at)) errors.push(at(`${p}: ${s.at.join(',')} is off the map`));
      } else need(s.at, p);
    }
  };
  cs.steps.forEach((s, i) => walk(s, `.steps[${i}]`));
  const ms = durationMs(cs, ctx.grid);
  const max = cs.finale ? FINALE_MS : MAX_MS;
  if (ms > max) errors.push(at(`: runs about ${Math.round(ms / 1000)} s — at most ${max / 1000} s${cs.finale ? '' : ' (a chapter finale may run 90)'}`));
  if (!cs.steps.length) errors.push(at(': no steps'));
  return errors;
}

// --- timing --------------------------------------------------------------------

/** Reading time of one line: the Chinese and the English under it. */
export function sayMs(zh: string | undefined, en: string): number {
  const chars = zh ? [...zh].length : Math.ceil(en.length / 4);
  return TIMING.sayBaseMs + chars * TIMING.sayPerCharMs;
}

/**
 * About how long a script runs (lines count as the time to read them).
 * A walk to one tile is timed by its path when a grid is given, else by the
 * straight distance.
 */
export function durationMs(cs: Cutscene, grid?: Grid): number {
  const pos = new Map<Actor, Tile>();
  for (const c of cs.cast ?? []) pos.set(c.actor, c.at);
  const one = (s: CutStep): number => {
    if ('together' in s) return Math.max(0, ...s.together.map(one));
    if ('move' in s) {
      const per = s.speed === 'run' ? TIMING.runMs : s.speed === 'slow' ? TIMING.slowMs : TIMING.walkMs;
      const from = pos.get(s.move);
      let tiles = 0;
      if (isTile(s.to)) {
        const path = grid && from ? findPath(grid, from, [s.to]) : null;
        tiles = path ? path.length : from ? Math.abs(s.to[0] - from[0]) + Math.abs(s.to[1] - from[1]) : 4;
        pos.set(s.move, s.to);
      } else {
        let cur = from;
        for (const t of s.to as Tile[]) {
          tiles += cur ? Math.abs(t[0] - cur[0]) + Math.abs(t[1] - cur[1]) : 1;
          cur = t;
        }
        if (cur) pos.set(s.move, cur);
      }
      return tiles * per;
    }
    if ('spawn' in s) {
      pos.set(s.spawn, s.at);
      return 0;
    }
    if ('fly' in s) return s.ms ?? 1200;
    if ('say' in s) return sayMs(s.zh, s.en);
    if ('wait' in s) return s.wait;
    if ('camera' in s) return s.ms ?? TIMING.cameraMs;
    if ('fade' in s) return s.ms ?? TIMING.fadeMs;
    if ('title' in s) return TIMING.titleMs;
    if ('flash' in s) return TIMING.flashMs;
    if ('shake' in s) return s.shake;
    return 0;
  };
  return cs.steps.reduce((n, s) => n + one(s), 0);
}

// --- lines -----------------------------------------------------------------------

export interface CutLine {
  /** `steps[3]` or `steps[3].together[1]` */
  path: string;
  actor: Actor;
  zh?: string;
  en: string;
  pinyin?: string;
  key?: boolean;
}

/** Every line a script says, in order. */
export function cutsceneLines(cs: Cutscene): CutLine[] {
  const out: CutLine[] = [];
  const walk = (s: CutStep, path: string) => {
    if ('together' in s) return s.together.forEach((x, j) => walk(x, `${path}.together[${j}]`));
    if ('say' in s) out.push({ path, actor: s.say, en: s.en, ...(s.zh ? { zh: s.zh } : {}), ...(s.pinyin ? { pinyin: s.pinyin } : {}), ...(s.key ? { key: true } : {}) });
  };
  cs.steps.forEach((s, i) => walk(s, `steps[${i}]`));
  return out;
}

/** The speaker id a line has in a scene: people by their card id, spirits by theirs, 兔儿爷 as the companion. */
export function speakerOf(a: Actor): string {
  if (a === 'rabbit') return 'companion';
  if (isSpiritActor(a)) return a.slice(7);
  return a;
}

/**
 * The script's Chinese lines as a scene, so the word budget (§5) and the
 * voice builder read them like any talk. 兔儿爷's English lines are left
 * out. Node ids are `c<n>`.
 */
export function cutsceneScene(cs: Cutscene): Scene {
  const lines = cutsceneLines(cs).filter((l) => l.zh);
  const nodes: DialogueNode[] = lines.map((l, i) => ({
    id: `c${i}`,
    speaker: speakerOf(l.actor),
    say: l.zh!,
    translate: l.en,
    ...(l.pinyin ? { pinyin: l.pinyin } : {}),
    ...(l.key ? { key: true } : {}),
    ...(i + 1 < lines.length ? { next: `c${i + 1}` } : {}),
  }));
  return {
    id: `cutscene-${cs.id}`,
    map: cs.map,
    trigger: 'auto',
    start: 'c0',
    nodes: nodes.length ? nodes : [{ id: 'c0', say: '……', translate: '…' }],
    ...(cs.words ? { words: cs.words } : {}),
  };
}

// --- what starts one ---------------------------------------------------------------

/**
 * The cutscenes a change to the save starts: the `onDone` of every quest
 * step finished between `before` and `after`, in quest order, not yet seen.
 */
export function cutscenesDue(before: WorldSave, after: WorldSave, quests: readonly Quest[]): string[] {
  const out: string[] = [];
  const seen = new Set(after.cutscenes);
  for (const q of quests) {
    const a = before.quests[q.id];
    const b = after.quests[q.id];
    if (!b) continue;
    const from = a ? (a.done ? q.steps.length : stepIndexOf(q, a)) : 0;
    const to = b.done ? q.steps.length : stepIndexOf(q, b);
    if (!a && !b.done && to === 0) continue;
    for (let i = from; i < to; i++) {
      const id = q.steps[i]?.onDone;
      if (id && !seen.has(id) && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

/** The actions a talk's actions start as cutscenes (they play when the talk is over). */
export function cutsceneActions(actions: readonly { do: string }[]): string[] {
  return actions.flatMap((a) => (a.do === 'cutscene' ? [(a as { do: 'cutscene'; id: string }).id] : []));
}

/**
 * The references a cutscene makes outside itself: its `talk` scene, its
 * `on` map, scenes naming it as `before`, quest steps naming it as
 * `onDone`, actions naming it. Unknown ids are errors.
 */
export function checkCutsceneLinks(all: readonly Cutscene[], scenes: readonly Scene[], quests: readonly Quest[], maps: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const ids = new Set(all.map((c) => c.id));
  const sceneIds = new Set(scenes.map((s) => s.id));
  for (const c of all) {
    if (c.talk && !sceneIds.has(c.talk)) errors.push(`cutscene ${c.id}: talk "${c.talk}" is no scene`);
    if (c.on && !maps.has(c.on)) errors.push(`cutscene ${c.id}: on "${c.on}" is no map`);
    if (c.on && !c.auto) errors.push(`cutscene ${c.id}: "on" only means something with "auto"`);
  }
  for (const s of scenes) if (s.before && !ids.has(s.before)) errors.push(`scene ${s.id}: before "${s.before}" is no cutscene`);
  for (const q of quests) for (const st of q.steps) if (st.onDone && !ids.has(st.onDone) && !st.onDone.startsWith('spirit-return-')) errors.push(`quest ${q.id}/${st.id}: onDone "${st.onDone}" is no cutscene`);
  const said = [...JSON.stringify(scenes).matchAll(/"do":"cutscene","id":"([^"]+)"/g), ...JSON.stringify(all).matchAll(/"do":"cutscene","id":"([^"]+)"/g)].map((m) => m[1]!);
  for (const id of said) if (!ids.has(id)) errors.push(`a {"do":"cutscene"} names "${id}", which is no cutscene`);
  return [...new Set(errors)];
}

/** The cutscenes of a chapter already seen, in the content's order — Journal → Story's ▶. */
export function seenInChapter(s: WorldSave, all: readonly Cutscene[], chapter: number): Cutscene[] {
  const seen = new Set(s.cutscenes);
  return all.filter((c) => c.chapter === chapter && seen.has(c.id));
}
