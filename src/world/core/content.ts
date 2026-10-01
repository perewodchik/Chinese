/**
 * The zod schemas for every content file, and the loader that checks a
 * district's files and says, file and path, what is wrong.
 *
 * Each schema is typed against its interface in `types.ts`, so the two
 * cannot drift apart without the build failing.
 */

import { shopScene, type Shop } from './shop';
import { IDLE_ACTIONS, type IdleAction } from '../art/anims';
import { CUT_SOUNDS, EMOTES, FXS, type Cutscene, type CutStep } from './cutscene';
import { z } from 'zod';
import type {
  Action,
  Condition,
  DialogueNode,
  District,
  DistrictContent,
  Expect,
  Idiom,
  Item,
  MapObject,
  NpcCard,
  Quest,
  Scene,
  Spirit,
  Stamp,
  Tile,
} from './types';

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'ids are lower-case latin, digits, - and _');
const hanzi = z.string().min(1);
const text = z.string().min(1);
const tile: z.ZodType<Tile> = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
const facing = z.enum(['up', 'down', 'left', 'right']);
const hour = z.number().int().min(0).max(24);

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(conditionSchema) }),
    z.strictObject({ any: z.array(conditionSchema) }),
    z.strictObject({ not: conditionSchema }),
    z.strictObject({ flag: text }),
    z.strictObject({ item: id, count: z.number().int().min(1).optional() }),
    z.strictObject({ money: z.number() }),
    z.strictObject({ hours: z.tuple([hour, hour]) }),
    z.strictObject({ chapter: z.number().int().min(0) }),
    z.strictObject({ quest: id, step: id.optional(), done: z.boolean().optional() }),
    z.strictObject({ scene: id }),
    z.strictObject({ spirit: id }),
    z.strictObject({ idiom: text }),
    z.strictObject({ station: id }),
    z.strictObject({ met: id }),
    z.strictObject({ hearts: id, min: z.number().int().min(0).max(5) }),
    z.strictObject({ remembers: id, note: text }),
    z.strictObject({ weather: z.enum(['clear', 'cloudy', 'rain', 'snow', 'wind']) }),
    z.strictObject({ festival: z.enum(['chunjie', 'yuanxiao', 'duanwu', 'qixi', 'zhongqiu', 'guoqing']) }),
    z.strictObject({ season: z.enum(['spring', 'summer', 'autumn', 'winter']) }),
    z.strictObject({ cat: z.enum(['fed-today', 'trusts', 'named']) }),
    z.strictObject({ photo: text }),
    z.strictObject({ visited: id }),
    z.strictObject({ read: text }),
    z.strictObject({ fresh: id }),
    z.strictObject({ daily: id }),
    z.strictObject({ bike: z.enum(['owned', 'riding', 'flat', 'none']) }),
  ]),
);

