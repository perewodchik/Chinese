import type { GameManifest } from '../types';

export const ROUNDS = 3;

export const majiyongGame: GameManifest = {
  id: 'order-majiyong',
  name: '马记永',
  mark: '面',
  blurb: 'Lanzhou beef noodles: 大碗还是小碗, which 面型, 要不要辣子 — pay first, then listen for your number.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
};
