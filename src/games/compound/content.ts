import { picturesFor, type WordPart } from '../../data/pictures';
import type { SyllabusWord } from '../../data/types';
import { charId, wordId } from '../../domain/ids';
import { leaning } from '../kit/pool';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 火 + 车 = ? — two characters by what they mean on their own, and the word
 * they make.
 *
 * Every compound in the band whose two parts both have a photo and whose
 * whole has one too: 电 electricity + 脑 brain, 飞 fly + 机 machine. The wrong
 * answers are other compounds' photos, so what is being judged is the sum,
 * not whether a picture looks like one of the parts.
 */

export interface CompoundRound {
  word: SyllabusWord;
  parts: WordPart[];
  right: string;
  options: TileOption[];
}

export const ROUNDS = 8;

export function compounds(ctx: GameContext): SyllabusWord[] {
  const seen = new Set<string>();
  return leaning(
    ctx,
    ctx.words.filter((w) => {
      const p = picturesFor(w.w);
      if (!p?.picture || p.parts?.length !== 2 || !p.parts.every((x) => x.picture)) return false;
      // 衣 clothing + 服 clothes = 衣服, three times the same photo, is no sum
      const srcs = new Set([p.picture.src, ...p.parts.map((x) => x.picture!.src)]);
      return srcs.size === 3;
    }),
  ).filter((w) => {
    const pic = ctx.pictureOf(w.w);
    if (!pic || seen.has(pic)) return false;
    seen.add(pic);
    return true;
  });
}

export function buildCompound(ctx: GameContext, n = ROUNDS): CompoundRound[] {
  const pool = compounds(ctx);
  return pool.slice(0, n).map((word) => {
    const others = ctx.rng.sample(
      pool.filter((w) => w.w !== word.w),
      3,
    );
    return {
      word,
      parts: picturesFor(word.w)!.parts!,
      right: word.w,
      options: ctx.rng.shuffle([word, ...others]).map((w) => ({ id: w.w, label: w.w, body: null })),
    };
  });
}

export const itemsOf = (r: CompoundRound) => [wordId(r.word.w), ...[...r.word.w].map(charId)];