export const actionSchema: z.ZodType<Action> = z.discriminatedUnion('do', [
  z.strictObject({ do: z.literal('flag'), flag: text, value: z.boolean().optional() }),
  z.strictObject({ do: z.literal('give'), item: id, count: z.number().int().min(1).optional() }),
  z.strictObject({ do: z.literal('take'), item: id, count: z.number().int().min(1).optional() }),
  z.strictObject({ do: z.literal('money'), amount: z.number() }),
  z.strictObject({ do: z.literal('card'), amount: z.number() }),
  z.strictObject({ do: z.literal('quest'), quest: id, step: id }),
  z.strictObject({ do: z.literal('quest_done'), quest: id }),
  z.strictObject({ do: z.literal('stamp'), stamp: id }),
  z.strictObject({ do: z.literal('spirit'), spirit: id }),
  z.strictObject({ do: z.literal('idiom'), idiom: text }),
  z.strictObject({ do: z.literal('station'), station: id }),
  z.strictObject({ do: z.literal('district'), district: id }),
  z.strictObject({ do: z.literal('chapter'), chapter: z.number().int().min(1) }),
  z.strictObject({ do: z.literal('teleport'), map: id, tile, facing: facing.optional() }),
  z.strictObject({ do: z.literal('game'), game: id }),
  z.strictObject({ do: z.literal('sleep'), until: z.number().int().min(1).optional() }),
  z.strictObject({ do: z.literal('wait'), until: hour }),
  z.strictObject({ do: z.literal('hearts'), npc: id, delta: z.number().int() }),
  z.strictObject({ do: z.literal('place'), spot: id, item: id }),
  z.strictObject({ do: z.literal('feed_cat') }),
  z.strictObject({ do: z.literal('daily'), id }),
  z.strictObject({ do: z.literal('eat'), item: id }),
  z.strictObject({ do: z.literal('combine'), a: id, b: id, makes: id }),
  z.strictObject({ do: z.literal('buy'), item: id, count: z.number().int().positive().optional(), price: z.number().min(0) }),
  z.strictObject({ do: z.literal('earn'), amount: z.number().positive() }),
  z.strictObject({ do: z.literal('pin'), riddle: text }),
  z.strictObject({ do: z.literal('solve'), riddle: text }),
  z.strictObject({ do: z.literal('remember'), npc: id, note: text }),
  z.strictObject({ do: z.literal('cutscene'), id }),
  z.strictObject({ do: z.literal('book'), id }),
  z.strictObject({ do: z.literal('bike'), model: id, colour: id }),
  z.strictObject({ do: z.literal('bike_part'), part: id }),
  z.strictObject({ do: z.literal('bike_fix') }),
  z.strictObject({ do: z.literal('bike_bell') }),
  z.strictObject({ do: z.literal('bike_home') }),
]);

const actionKind = z.enum([
  'flag', 'give', 'take', 'money', 'card', 'quest', 'quest_done', 'stamp', 'spirit', 'idiom',
  'station', 'district', 'chapter', 'teleport', 'game', 'sleep', 'wait', 'hearts', 'place', 'feed_cat', 'daily', 'eat', 'combine', 'buy', 'earn', 'pin', 'solve', 'remember',
]);

export const districtSchema: z.ZodType<District> = z.strictObject({
  id,
  name: hanzi,
  en: text,
  chapter: z.number().int().min(1),
  maps: z.array(id).min(1),
  stations: z.array(id),
  names: z.array(hanzi),
  ambience: z.string().optional(),
});

export const mapObjectSchema: z.ZodType<MapObject> = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('door'),
    id,
    tile,
    to: z.strictObject({ map: id, tile, facing: facing.optional() }),
    when: conditionSchema.optional(),
    locked: z.string().optional(),
    oneWay: z.boolean().optional(),
  }),
  z.strictObject({
    kind: z.literal('edge'),
    id,
    side: facing,
    from: z.number().int().min(0),
    to: z.number().int().min(0),
    target: z.strictObject({ map: id, offset: z.number().int() }),
  }),
  z.strictObject({ kind: z.literal('sign'), id, tile, text: hanzi, en: z.string().optional() }),
  z.strictObject({ kind: z.literal('npc'), id, npc: id, tile, facing: facing.optional(), when: conditionSchema.optional() }),
  z.strictObject({ kind: z.literal('light'), id, tile, color: z.string().optional(), radius: z.number().positive().optional() }),
  z.strictObject({
    kind: z.literal('zone'),
    id,
    tile,
    size: z.tuple([z.number().int().min(1), z.number().int().min(1)]).optional(),
    scene: id,
    when: conditionSchema.optional(),
  }),
  z.strictObject({ kind: z.literal('spirit'), id, tile, spirit: id, when: conditionSchema.optional() }),
  z.strictObject({ kind: z.literal('bike'), id, tile }),
  z.strictObject({
    kind: z.literal('prop'),
    id,
    tile,
    frame: text,
    blocks: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
    light: z.string().optional(),
    night: z.string().optional(),
    when: conditionSchema.optional(),
  }),
]);

