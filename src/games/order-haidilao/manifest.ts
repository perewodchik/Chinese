import type { GameManifest } from '../types';

export const ROUNDS = 4;

export const haidilaoGame: GameManifest = {
  id: 'order-haidilao',
  name: '海底捞',
  mark: '捞',
  blurb: 'Hotpot at 海底捞: how many, the soup (鸳鸯 is two), 整份还是半份, and the sauce bar per person.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
};
