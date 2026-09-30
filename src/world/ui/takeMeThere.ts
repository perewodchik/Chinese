import { useEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { nextHop, trailFor, type Hop } from '../core/guide';
import type { WorldSave } from '../core/types';
import type { RunningWorld } from '../engine/boot';
import { placeZh, useMapIndex } from './Journal';

/**
 * "Take me there" (prompt §9⅞ M6), the page's half: where you asked to be taken (for this
 * session only — saved nowhere), and the footprints, the corner map's route and the train to
 * mark that follow from it on every map. A place card or the next-hop chip sets the goal; the
 * card, the chip under the corner map or arriving clears it.
 */

type Guide = {
  to: string | null;
  /** the maps ahead on foot, this one first, for the corner map */
  route: readonly string[];
};

let state: Guide = { to: null, route: [] };
const listeners = new Set<() => void>();
const emit = (next: Guide) => {
  state = next;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Take me to this map (null: stop). */
export const takeMeTo = (to: string | null) => emit({ to, route: [] });

/** Where you are being taken, and the maps ahead on foot. */
export const useGuide = (): Guide => useSyncExternalStore(subscribe, () => state);

type Rides = Extract<Hop, { kind: 'board' }>['rides'];

/**
 * The page's side: on every map, the footprints to the next door, street end or train board;
 * 兔儿爷 says "This way" when you set off and "Here we are" when you arrive. Returns the rides
 * to mark on the platform (empty off the platform).
 */
export function useTakeMeThere(world: RefObject<RunningWorld | null>, save: WorldSave | null, say: (text: string) => void): Rides {
  const { to } = useGuide();
  const index = useMapIndex();
  const map = save?.place.map;
  const said = useRef<string | null>(null);
  const sayRef = useRef(say);
  sayRef.current = say;
  // only a new map (or goal) moves the way on: the save changes at every step
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hop = useMemo<Hop | null>(() => (to && save && Object.keys(index).length ? nextHop(save, to, index) : null), [to, map, index]);

  useEffect(() => {
    if (!to) {
      said.current = null;
      world.current?.setTrail(null);
      return;
    }
    if (!hop) return;
    if (hop.kind === 'here' || hop.kind === 'none') {
      world.current?.setTrail(null);
      sayRef.current(hop.kind === 'here' ? `Here we are — ${placeZh(to)}.` : (hop.note ?? `I can't find a way to ${placeZh(to)} from here.`));
      said.current = null;
      takeMeTo(null);
      return;
    }
    world.current?.setTrail(trailFor(hop));
    const route = hop.kind === 'walk' && map ? [map, hop.next, ...hop.then] : [];
    if (route.join() !== state.route.join()) emit({ to, route });
    if (said.current !== to) {
      said.current = to;
      sayRef.current(hop.kind === 'board' ? 'This way — the right train is marked on the board.' : `This way — follow the footprints to ${placeZh(to)}.`);
    }
  }, [to, hop, map, world]);

  return useMemo(() => (hop?.kind === 'board' ? hop.rides : []), [hop]);
}
