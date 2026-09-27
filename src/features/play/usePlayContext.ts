import { useEffect, useMemo, useState } from 'react';
import { packTexts } from '../../platform/audio/voiceOut';
import { makeContext } from '../../games/kit/context';
import type { Band, GameContext } from '../../games/types';
import { useStore } from '../../store/store';
import { useLibrary } from '../shared/library';

/** The texts with a native recording, once the voice pack has said. */
export function useNative(): Set<string> | null {
  const [native, setNative] = useState<Set<string> | null>(null);
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

/** A game context for this learner; a new one for every seed. */
export function usePlayContext(band: Band, seed: string): GameContext | null {
  const lib = useLibrary();
  const native = useNative();
  const learned = useStore((s) => s.learned);
  const recall = useStore((s) => s.recall);
  return useMemo(() => {
    if (!native) return null;
    const known = new Set([...learned, ...Object.keys(recall)]);
    return makeContext({ lib, band, native, known, seed });
    // recall changes with every answer; a round in progress keeps the context it started with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, band, native, seed]);
}
