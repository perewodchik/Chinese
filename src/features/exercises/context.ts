import { useEffect, useMemo, useState } from 'react';
import type { Library } from '../../data/types';
import { distractorPool, type ExerciseContext } from '../../domain/exercises/generate';
import type { ItemInfo } from '../../domain/exercises/items';
import { makeRng } from '../../domain/exercises/rng';
import { idValue, isCharId } from '../../domain/ids';
import { packTexts } from '../../platform/audio/voiceOut';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** The texts with a native recording, once the voice pack has said; null until then. */
export function useNativeTexts(): ReadonlySet<string> | null {
  const [native, setNative] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    let live = true;
    packTexts()
      .then((s) => live && setNative(s))
      .catch(() => live && setNative(new Set()));
    return () => {
      live = false;
    };
  }, []);
  return native;
}

const pools = new WeakMap<Library, ItemInfo[]>();
const poolOf = (lib: Library) => {
  let p = pools.get(lib);
  if (!p) pools.set(lib, (p = distractorPool(lib, 2)));
  return p;
};

/**
 * What the exercise generators need, for this learner: the characters they
 * can read (plus `also`, the ones being learned right now), the distractor
 * pool, the native recordings, and a random source seeded by `seed` — so a
 * sitting reloaded on the same day deals the same cards. Null until the
 * voice pack has answered.
 */
export function useExerciseContext(seed: string, also: readonly string[] = []): ExerciseContext | null {
  const lib = useLibrary();
  const native = useNativeTexts();
  // Read once: a sitting keeps the context it started with, however the
  // memory changes under it.
  const learned = useStore((s) => s.learned);
  const alsoKey = also.join('');
  return useMemo(() => {
    if (!native) return null;
    const known = new Set<string>();
    for (const id of learned) if (isCharId(id)) known.add(idValue(id));
    for (const c of alsoKey) known.add(c);
    return { lib, known, pool: poolOf(lib), native, rng: makeRng(seed) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, native, seed, alsoKey]);
}
