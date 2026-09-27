import type { SyllabusWord } from '../../data/types';
import { wordId } from '../../domain/ids';
import { count, countPy } from '../kit/numbers';
import { pictureWords } from '../kit/pool';
import type { TileOption } from '../kit/Tiles';
import type { GameContext } from '../types';

/**
 * 几个 — which measure word a thing takes, told by its shape.
 *
 * Measure words sort the world by what things are like: 张 for what is flat,
 * 条 for what is long, 本 for what is bound. The game shows the thing and
 * asks for the word, and afterwards says the rule. Only these measure words
 * are asked; a noun whose first measure word is another one is not used.
 */
export const RULES: Record<string, { py: string; rule: string }> = {
  个: { py: 'gè', rule: 'the everyday one — people and most things' },
  本: { py: 'běn', rule: 'bound things: books and notebooks' },
  件: { py: 'jiàn', rule: 'clothes, and matters' },
  只: { py: 'zhī', rule: 'animals' },
  条: { py: 'tiáo', rule: 'long and bendy: fish, roads, trousers' },
  张: { py: 'zhāng', rule: 'flat: tables, beds, tickets' },
  杯: { py: 'bēi', rule: 'a cupful' },
  家: { py: 'jiā', rule: 'shops and companies' },
  辆: { py: 'liàng', rule: 'vehicles' },
  位: { py: 'wèi', rule: 'people, politely' },
  间: { py: 'jiān', rule: 'rooms' },
};

export interface MeasureRound {
  word: SyllabusWord;
  n: number;
  right: string;
  options: TileOption[];
}

export const ROUNDS = 10;

/** Nouns that can be asked: a photo, and a measure word the game teaches. */
export const askable = (ctx: GameContext) =>
  pictureWords(ctx, (w) => Boolean(w.cl?.length && RULES[w.cl[0]]));

export function buildMeasure(ctx: GameContext, n = ROUNDS): MeasureRound[] {
  const pool = askable(ctx);
  // 个 is right so often that a game of it teaches nothing: at most two.
  const ge = pool.filter((w) => w.cl![0] === '个').slice(0, 2);
  const rest = pool.filter((w) => w.cl![0] !== '个');
  const words = ctx.rng.shuffle([...rest.slice(0, n - ge.length), ...ge]).slice(0, n);
  const all = Object.keys(RULES);
  return words.map((word) => {
    const right = word.cl![0];
    // 个 counts nearly anything in speech (四个先生 is fine, if plain), so it
    // is never offered as a wrong answer — only when it is the answer.
    const others = ctx.rng.sample(
      all.filter((m) => m !== right && m !== '个' && !(word.cl ?? []).includes(m)),
      3,
    );
    return {
      word,
      n: 1 + ctx.rng.int(9),
      right,
      options: ctx.rng.shuffle([right, ...others]).map((m) => ({ id: m, label: m, body: null })),
    };
  });
}

export const phrase = (r: MeasureRound) => `${count(r.n)}${r.right}${r.word.w}`;
export const phrasePy = (r: MeasureRound) => `${countPy(r.n)} ${RULES[r.right].py} ${r.word.py}`;
export const itemsOf = (r: MeasureRound) => [wordId(r.word.w)];
