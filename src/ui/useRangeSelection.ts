import { useCallback, useRef, useState } from 'react';

/**
 * Click to pick one; shift-click to pick everything between it and the last one
 * picked, in the order the items are on screen right now.
 */
export function useRangeSelection<T>(ordering: readonly T[]) {
  const [selected, setSelected] = useState<ReadonlySet<T>>(() => new Set());
  const anchor = useRef<T | null>(null);

  const toggle = useCallback(
    (id: T, extend: boolean) => {
      const start = anchor.current;
      anchor.current = id;
      setSelected((prev) => {
        const next = new Set(prev);
        const from = start === null ? -1 : ordering.indexOf(start);
        const to = ordering.indexOf(id);
        if (extend && from >= 0 && to >= 0) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) next.add(ordering[i]);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [ordering],
  );

  const clear = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback((ids: Iterable<T>) => setSelected(new Set(ids)), []);

  return { selected, toggle, clear, selectAll };
}

/**
 * Tapping a card opens it; with Select on, tapping picks it instead.
 *
 * A card has one obvious thing a tap should do, and on a grid of characters
 * or words that is to open it — picking is the occasional job, done in a run
 * and then finished with. So picking is a mode you turn on, and turning it
 * off lets go of whatever was picked.
 */
export function useSelectMode<T>(ordering: readonly T[]) {
  const selection = useRangeSelection(ordering);
  const [on, setOn] = useState(false);
  const { clear } = selection;
  const toggleMode = useCallback(() => {
    setOn((was) => {
      if (was) clear();
      return !was;
    });
  }, [clear]);
  return { ...selection, on, toggleMode };
}
