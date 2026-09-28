import type { GameManifest } from '../types';

export const ROUNDS = 3;

export const xijiadeGame: GameManifest = {
  id: 'order-xijiade',
  name: '喜家德',
  mark: '饺',
  blurb: 'Dumplings by weight: 二两、三两、半斤 — 两 not 二 — the filling, and boiled, fried or steamed.',
  bands: [1, 2],
  teaches: ['ordering'],
  needs: ['images'],
  rounds: ROUNDS,
  available: () => ({ ok: true }),
  load: () => import('./Game'),
  shop: { latin: 'XIJIADE', kind: 'Dumplings by weight · at the counter', photo: 'xijiade-banner', colour: '#1f6f45' },
};
