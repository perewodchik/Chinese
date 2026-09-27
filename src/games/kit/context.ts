import type { Library } from '../../data/types';
import { pictureSlug } from '../../data/pictures';
import type { ItemId } from '../../domain/ids';
import type { Band, GameContext } from '../types';
import { makeRng } from './rng';

/**
 * Everything a game may use, gathered once per round.
 *
 * Built from plain values so a test can build one from the real data files
 * (see testContext.ts) and get exactly what the page would.
 */
export function makeContext(opts: {
  lib: Library;
  band: Band;
  native: Set<string>;
  known: Set<ItemId>;
  seed: string;
  pictures?: (w: string) => string | null;
}): GameContext {
  return {
    lib: opts.lib,
    band: opts.band,
    words: opts.lib.words.filter((w) => w.hsk <= opts.band),
    pictureOf: opts.pictures ?? pictureSlug,
    native: opts.native,
    known: opts.known,
    rng: makeRng(opts.seed),
  };
}
