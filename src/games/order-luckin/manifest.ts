import type { GameManifest } from '../types';

export const ROUNDS = 3;

export const orderLuckin: GameManifest = {
  id: 'order-luckin',
  name: '瑞幸咖啡',
  mark: '瑞',
  blurb: 'Order coffee in luckin’s WeChat mini-program: 冰还是热，少甜，燕麦奶，打包.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
};
