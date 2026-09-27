import type { GameManifest } from '../types';
import { pictureCount } from '../kit/pool';
import { ROUNDS } from './content';

/** Not in the registry: copy the folder, rename, and add the copy there. */
export const template: GameManifest = {
  id: 'template',
  name: 'Template',
  mark: '样',
  blurb: 'A photo; which word is it?',
  bands: [1, 2],
  teaches: ['vocabulary'],
  needs: ['images'],
  rounds: ROUNDS,
  available: (ctx) => (pictureCount(ctx) >= ROUNDS ? { ok: true } : { ok: false, reason: 'Not enough photos' }),
  load: () => import('./Game'),
};
