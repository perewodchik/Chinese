import type { GameManifest } from '../types';
import { pictureCount } from '../kit/pool';
import { PAIRS } from './content';

export const pairs: GameManifest = {
  id: 'pairs',
  name: 'Pairs',
  mark: '连',
  blurb: 'Turn the cards over and find each photo and its word.',
  bands: [1, 2],
  teaches: ['vocabulary'],
  needs: ['images'],
  rounds: PAIRS,
  available: (ctx) =>
    pictureCount(ctx) >= PAIRS ? { ok: true } : { ok: false, reason: 'Not enough words with photos yet' },
  load: () => import('./Game'),
};
