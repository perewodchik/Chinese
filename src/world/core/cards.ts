/**
 * Place cards (RW2, the learner 2026-10-01: "make something like a collectible … so I can learn
 * new stuff about the place that I visited"). Every real landmark has a card: its name and a few
 * short facts in simple Chinese with English, each opened by doing something there — reading a
 * sign, talking to someone, coming at the right hour, taking the photo. The card fills up as you
 * look around; a full card gets a gold edge. Facts come from `docs/world-game/facts.md` (each
 * names its row), so nothing on a card is made up.
 *
 * Nothing new in the save: a fact is open when its condition holds (`flags.ts`), so old saves
 * open what they have already done.
 */

import { holds } from './flags';
import type { Leveler } from './budget';
import type { Condition, WorldSave } from './types';

export interface CardFact {
  id: string;
  /** one short line, HSK 1–2 with the place's own names */
  zh: string;
  en: string;
  /** its row in facts.md */
  fact: string;
  /** what opens it */
  open: Condition;
  /** how to open it, for the closed line (help is free: it says where to look) */
  how: string;
}

export interface PlaceCard {
  id: string;
  /** the map it belongs to (its picture, and where "Take me there" goes) */
  map: string;
  zh: string;
  pinyin: string;
  en: string;
  /** RW5: what you bring home when the card is full — it stands on your room's shelf (a props-atlas frame) */
  souvenir?: { frame: string; zh: string; en: string };
  /** the card's own words with their English, shown under the facts (and free in the level check) */
  words?: { w: string; en: string }[];
  facts: CardFact[];
}

export interface CardState {
  card: PlaceCard;
  open: CardFact[];
  closed: CardFact[];
  /** seen at all: you have been there */
  found: boolean;
  full: boolean;
}

export function cardState(s: WorldSave, card: PlaceCard): CardState {
  const open = card.facts.filter((f) => holds(f.open, s));
  return {
    card,
    open,
    closed: card.facts.filter((f) => !open.includes(f)),
    found: open.length > 0 || holds({ visited: card.map }, s),
    full: open.length === card.facts.length,
  };
}

/** How many facts are open over all cards (the collection's count) */
export function factsOpen(s: WorldSave, cards: readonly PlaceCard[]): { open: number; total: number } {
  let open = 0;
  let total = 0;
  for (const c of cards) {
    const st = cardState(s, c);
    open += st.open.length;
    total += c.facts.length;
  }
  return { open, total };
}

/** RW5: the souvenirs on your shelf — one for every card that has one, got when the card is full */
export function souvenirs(s: WorldSave, cards: readonly PlaceCard[]): Array<{ state: CardState; got: boolean }> {
  return cards.filter((c) => c.souvenir).map((c) => {
    const state = cardState(s, c);
    return { state, got: state.full };
  });
}

/** At most this many words above HSK 2 in a fact's line (a tap on any word explains it) */
export const MAX_HARD_WORDS = 2;

/**
 * The checks `world:check` runs on the cards: every map and sign a fact names exists, every scene,
 * every facts.md row, and the lines stay easy (HSK 1–2, the places' own names free).
 */
export function checkCards(
  cards: readonly PlaceCard[],
  ctx: {
    leveler: Leveler;
    names: ReadonlySet<string>;
    facts: ReadonlySet<string>;
    /** each map's object ids */
    objects: ReadonlyMap<string, ReadonlySet<string>>;
    scenes: ReadonlySet<string>;
    /** the props atlas's frames, for the souvenirs (none given: not checked) */
    frames?: ReadonlySet<string>;
  },
): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const refs = (c: Condition, at: (s: string) => string): void => {
    if ('all' in c) return c.all.forEach((x) => refs(x, at));
    if ('any' in c) return c.any.forEach((x) => refs(x, at));
    if ('not' in c) return refs(c.not, at);
    if ('read' in c) {
      const [map, obj] = c.read.split(':') as [string, string?];
      if (!ctx.objects.has(map)) out.push(at(`reads a sign on "${map}", which is not a map`));
      else if (!obj || !ctx.objects.get(map)!.has(obj)) out.push(at(`reads "${obj}", which is not on ${map}`));
    }
    if ('visited' in c && !ctx.objects.has(c.visited)) out.push(at(`"${c.visited}" is not a map`));
    if ('scene' in c && !ctx.scenes.has(c.scene)) out.push(at(`scene "${c.scene}" does not exist`));
  };
  for (const card of cards) {
    const at = (s: string) => `card ${card.id}: ${s}`;
    if (ids.has(card.id)) out.push(at('id used twice'));
    ids.add(card.id);
    if (!ctx.objects.has(card.map)) out.push(at(`map "${card.map}" does not exist`));
    if (card.souvenir && ctx.frames && !ctx.frames.has(card.souvenir.frame)) out.push(at(`souvenir frame "${card.souvenir.frame}" is not in the props atlas`));
    const glossed = new Set((card.words ?? []).map((w) => w.w));
    for (const w of glossed) if (!card.facts.some((f) => f.zh.includes(w))) out.push(at(`word ${w} is in no fact`));
    for (const f of card.facts) {
      const fat = (s: string) => at(`${f.id}: ${s}`);
      if (!ctx.facts.has(f.fact)) out.push(fat(`fact "${f.fact}" is not in docs/world-game/facts.md`));
      refs(f.open, fat);
      const whole = new Set([...ctx.names, ...glossed]);
      const hard = ctx.leveler(f.zh, whole).filter((w) => !whole.has(w.w) && (w.level >= 3 || w.level === 0));
      if (hard.length > MAX_HARD_WORDS) out.push(fat(`${hard.map((w) => `${w.w} [HSK ${w.level || '?'}]`).join(', ')} — at most ${MAX_HARD_WORDS} words above HSK 2`));
    }
  }
  return out;
}
