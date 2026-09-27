import type { GameManifest } from '../types';
import { coloursAt, ROUNDS } from './content';

export const colours: GameManifest = {
  id: 'colours',
  name: 'Colours',
  mark: '色',
  blurb: '「红色的苹果」— read it, then paint the apple.',
  bands: [2],
  teaches: ['colours'],
  rounds: ROUNDS,
  available: (ctx) => (coloursAt(ctx).length >= 3 ? { ok: true } : { ok: false, reason: 'The colours are HSK 2' }),
  load: () => import('./Game'),
};
