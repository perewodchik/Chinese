import type { GameManifest } from '../types';

export const ROUNDS = 4;

export const dimsumGame: GameManifest = {
  id: 'order-dimsum',
  name: '点都德',
  mark: '点',
  blurb: 'Morning tea in Guangzhou style: choose the tea, order 虾饺 by the 笼 and 烧鹅 by the 例牌 or 半只.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
};
