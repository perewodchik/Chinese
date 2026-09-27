import type { SyllabusWord } from '../../data/types';
import { wordId } from '../../domain/ids';
import { pictureWords } from '../kit/pool';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 听一听 — hear a word, tap its photo.
 *
 * Only words a native speaker has recorded: this is a listening game, and a
 * synthetic voice teaches the synthetic voice's mistakes (see the voice pack's
 * rules). The wrong photos are other words from the same game, so every photo
 * on screen is one the learner will also hear.
 */

export interface ListenRound {
  word: SyllabusWord;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 8;

export const listenable = (ctx: GameContext) => pictureWords(ctx, (w) => ctx.native.has(w.w));

export function buildListen(ctx: GameContext, n = ROUNDS): ListenRound[] {
  const pool = listenable(ctx);
  const asked = pool.slice(0, n);
  return asked.map((word) => {
    const others = ctx.rng.sample(
      pool.filter((w) => w.w !== word.w),
      3,
    );
    return {
      word,
      right: word.w,
      options: ctx.rng.shuffle([word, ...others]).map((w) => ({ id: w.w, label: w.w, body: null })),
    };
  });
}

export const itemsOf = (r: ListenRound) => [wordId(r.word.w)];
