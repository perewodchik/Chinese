import type { GameManifest } from '../types';
import { peopleAt, ROUNDS } from './content';

export const family: GameManifest = {
  id: 'family',
  name: 'Family',
  mark: '家',
  blurb: 'A family drawn around 我. Say who is who — older is taller.',
  bands: [1, 2],
  teaches: ['family'],
  rounds: ROUNDS,
  available: (ctx) => (peopleAt(ctx).length > ROUNDS ? { ok: true } : { ok: false, reason: 'Not enough family words' }),
  load: () => import('./Game'),
};