export const npcSchema: z.ZodType<NpcCard> = z.strictObject({
  id,
  name: hanzi,
  role: text,
  look: z.strictObject({ sprite: id, palette: z.string().optional() }),
  voice: z.string().optional(),
  character: text,
  knows: z.array(text),
  wants: z.array(text),
  actions: z.array(actionKind),
  routine: z.array(
    z.strictObject({ hours: z.tuple([hour, hour]), map: id, tile, facing: facing.optional() }),
  ),
  explains: z.record(z.string(), text),
  misses: z.array(hanzi).optional(),
  likes: z.array(id).optional(),
  dislikes: z.array(id).optional(),
  idle: z.enum(IDLE_ACTIONS as unknown as [IdleAction, ...IdleAction[]]).optional(),
});

const chooseSchema = z.strictObject({
  options: z.array(z.strictObject({ id, label: text, right: z.boolean().optional() })).min(2),
  go: id.optional(),
  actions: z.array(actionSchema).optional(),
});
const traceSchema = z.strictObject({ chars: text, go: id.optional(), actions: z.array(actionSchema).optional() });

const expectSchema: z.ZodType<Expect> = z.strictObject({
  intent: id,
  match: z.array(z.array(text).min(1)).min(1),
  go: id.optional(),
  capture: z.enum(['name', 'cat']).optional(),
  actions: z.array(actionSchema).optional(),
  end: z.boolean().optional(),
});

const nodeSchema: z.ZodType<DialogueNode> = z.strictObject({
  id,
  speaker: z.string().optional(),
  say: hanzi,
  pinyin: z.string().optional(),
  simpler: z.string().optional(),
  key: z.boolean().optional(),
  listen: z.boolean().optional(),
  expect: z.array(expectSchema).optional(),
  choose: chooseSchema.optional(),
  order: z.strictObject({ shop: id, go: id.optional() }).optional(),
  sell: z.strictObject({ share: z.number().min(0).max(1) }).optional(),
  bargain: z.strictObject({ item: id.optional(), open: z.number().positive(), limit: z.number().positive(), sell: z.literal(true).optional(), go: id.optional() }).optional(),
  rack: z.strictObject({ rack: id }).optional(),
  bikes: z.strictObject({ shop: id }).optional(),
  trace: traceSchema.optional(),
  next: id.optional(),
  hint: z.strictObject({ word: text, frame: text, full: text }).optional(),
  translate: text,
  why: z.string().optional(),
  onEnter: z.array(actionSchema).optional(),
  onExit: z.array(actionSchema).optional(),
});

export const sceneSchema: z.ZodType<Scene> = z.strictObject({
  id,
  map: id,
  npc: id.optional(),
  object: id.optional(),
  use: id.optional(),
  trigger: z.enum(['talk', 'zone', 'look', 'auto']),
  when: conditionSchema.optional(),
  once: z.boolean().optional(),
  start: id,
  nodes: z.array(nodeSchema).min(1),
  words: z.array(z.strictObject({ w: hanzi, explain: hanzi, en: text })).optional(),
  stamp: id.optional(),
  priority: z.number().int().optional(),
  before: id.optional(),
});

export const questSchema: z.ZodType<Quest> = z.strictObject({
  id,
  title: text,
  chapter: z.number().int().min(1),
  kind: z.enum(['main', 'side']),
  giver: id.optional(),
  blurb: text.optional(),
  lead: text.optional(),
  steps: z
    .array(z.strictObject({ id, now: text, past: text, where: id.optional(), when: text.optional(), done: conditionSchema.optional(), onDone: id.optional() }))
    .min(1),
  reward: z.array(actionSchema).optional(),
});

