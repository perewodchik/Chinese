import { wordId } from '../../domain/ids';
import { pictureWords } from '../kit/pool';
import type { GameContext } from '../types';

/**
 * 连一连 — pairs: face-down cards, a photo and its word for each of six words.
 */

export interface Card {
  /** position on the table */
  key: string;
  /** the word the card belongs to; its partner has the same */
  word: string;
  face: 'picture' | 'word';
}

export const PAIRS = 6;

export function buildPairs(ctx: GameContext, n = PAIRS): { words: string[]; cards: Card[] } {
  const words = pictureWords(ctx).slice(0, n).map((w) => w.w);
  const cards = ctx.rng.shuffle(
    words.flatMap((w) => [
      { word: w, face: 'picture' as const },
      { word: w, face: 'word' as const },
    ]),
  );
  return { words, cards: cards.map((c, i) => ({ ...c, key: `k${i}` })) };
}

export const itemsOf = (word: string) => [wordId(word)];
