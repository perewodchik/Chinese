import type { GameManifest } from '../types';

export const ROUNDS = 3;

export const mixueGame: GameManifest = {
  id: 'order-mixue',
  name: '蜜雪冰城',
  mark: '蜜',
  blurb: 'Bubble tea at Mixue: 去冰半糖加珍珠 — 冰量, 糖度 and 加料 for every cup.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
  shop: { latin: 'MIXUE', kind: 'Tea and ice cream · pick up', photo: 'bubble-tea', colour: '#e2231a' },
};
