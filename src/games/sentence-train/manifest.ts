import type { GameManifest } from '../types';
import { ROUNDS, trains } from './content';

export const sentenceTrain: GameManifest = {
  id: 'sentence-train',
  name: 'Sentence train',
  mark: '车',
  blurb: 'Couple the word cars in the right order to make the sentence.',
  bands: [1, 2],
  teaches: ['word-order'],
  rounds: ROUNDS,
  available: (ctx) => (trains(ctx).length >= ROUNDS ? { ok: true } : { ok: false, reason: 'Not enough sentences' }),
  load: () => import('./Game'),
};
