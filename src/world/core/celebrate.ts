/**
 * "You did it" (§13 K2): what a change to the save deserves a seal for.
 * A step done → a small seal with the step's `past` line; a quest done →
 * a bigger one with its name and what it gave; a spirit come home → the
 * spirit-return cutscene (built here from a template for the map you are on).
 * Pure; the page shows them one after another, never blocking.
 */

import type { Cutscene } from './cutscene';
import type { Action, Idiom, Item, MapObject, NpcCard, Quest, Tile, WorldSave } from './types';
import { stepIndexOf } from './save';

export type Seal =
  | { kind: 'step'; quest: string; step: string; past: string }
  | { kind: 'quest'; quest: string; title: string; main: boolean; reward: string[] };

/** How long each shows (ms): a step 1.8 s, a quest 2.5 s. */
export const SEAL_MS = { step: 1800, quest: 2500 } as const;

export interface RewardNames {
  items: readonly Pick<Item, 'id' | 'name' | 'en'>[];
  idioms: readonly Pick<Idiom, 'id'>[];
  npcs: readonly Pick<NpcCard, 'id' | 'name'>[];
}

/** A quest's reward as short English-and-hanzi bits: "🎁 糖葫芦", "成语 画龙点睛", "♥ 王阿姨". */
export function rewardLine(actions: readonly Action[] | undefined, names: RewardNames): string[] {
  const out: string[] = [];
  for (const a of actions ?? []) {
    if (a.do === 'give') out.push(`🎁 ${names.items.find((i) => i.id === a.item)?.name ?? a.item}`);
    else if (a.do === 'idiom') out.push(`成语 ${a.idiom}`);
    else if (a.do === 'hearts' && a.delta > 0) out.push(`♥ ${names.npcs.find((n) => n.id === a.npc)?.name ?? a.npc}`);
    else if (a.do === 'money' && a.amount > 0) out.push(`${a.amount} 元`);
    else if (a.do === 'stamp') out.push('印章');
  }
  return out;
}

/** The seals for the change from `before` to `after`, in quest order: each step done, then the quest if it finished. */
export function sealsFor(before: WorldSave, after: WorldSave, quests: readonly Quest[], names: RewardNames): Seal[] {
  const out: Seal[] = [];
  for (const q of quests) {
    const a = before.quests[q.id];
    const b = after.quests[q.id];
    if (!b) continue;
    const from = a ? (a.done ? q.steps.length : stepIndexOf(q, a)) : 0;
    const to = b.done ? q.steps.length : stepIndexOf(q, b);
    for (let i = from; i < to; i++) {
      const st = q.steps[i];
      if (st) out.push({ kind: 'step', quest: q.id, step: st.id, past: st.past });
    }
    if (b.done && !a?.done) out.push({ kind: 'quest', quest: q.id, title: q.title, main: q.kind === 'main', reward: rewardLine(q.reward, names) });
  }
  return out;
}

/** Spirits that came home between two saves. */
export function spiritsHome(before: WorldSave, after: WorldSave): string[] {
  return Object.keys(after.spirits).filter((id) => before.spirits[id] === undefined);
}

/**
 * The figures on the 走马灯's wheel, in the order they come home (story.md
 * §1.1); the tenth place is left blank by the grandfather and painted on
 * the Wall.
 */
export const LANTERN_FIGURES = ['shishizi', 'jiuweihu', 'menshen', 'qilin', 'shihou', 'pixiu', 'nianshou', 'long', 'zaowang', 'family'] as const;

/** How many figures of the lantern are lit in a save. */
export const litFigures = (s: WorldSave) => LANTERN_FIGURES.filter((f) => s.spirits[f] !== undefined || (f === 'family' && s.flags.includes('lantern-family')));

export const SPIRIT_RETURN = 'spirit-return-';
export const isSpiritReturn = (id: string) => id.startsWith(SPIRIT_RETURN);

/**
 * The spirit-return cutscene for one spirit on the map you are on: it
 * glows where it stood (or beside you), turns to light, flies off to the
 * north-east — home — and the lantern card shows its figure lighting up.
 * About 7 s; no lines but 兔儿爷's one.
 */
export function spiritReturn(spirit: string, map: string, objects: readonly MapObject[], hero: Tile): Cutscene {
  const own = objects.find((o): o is Extract<MapObject, { kind: 'spirit' }> => o.kind === 'spirit' && o.spirit === spirit);
  const at: Tile = own?.tile ?? [hero[0] + 1, hero[1]];
  const actor = `spirit:${spirit}`;
  return {
    id: `${SPIRIT_RETURN}${spirit}`,
    map,
    letterbox: true,
    music: 'soft',
    cast: [{ actor, at }],
    steps: [
      { camera: actor, ms: 500 },
      { together: [{ fx: 'sparkle', at: actor, n: 30 }, { sound: 'bell' }, { emote: 'rabbit', kind: 'happy' }] },
      { wait: 700 },
      { flash: true },
      { together: [{ fly: actor, by: [7, -9], ms: 1600 }, { fx: 'sparkle', at: actor, n: 20 }] },
      { despawn: actor },
      { fx: 'lantern', text: [spirit] },
      { wait: 3000 },
      { say: 'rabbit', en: 'Home — one more figure on the lantern is lit.' },
    ],
  };
}

/** Memory cutscenes (story.md §1.3) play at home once their spirit is back: the content marks them `auto`. */
export function autoCutscenes(s: WorldSave, all: readonly Cutscene[], map: string, holds: (c: NonNullable<Cutscene['auto']>) => boolean): Cutscene[] {
  return all.filter((c) => (c.on ?? c.map) === map && c.auto && !s.cutscenes.includes(c.id) && holds(c.auto));
}