export const spiritSchema: z.ZodType<Spirit> = z.strictObject({
  id,
  hanzi,
  pinyin: text,
  en: text,
  source: z.enum(['山海经', 'folk']),
  image: z.string().optional(),
  credit: z.string().optional(),
  legend: z.strictObject({ zh: hanzi, en: text }),
  befriend: z.strictObject({ kind: z.enum(['riddle', 'request', 'name']), text: hanzi, en: text }),
  district: id,
});

export const idiomSchema: z.ZodType<Idiom> = z.strictObject({
  id: hanzi,
  pinyin: text,
  parts: z.array(z.strictObject({ c: hanzi, gloss: text })).min(1),
  meaning: text,
  story: z.strictObject({ zh: hanzi, en: text }),
  tier: z.enum(['basic', 'story']),
  line: text.optional(),
});

export const stampSchema: z.ZodType<Stamp> = z.strictObject({
  id,
  name: hanzi,
  en: text,
  place: text,
  design: text,
  landmark: z.boolean().optional(),
});

export const itemSchema: z.ZodType<Item> = z.strictObject({
  id,
  name: hanzi,
  en: text,
  icon: z.string().optional(),
  gift: z.boolean().optional(),
  kind: z.enum(['food', 'drink', 'gift', 'tool', 'decor', 'toy', 'key']).optional(),
  price: z.number().min(0).optional(),
  verbs: z.array(z.enum(['eat', 'drink', 'give', 'use', 'put', 'look', 'open', 'play'])).optional(),
  combine: z.array(z.strictObject({ with: id, makes: id })).optional(),
});

/** whole yuan or x.5 — 五毛 is the only small unit */
const price = z.number().positive().refine((p) => Number.isInteger(p * 2), 'a price is whole yuan or x.5');
export const shopSchema: z.ZodType<Shop> = z.strictObject({
  id,
  npc: id,
  map: id,
  name: hanzi,
  pay: z.enum(['scan', 'code']).optional(),
  hours: z.tuple([z.number().int().min(0).max(24), z.number().int().min(0).max(24)]).optional(),
  when: conditionSchema.optional(),
  stock: z.array(z.strictObject({ item: id, price, measure: z.string().optional(), when: conditionSchema.optional() })).min(1),
  priority: z.number().int().optional(),
  mischarge: z.boolean().optional(),
});

// --- cutscenes (§13 K1) ---
const actor = z.string().regex(/^(hero|rabbit|[a-z0-9][a-z0-9_-]*|spirit:[a-z0-9_-]+|extra:[a-z0-9_/-]+)$/, 'an actor is hero, rabbit, a person id, spirit:<id> or extra:<sprite>');
const tileOrActor = z.union([tile, actor]);
export const cutStepSchema: z.ZodType<CutStep> = z.lazy(() =>
  z.union([
    z.strictObject({ camera: tileOrActor, ms: z.number().int().min(0).optional(), zoom: z.number().int().min(1).max(4).optional() }),
    z.strictObject({ move: actor, to: z.union([tile, z.array(tile).min(1)]), speed: z.enum(['walk', 'run', 'slow']).optional() }),
    z.strictObject({ fly: actor, by: z.tuple([z.number().int(), z.number().int()]), ms: z.number().int().min(0).optional() }),
    z.strictObject({ face: actor, dir: facing }),
    z.strictObject({ prop: id, frame: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'a frame is <thing>/<look>') }),
    z.strictObject({ emote: actor, kind: z.enum(EMOTES as [string, ...string[]]) }),
    z.strictObject({ say: actor, zh: hanzi.optional(), en: text, pinyin: text.optional(), key: z.boolean().optional() }),
    z.strictObject({ wait: z.number().int().min(0).max(10_000) }),
    z.strictObject({ fade: z.enum(['in', 'out']), ms: z.number().int().min(0).optional(), colour: z.string().optional() }),
    z.strictObject({ flash: z.literal(true) }),
    z.strictObject({ shake: z.number().int().min(0).max(3000) }),
    z.strictObject({ title: z.strictObject({ zh: hanzi, en: text }) }),
    z.strictObject({ fx: z.enum(FXS as [string, ...string[]]), at: tileOrActor.optional(), n: z.number().int().min(1).max(200).optional(), text: z.array(text).optional() }),
    z.strictObject({ sound: z.enum(CUT_SOUNDS as [string, ...string[]]) }),
    z.strictObject({ music: z.enum(['on', 'soft', 'hush']) }),
    z.strictObject({ spawn: actor, at: tile, facing: facing.optional() }),
    z.strictObject({ despawn: actor }),
    z.strictObject({ together: z.array(cutStepSchema).min(1) }),
  ]) as z.ZodType<CutStep>,
);

