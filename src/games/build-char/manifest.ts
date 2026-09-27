import type { GameManifest } from '../types';
import { buildable, ROUNDS } from './content';

export const buildChar: GameManifest = {
  id: 'build-char',
  name: 'Build a character',
  mark: '拼',
  blurb: 'The meaning and the sound are given. Put its two parts into the frame: 女 + 子 = 好.',
  bands: [1, 2],
  teaches: ['characters'],
  rounds: ROUNDS,
  available: (ctx) =>
    buildable(ctx).length >= ROUNDS ? { ok: true } : { ok: false, reason: 'Not enough two-part characters' },
  load: () => import('./Game'),
};
