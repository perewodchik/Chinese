import type { GameManifest } from '../types';

export const ROUNDS = 4;

export const waipojiaGame: GameManifest = {
  id: 'order-waipojia',
  name: '外婆家',
  mark: '婆',
  blurb: 'Scan the table code at 外婆家: how many of you, the dishes, 加菜 while you eat, then 买单.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
  shop: { latin: 'Grandma’s Home', kind: 'Hangzhou home cooking · at the table', photo: 'braised-pork', colour: '#9b2d20' },
};
