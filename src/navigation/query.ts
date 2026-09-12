import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/** A query value when it is one of the allowed ones, and the default when it is anything else. */
export function oneOf<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * The query string as page state: a filter, a sort order, a chosen tab.
 *
 * Kept in the address so that going back to a page finds it the way it was
 * left, and a link can open it that way. A change replaces the history entry
 * rather than adding one — nobody wants the back button to undo a filter one
 * click at a time — and a value equal to its default is left out altogether.
 */
export function useQuery() {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (key: string, value: string | null, fallback = '') => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === fallback) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );
  return [params, set] as const;
}
