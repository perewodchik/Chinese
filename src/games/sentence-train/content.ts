import { wordId } from '../../domain/ids';
import { segment } from '../../domain/segment';
import type { GameContext } from '../types';

/**
 * 句子火车 — put the words of a sentence in order, car by car.
 *
 * The sentences are the example sentences of the band's words, cut into words
 * the way the reader cuts them. Only sentences of three to six words, every
 * one of them in the band, without digits (a car saying "3" teaches nothing).
 * The English is the hint; the full stop stays at the end of the train.
 */

export interface TrainRound {
  zh: string;
  py: string;
  en: string;
  /** the words, in order */
  cars: string[];
  /** the same words, shuffled — never already in order */
  shuffled: string[];
  /** the punctuation at the end */
  end: string;
  /** the word the sentence was an example of */
  for: string;
}

export const ROUNDS = 6;

const cache = new WeakMap<object, Map<number, Omit<TrainRound, 'shuffled'>[]>>();

/** Every usable sentence of the band — cut once per library and band, since the Play page asks often. */
export function trains(ctx: GameContext): Omit<TrainRound, 'shuffled'>[] {
  let byBand = cache.get(ctx.lib);
  if (!byBand) cache.set(ctx.lib, (byBand = new Map()));
  const hit = byBand.get(ctx.band);
  if (hit) return hit;
  const out: Omit<TrainRound, 'shuffled'>[] = [];
  byBand.set(ctx.band, out);
  const seen = new Set<string>();
  for (const w of ctx.words) {
    for (const ex of w.ex ?? []) {
      if (seen.has(ex.zh) || /[0-9A-Za-z…]/.test(ex.zh)) continue;
      seen.add(ex.zh);
      const tokens = segment(ex.zh, ctx.lib);
      const words = tokens.filter((t) => t.word);
      const tail = tokens.filter((t) => !t.word);
      // punctuation only at the end
      if (tail.some((t) => t.at < tokens[tokens.length - 1].at && /\S/.test(t.text))) continue;
      if (words.length < 3 || words.length > 6) continue;
      if (words.some((t) => t.band === 0 || t.band > ctx.band)) continue;
      out.push({ zh: ex.zh, py: ex.py, en: ex.en, cars: words.map((t) => t.text), end: tail.map((t) => t.text).join('').trim(), for: w.w });
    }
  }
  return out;
}

export function buildTrains(ctx: GameContext, n = ROUNDS): TrainRound[] {
  return ctx.rng
    .shuffle(trains(ctx))
    .slice(0, n)
    .map((t) => {
      let shuffled = ctx.rng.shuffle(t.cars);
      for (let i = 0; i < 5 && shuffled.join('') === t.cars.join(''); i++) shuffled = ctx.rng.shuffle(t.cars);
      return { ...t, shuffled };
    });
}

export const itemsOf = (r: TrainRound) => [...new Set(r.cars)].map(wordId);
