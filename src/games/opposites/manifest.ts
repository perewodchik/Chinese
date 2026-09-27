import type { GameManifest } from '../types';
import { pairsAt, ROUNDS } from './content';

export const opposites: GameManifest = {
  id: 'opposites',
  name: 'Opposites',
  mark: '反',
  blurb: '大 sits on one end of the seesaw. Find the word that balances it.',
  bands: [1, 2],
  teaches: ['opposites'],
  rounds: ROUNDS,
  available: (ctx) =>
    pairsAt(ctx).length >= ROUNDS ? { ok: true } : { ok: false, reason: 'Not enough opposites at this band' },
  load: () => import('./Game'),
};
