import type { Library } from '../data/types';
import type { ItemId } from './ids';
import { basisPool, emptySpec, renumber, taughtAlready } from './teach';
import type { GeneratedText, TextPlan } from './text';

/**
 * A new writing session: the inventory it may assume, what earlier texts have
 * already taught, and three passages to start from.
 */
export function planSession(input: {
  id: string;
  name: string;
  setId: string | null;
  now: number;
  lib: Library;
  learned: ReadonlySet<ItemId>;
  texts: GeneratedText[];
  basisCount: number;
}): TextPlan {
  const { lib, learned } = input;
  // Only what has been marked learned. A session opened two weeks in has
  // eleven characters to build on, and eleven characters is what the passage
  // gets: a text written as though a band were finished is a text that cannot
  // be read, which is the one thing it must never be.
  const pool = basisPool(lib, learned);
  const count = input.basisCount || 150;
  const basis = pool.slice(0, count);
  const inBasis = new Set(basis);

  return {
    id: input.id,
    name: input.name,
    createdAt: input.now,
    setId: input.setId,
    basis,
    basisCount: count,
    // What earlier texts already taught: reusable, but not new again.
    met: [...taughtAlready(input.texts)].filter((c) => !inBasis.has(c)),
    // Three to start with, deliberately not identical: a session you can read
    // straight through has a warm-up and something harder at the end.
    specs: renumber([
      emptySpec({ level: 'comfort', length: 'short', newCount: 3 }),
      emptySpec({ level: 'edge', length: 'medium', newCount: 5 }),
      emptySpec({ level: 'stretch', length: 'medium', newCount: 8 }),
    ]),
    response: '',
    step: 'plan',
  };
}
