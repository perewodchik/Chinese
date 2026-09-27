import type { GameManifest } from '../types';
import { RULES, ROUNDS } from './content';
import { pictureCount } from '../kit/pool';

export const measureWords: GameManifest = {
  id: 'measure-words',
  name: 'Counting words',
  mark: '个',
  blurb: 'Three books, one fish: pick the word that counts them, by their shape.',
  bands: [1, 2],
  teaches: ['measure-words'],
  needs: ['images'],
  rounds: ROUNDS,
  available: (ctx) =>
    pictureCount(ctx, (w) => Boolean(w.cl?.length && RULES[w.cl[0]])) >= ROUNDS
      ? { ok: true }
      : { ok: false, reason: 'Not enough nouns with photos at this band' },
  load: () => import('./Game'),
};
