import type { SyllabusWord } from '../../data/types';
import { wordId } from '../../domain/ids';
import type { GameContext } from '../types';

/**
 * Words a game can ask about, ordered the way a round should meet them.
 *
 * Known and in-rotation words first (shuffled), then the rest of the band
 * (shuffled): a game should mostly be practice with what is being learned,
 * with a few strangers mixed in — never a quiz on words not met yet, and never
 * only the same thirty.
 */
export function leaning(ctx: GameContext, words: readonly SyllabusWord[]): SyllabusWord[] {
  const known = words.filter((w) => ctx.known.has(wordId(w.w)));
  const rest = words.filter((w) => !ctx.known.has(wordId(w.w)));
  const k = ctx.rng.shuffle(known);
  const r = ctx.rng.shuffle(rest);
  // interleave two known to one new, so a band with few known words still mixes
  const out: SyllabusWord[] = [];
  while (k.length || r.length) {
    if (k.length) out.push(k.shift()!);
    if (k.length) out.push(k.shift()!);
    if (r.length) out.push(r.shift()!);
  }
  return out;
}

/**
 * Words with a photo, one word per photo: 今天 and 明天 share a calendar, and
 * a game that shows two identical pictures has no right answer.
 */
export function pictureWords(ctx: GameContext, filter: (w: SyllabusWord) => boolean = () => true): SyllabusWord[] {
  const seen = new Set<string>();
  const out: SyllabusWord[] = [];
  for (const w of leaning(ctx, ctx.words.filter(filter))) {
    const pic = ctx.pictureOf(w.w);
    if (!pic || seen.has(pic)) continue;
    seen.add(pic);
    out.push(w);
  }
  return out;
}

/** A short English gloss: the first sense, without "to ". */
export const gist = (d: string) => d.split(/[;(]/)[0].trim();

/** How many different photos the band's words have — for `available`, without touching the round's dice. */
export function pictureCount(ctx: GameContext, filter: (w: SyllabusWord) => boolean = () => true): number {
  return new Set(ctx.words.filter(filter).map((w) => ctx.pictureOf(w.w)).filter(Boolean)).size;
}