export const cutsceneSchema: z.ZodType<Cutscene> = z.strictObject({
  id,
  map: id,
  chapter: z.number().int().min(1).optional(),
  title: z.strictObject({ zh: hanzi, en: text }).optional(),
  letterbox: z.boolean().optional(),
  finale: z.boolean().optional(),
  music: z.enum(['on', 'soft', 'hush']).optional(),
  cast: z.array(z.strictObject({ actor, at: tile, facing: facing.optional() })).optional(),
  steps: z.array(cutStepSchema).min(1),
  then: z.array(actionSchema).optional(),
  words: z.array(z.strictObject({ w: hanzi, explain: hanzi, en: text })).optional(),
  auto: conditionSchema.optional(),
  on: id.optional(),
  talk: id.optional(),
});

/** RW2: a place card and its facts (core/cards.ts) */
export const placeCardSchema = z.strictObject({
  id,
  map: id,
  zh: hanzi,
  pinyin: text,
  en: text,
  words: z.array(z.strictObject({ w: hanzi, en: text })).optional(),
  souvenir: z.strictObject({ frame: text, zh: hanzi, en: text }).optional(),
  facts: z
    .array(z.strictObject({ id, zh: hanzi, en: text, fact: text, open: conditionSchema, how: text }))
    .min(2),
});

/** The files of one district folder and the schema each is checked with. */
export const DISTRICT_FILES = {
  district: districtSchema,
  npcs: z.array(npcSchema),
  scenes: z.array(sceneSchema),
  quests: z.array(questSchema),
  spirits: z.array(spiritSchema),
  idioms: z.array(idiomSchema),
  stamps: z.array(stampSchema),
  items: z.array(itemSchema),
  shops: z.array(shopSchema),
  cutscenes: z.array(cutsceneSchema),
  cards: z.array(placeCardSchema),
} as const;

export type DistrictFiles = { [K in keyof typeof DISTRICT_FILES]?: unknown };

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** `scenes[2].nodes[0].expect[1].match` — the path a person can find in the file. */
export function formatPath(file: string, path: readonly PropertyKey[]): string {
  let out = file;
  for (const p of path) out += typeof p === 'number' ? `[${p}]` : `.${String(p)}`;
  return out;
}

/**
 * Checks a district's files one by one against their schemas, then the
 * references between them. Missing files other than `district` count as
 * empty. Every error names the file and the path inside it.
 */
export function loadDistrict(files: DistrictFiles): Checked<DistrictContent> {
  const parsed = parseDistrict(files);
  if (!parsed.ok) return parsed;
  const refErrors = checkReferences(parsed.value);
  return refErrors.length ? { ok: false, errors: refErrors } : parsed;
}

/** The schemas only — for checking references across several districts afterwards. */
export function parseDistrict(files: DistrictFiles): Checked<DistrictContent> {
  const errors: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(DISTRICT_FILES)) {
    const raw = (files as Record<string, unknown>)[name];
    if (raw === undefined) {
      if (name === 'district') errors.push('district: the file is missing');
      else out[name] = [];
      continue;
    }
    const parsed = (schema as z.ZodType).safeParse(raw);
    if (parsed.success) out[name] = parsed.data;
    else for (const issue of parsed.error.issues) errors.push(`${formatPath(name, issue.path)}: ${issue.message}`);
  }
  if (errors.length) return { ok: false, errors };
  // each shop talks through a generated scene (Y1), named from the district's own items; listed first, so a
  // seller's shop wins a tie with their small talk (a greeting by name has the same priority)
  const c = out as unknown as DistrictContent;
  const items = new Map(c.items.map((i) => [i.id, i]));
  return { ok: true, value: { ...c, scenes: [...(c.shops ?? []).map((sh) => shopScene(sh, items)), ...c.scenes] } };
}

