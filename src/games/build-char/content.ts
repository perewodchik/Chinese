import type { CharacterEntry } from '../../data/types';
import { charId } from '../../domain/ids';
import type { GameContext } from '../types';

/**
 * 拼一拼 — build the character from its two parts.
 *
 * The meaning and the reading are given; five parts lie in the tray, two of
 * them the character's. They go into a frame shaped like the character —
 * side by side (⿰: 女 + 子 = 好) or one over the other (⿱: 日 over 十 = 早)
 * — in the right order, because 子女 is not 好.
 */

export type Layout = '⿰' | '⿱';

export interface BuildRound {
  char: CharacterEntry;
  layout: Layout;
  parts: [string, string];
  tray: string[];
  /** what it means, in the sense the learner meets it */
  gloss: string;
}

export const ROUNDS = 8;

export function buildable(ctx: GameContext): CharacterEntry[] {
  const inBand = new Set(ctx.words.flatMap((w) => [...w.w]));
  return ctx.lib.characters.filter(
    (c) =>
      inBand.has(c.c) &&
      (c.ids?.startsWith('⿰') || c.ids?.startsWith('⿱')) &&
      c.parts.length === 2 &&
      c.parts.every((p) => [...p].length === 1) &&
      c.parts[0] !== c.parts[1],
  );
}

export function buildChars(ctx: GameContext, n = ROUNDS): BuildRound[] {
  const pool = buildable(ctx);
  const allParts = [...new Set(pool.flatMap((c) => c.parts))];
  const known = pool.filter((c) => ctx.known.has(charId(c.c)));
  const rest = pool.filter((c) => !ctx.known.has(charId(c.c)));
  const chosen = [...ctx.rng.shuffle(known).slice(0, Math.ceil(n * 0.6)), ...ctx.rng.shuffle(rest)].slice(0, n);
  return ctx.rng.shuffle(chosen).map((char) => {
    const parts = [char.parts[0], char.parts[1]] as [string, string];
    const wrong = ctx.rng.sample(
      allParts.filter((p) => !parts.includes(p)),
      3,
    );
    const word = ctx.lib.byWord.get(char.c);
    return {
      char,
      layout: char.ids!.startsWith('⿰') ? '⿰' : '⿱',
      parts,
      tray: ctx.rng.shuffle([...parts, ...wrong]),
      gloss: (word?.d ?? char.def).split(/[;,]/)[0].trim(),
    };
  });
}

export const itemsOf = (r: BuildRound) => [charId(r.char.c)];
