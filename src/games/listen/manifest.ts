import type { GameManifest } from '../types';
import { pictureCount } from '../kit/pool';
import { ROUNDS } from './content';

export const listen: GameManifest = {
  id: 'listen',
  name: 'Listen',
  mark: '听',
  blurb: 'A native speaker says a word. Tap its photo.',
  bands: [1, 2],
  teaches: ['listening', 'vocabulary'],
  needs: ['images', 'native-audio'],
  rounds: ROUNDS,
  available: (ctx) =>
    pictureCount(ctx, (w) => ctx.native.has(w.w)) >= ROUNDS
      ? { ok: true }
      : { ok: false, reason: 'Not enough native recordings with photos yet' },
  load: () => import('./Game'),
};
