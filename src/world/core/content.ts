/**
 * The zod schemas for every content file, and the loader that checks a
 * district's files and says, file and path, what is wrong.
 *
 * Each schema is typed against its interface in `types.ts`, so the two
 * cannot drift apart without the build failing.
 */

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
  z.strictObject({ do: z.literal('sleep') }),
  z.strictObject({ do: z.literal('wait'), until: hour }),
  z.strictObject({ do: z.literal('hearts'), npc: id, delta: z.number().int() }),
  z.strictObject({ do: z.literal('pin'), riddle: text }),
  z.strictObject({ do: z.literal('solve'), riddle: text }),
  z.strictObject({ do: z.literal('remember'), npc: id, note: text }),
]);

const actionKind = z.enum([
  'flag', 'give', 'take', 'money', 'card', 'quest', 'quest_done', 'stamp', 'spirit', 'idiom',
  'station', 'district', 'chapter', 'teleport', 'game', 'sleep', 'wait', 'hearts', 'pin', 'solve', 'remember',
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
});

const expectSchema: z.ZodType<Expect> = z.strictObject({
  intent: id,
  match: z.array(z.array(text).min(1)).min(1),
  go: id.optional(),
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
});

export const questSchema: z.ZodType<Quest> = z.strictObject({
  id,
  title: text,
  chapter: z.number().int().min(1),
  steps: z.array(z.strictObject({ id, now: text, done: conditionSchema.optional() })).min(1),
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
});

export const stampSchema: z.ZodType<Stamp> = z.strictObject({
  id,
  name: hanzi,
  en: text,
  place: text,
  design: text,
  landmark: z.boolean().optional(),
});

export const itemSchema: z.ZodType<Item> = z.strictObject({ id, name: hanzi, en: text, icon: z.string().optional(), gift: z.boolean().optional() });

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
  return { ok: true, value: out as unknown as DistrictContent };
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
      if (n.speaker && n.speaker !== 'hero' && n.speaker !== 'companion' && !npcs.has(n.speaker) && !spirits.has(n.speaker)) errors.push(`${nat}.speaker: unknown speaker "${n.speaker}"`);
      n.expect?.forEach((e, ei) => {
        if (e.go && !nodes.has(e.go)) errors.push(`${nat}.expect[${ei}].go: no node "${e.go}"`);
        e.actions?.forEach((a, ai) => checkAction(a, `${nat}.expect[${ei}].actions[${ai}]`));
      });
      n.onEnter?.forEach((a, ai) => checkAction(a, `${nat}.onEnter[${ai}]`));
      n.onExit?.forEach((a, ai) => checkAction(a, `${nat}.onExit[${ai}]`));
    });
    if (keys > 1) errors.push(`${at}: ${keys} key lines — at most one per scene`);
  });
  c.quests.forEach((q, qi) => q.reward?.forEach((a, ai) => checkAction(a, `quests[${qi}].reward[${ai}]`)));
  return errors;
}