/**
 * What the schemas cannot see: ids that must be unique, and ids that must
 * point at something. `known` adds ids from other districts (NPCs who walk
 * over, stamps shared across the city).
 */
export function checkReferences(
  c: DistrictContent,
  known: { npcs?: Iterable<string>; stamps?: Iterable<string>; quests?: Iterable<string>; spirits?: Iterable<string>; idioms?: Iterable<string>; items?: Iterable<string> } = {},
): string[] {
  const errors: string[] = [];
  const idsOf = (list: { id: string }[], file: string, extra?: Iterable<string>) => {
    const own = new Set<string>();
    list.forEach((x, i) => {
      if (own.has(x.id)) errors.push(`${file}[${i}].id: "${x.id}" is used twice`);
      own.add(x.id);
    });
    return new Set([...own, ...(extra ?? [])]);
  };
  const npcs = idsOf(c.npcs, 'npcs', known.npcs);
  const stamps = idsOf(c.stamps, 'stamps', known.stamps);
  const quests = idsOf(c.quests, 'quests', known.quests);
  const spirits = idsOf(c.spirits, 'spirits', known.spirits);
  const idioms = idsOf(c.idioms, 'idioms', known.idioms);
  const items = idsOf(c.items, 'items', known.items);
  idsOf(c.scenes, 'scenes');

  const questSteps = new Map(c.quests.map((q) => [q.id, new Set(q.steps.map((s) => s.id))]));
  const checkAction = (a: Action, where: string) => {
    const miss = (what: string, v: string) => errors.push(`${where}: unknown ${what} "${v}"`);
    switch (a.do) {
      case 'give':
      case 'take':
      case 'buy':
        if (!items.has(a.item)) miss('item', a.item);
        break;
      case 'stamp':
        if (!stamps.has(a.stamp)) miss('stamp', a.stamp);
        break;
      case 'spirit':
        if (!spirits.has(a.spirit)) miss('spirit', a.spirit);
        break;
      case 'idiom':
        if (!idioms.has(a.idiom)) miss('idiom', a.idiom);
        break;
      case 'quest': {
        const steps = questSteps.get(a.quest);
        if (!quests.has(a.quest)) miss('quest', a.quest);
        else if (steps && !steps.has(a.step)) miss(`step of ${a.quest}`, a.step);
        break;
      }
      case 'quest_done':
        if (!quests.has(a.quest)) miss('quest', a.quest);
        break;
      case 'remember':
        if (!npcs.has(a.npc)) miss('npc', a.npc);
        break;
      default:
    }
  };

  c.scenes.forEach((s, si) => {
    const at = `scenes[${si}]`;
    if (s.npc && !npcs.has(s.npc)) errors.push(`${at}.npc: unknown npc "${s.npc}"`);
    if (s.stamp && !stamps.has(s.stamp)) errors.push(`${at}.stamp: unknown stamp "${s.stamp}"`);
    const nodes = new Set<string>();
    s.nodes.forEach((n, ni) => {
      if (nodes.has(n.id)) errors.push(`${at}.nodes[${ni}].id: "${n.id}" is used twice`);
      nodes.add(n.id);
    });
    if (!nodes.has(s.start)) errors.push(`${at}.start: no node "${s.start}"`);
    let keys = 0;
    s.nodes.forEach((n, ni) => {
      const nat = `${at}.nodes[${ni}]`;
      if (n.key) keys++;
      if (n.next && !nodes.has(n.next)) errors.push(`${nat}.next: no node "${n.next}"`);
      if (n.next && n.expect?.length) errors.push(`${nat}: a node has either next or expect, not both`);
      // a line may be said by the hero, by 兔儿爷, by a spirit, or by a person with a card
      if (n.speaker && n.speaker !== 'hero' && n.speaker !== 'companion' && n.speaker !== 'speaker-box' && !npcs.has(n.speaker) && !spirits.has(n.speaker)) errors.push(`${nat}.speaker: unknown speaker "${n.speaker}"`);
      n.expect?.forEach((e, ei) => {
        if (e.go && !nodes.has(e.go)) errors.push(`${nat}.expect[${ei}].go: no node "${e.go}"`);
        e.actions?.forEach((a, ai) => checkAction(a, `${nat}.expect[${ei}].actions[${ai}]`));
      });
      // a "do what they say" step needs exactly one right answer, and nothing else to wait for (X8)
      const asks = [n.expect?.length, n.choose, n.trace, n.next].filter(Boolean).length;
      if (asks > 1) errors.push(`${nat}: a node waits for one thing — expect, choose, trace or next`);
      if (n.choose) {
        if (n.choose.options.filter((o) => o.right).length !== 1) errors.push(`${nat}.choose: needs exactly one right option`);
        if (n.choose.go && !nodes.has(n.choose.go)) errors.push(`${nat}.choose.go: no node "${n.choose.go}"`);
        n.choose.actions?.forEach((a, ai) => checkAction(a, `${nat}.choose.actions[${ai}]`));
      }
      if (n.bargain) {
        const b = n.bargain;
        if (b.go && !nodes.has(b.go)) errors.push(`${nat}.bargain.go: no node "${b.go}"`);
        if (b.item && !items.has(b.item)) errors.push(`${nat}.bargain.item: unknown item "${b.item}"`);
        if (b.sell ? b.limit < b.open : b.limit > b.open) errors.push(`${nat}.bargain: the limit is past the first price`);
        if (n.expect?.length || n.next || n.choose || n.trace) errors.push(`${nat}: a bargain line waits for nothing else`);
      }
      if (n.trace) {
        if (n.trace.go && !nodes.has(n.trace.go)) errors.push(`${nat}.trace.go: no node "${n.trace.go}"`);
        n.trace.actions?.forEach((a, ai) => checkAction(a, `${nat}.trace.actions[${ai}]`));
      }
      n.onEnter?.forEach((a, ai) => checkAction(a, `${nat}.onEnter[${ai}]`));
      n.onExit?.forEach((a, ai) => checkAction(a, `${nat}.onExit[${ai}]`));
    });
    if (keys > 1) errors.push(`${at}: ${keys} key lines — at most one per scene`);
  });
  c.quests.forEach((q, qi) => q.reward?.forEach((a, ai) => checkAction(a, `quests[${qi}].reward[${ai}]`)));
  // cutscenes (§13 K1): unique ids, their actions; the map and the actors are checked against the built maps by world:check.
  // A cutscene may play on any district's map (§13 S: a chapter's memory at 王阿姨's lantern lives in the chapter's own folder).
  idsOf(c.cutscenes ?? [], 'cutscenes');
  (c.cutscenes ?? []).forEach((cs, ci) => {
    cs.then?.forEach((a, ai) => checkAction(a, `cutscenes[${ci}].then[${ai}]`));
  });
  // shops (Y1): a seller who exists, and only the district's own things (so the menu has their names)
  const own = new Set(c.items.map((i) => i.id));
  (c.shops ?? []).forEach((sh, si) => {
    if (!npcs.has(sh.npc)) errors.push(`shops[${si}].npc: unknown NPC "${sh.npc}"`);
    sh.stock.forEach((x, xi) => {
      if (!own.has(x.item)) errors.push(`shops[${si}].stock[${xi}].item: "${x.item}" is not in this district's items.json`);
    });
  });
  return errors;
}
