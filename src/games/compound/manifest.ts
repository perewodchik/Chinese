import type { GameManifest } from '../types';
import { compounds, ROUNDS } from './content';

export const compound: GameManifest = {
  id: 'compound',
  name: 'Fire + car',
  mark: '合',
  blurb: 'Two characters by what they mean alone. Which word do they make?',
  bands: [1, 2],
  teaches: ['compounds', 'characters'],
  needs: ['images'],
  rounds: ROUNDS,
  available: (ctx) =>
    compounds({ ...ctx, rng: { ...ctx.rng, shuffle: (l) => [...l] } }).length >= ROUNDS
      ? { ok: true }
      : { ok: false, reason: 'Not enough pictured compounds at this band' },
  load: () => import('./Game'),
};
