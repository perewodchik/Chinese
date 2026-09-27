import type { GameManifest } from './types';
import { buildChar } from './build-char/manifest';
import { clock } from './clock/manifest';
import { colours } from './colours/manifest';
import { compound } from './compound/manifest';
import { family } from './family/manifest';
import { listen } from './listen/manifest';
import { measureWords } from './measure-words/manifest';
import { opposites } from './opposites/manifest';
import { pairs } from './pairs/manifest';
import { sentenceTrain } from './sentence-train/manifest';
import { shop } from './shop/manifest';
import { whereIsIt } from './where-is-it/manifest';

/**
 * Every game there is. Adding one is a folder beside this file and a line
 * here — see README.md. Order is the order of the Play page.
 */
export const GAMES: GameManifest[] = [whereIsIt, pairs, listen, compound, buildChar, measureWords, clock, shop, family, opposites, colours, sentenceTrain];

export const gameById = (id: string | undefined) => GAMES.find((g) => g.id === id) ?? null;
