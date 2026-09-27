import type { GameManifest } from '../types';
import { ROUNDS } from './content';

export const clock: GameManifest = {
  id: 'clock',
  name: 'What time is it?',
  mark: '点',
  blurb: 'Read the clock: 三点半, 两点 — and at HSK 2, morning or evening too.',
  bands: [1, 2],
  teaches: ['time'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
};
