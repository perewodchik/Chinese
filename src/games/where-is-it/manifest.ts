import type { GameManifest } from '../types';
import { placesAt, ROUNDS } from './content';

export const whereIsIt: GameManifest = {
  id: 'where-is-it',
  name: 'Where is it?',
  mark: '在',
  blurb: '「猫在桌子下面。」— drag the cat to where the sentence says.',
  bands: [1, 2],
  teaches: ['place-words'],
  needs: ['drag', 'images'],
  rounds: ROUNDS,
  available: (ctx) => (placesAt(ctx).length >= 3 ? { ok: true } : { ok: false, reason: 'Not enough place words' }),
  load: () => import('./Game'),
};
