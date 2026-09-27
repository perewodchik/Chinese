import type { SyllabusWord } from '../../data/types';
import { wordId } from '../../domain/ids';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 反一反 — opposites on a seesaw: 大 on one end, find what balances it.
 *
 * Only pairs whose two halves are both on the HSK list up to the band.
 */
export const PAIRS: Array<[string, string]> = [
  ['大', '小'],
  ['多', '少'],
  ['冷', '热'],
  ['上', '下'],
  ['前', '后'],
  ['左', '右'],
  ['早', '晚'],
  ['远', '近'],
  ['快', '慢'],
  ['贵', '便宜'],
  ['好', '坏'],
  ['买', '卖'],
  ['来', '去'],
  ['对', '错'],
  ['男', '女'],
  ['进', '出'],
  ['白天', '晚上'],
  ['上班', '下班'],
  ['上课', '下课'],
  ['开始', '完'],
  ['里面', '外面'],
  ['上面', '下面'],
  ['左边', '右边'],
  ['高兴', '累'],
];

export interface OppositeRound {
  shown: SyllabusWord;
  opposite: SyllabusWord;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 8;

export function pairsAt(ctx: GameContext): Array<[SyllabusWord, SyllabusWord]> {
  const on = (w: string) => ctx.words.find((x) => x.w === w) ?? null;
  return PAIRS.flatMap(([a, b]) => {
    const x = on(a);
    const y = on(b);
    return x && y ? [[x, y] as [SyllabusWord, SyllabusWord]] : [];
  });
}

export function buildOpposites(ctx: GameContext, n = ROUNDS): OppositeRound[] {
  const pairs = ctx.rng.shuffle(pairsAt(ctx)).slice(0, n);
  const all = pairsAt(ctx).flat();
  return pairs.map((p) => {
    const [shown, opposite] = ctx.rng.int(2) ? [p[1], p[0]] : p;
    const others = ctx.rng.sample(
      // nothing that shares a character with either end: 下面 is too near 下 to be wrong
      all.filter((w) => ![...w.w].some((c) => shown.w.includes(c) || opposite.w.includes(c))),
      3,
    );
    return {
      shown,
      opposite,
      right: opposite.w,
      options: ctx.rng.shuffle([opposite, ...others]).map((w) => ({ id: w.w, label: w.w, body: null })),
    };
  });
}

export const itemsOf = (r: OppositeRound) => [wordId(r.shown.w), wordId(r.opposite.w)];
