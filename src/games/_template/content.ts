import { wordId } from '../../domain/ids';
import { gist, pictureWords } from '../kit/pool';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * A template: a photo, and which of four words it is. Copy this folder, then
 * change what the rounds are made of.
 */

export interface TemplateRound {
  word: string;
  gloss: string;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 8;

export function buildRounds(ctx: GameContext, n = ROUNDS): TemplateRound[] {
  const pool = pictureWords(ctx);
  return pool.slice(0, n).map((w) => {
    const others = ctx.rng.sample(
      pool.filter((x) => x.w !== w.w),
      3,
    );
    return {
      word: w.w,
      gloss: gist(w.d),
      right: w.w,
      options: ctx.rng.shuffle([w, ...others]).map((x) => ({ id: x.w, label: x.w, body: null })),
    };
  });
}

export const itemsOf = (r: TemplateRound) => [wordId(r.word)];
