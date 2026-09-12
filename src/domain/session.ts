import type { Library } from '../data/types';
import type { ItemId } from './ids';
import { basisPool, emptySpec, renumber, taughtAlready, type BasisSource } from './teach';
import type { GeneratedText, TextPlan } from './text';

/** Below this many characters, "what I have learned" is too little to write a passage from. */
const MIN_BASIS = 40;

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
  basisSource: BasisSource;
  basisCount: number;
}): TextPlan {
  const { lib, learned } = input;
  // Two weeks in you have marked eleven characters, which is not a passage.
  // Borrow the syllabus rather than open a session that cannot start.
  const asked = basisPool(lib, input.basisSource, learned);
  const source: BasisSource = asked.length >= MIN_BASIS ? input.basisSource : 'learned+hsk1';
  const pool = source === input.basisSource ? asked : basisPool(lib, source, learned);
  const count = input.basisCount || 150;
  const basis = pool.slice(0, count);
  const inBasis = new Set(basis);

  return {
    id: input.id,
    name: input.name,
    createdAt: input.now,
    setId: input.setId,
    basis,
    basisSource: source,
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
