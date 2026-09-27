import type { GameManifest } from '../types';
import { pictureCount } from '../kit/pool';
import { ROUNDS } from './content';

export const shop: GameManifest = {
  id: 'shop',
  name: 'At the shop',
  mark: '钱',
  blurb: '苹果：十五块 — read the price and pay it, coin by coin.',
  bands: [1, 2],
  teaches: ['money'],
  needs: ['images'],
  rounds: ROUNDS,
  available: (ctx) =>
    pictureCount(ctx) >= 4 ? { ok: true } : { ok: false, reason: 'Not enough things with photos to sell' },
  load: () => import('./Game'),
};
