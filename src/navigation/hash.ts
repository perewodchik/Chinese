import { useCallback, useState } from 'react';

/**
 * Where on a long page the learner is, or what is open over it, kept in the
 * address's hash: `/texts/s1#words`, `/texts/s1#copy`. A reload, or the same
 * link on the other device, opens the page there again.
 *
 * Written with `replaceState` and the router's own history state kept, so the
 * router neither re-renders the page nor loses its place in history: the hash
 * is a note in the address, not a navigation. It is one value a page — the
 * part being read, or the one thing open over it.
 */

export const readHash = (): string => (typeof location === 'undefined' ? '' : decodeURIComponent(location.hash.slice(1)));

export function writeHash(value: string | null): void {
  if (typeof location === 'undefined') return;
  const now = readHash();
  if ((value ?? '') === now) return;
  const url = `${location.pathname}${location.search}${value ? `#${encodeURIComponent(value)}` : ''}`;
  try {
    history.replaceState(history.state, '', url);
  } catch {
    // An address that cannot be written (a sandboxed frame): the page still works, only a reload forgets.
  }
}

/** Something open over a page, kept in the hash: `true` while the hash is `name`. */
export function useHashFlag(name: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => readHash() === name);
  const set = useCallback(
    (next: boolean) => {
      if (next) writeHash(name);
      else if (readHash() === name) writeHash(null);
      setOpen(next);
    },
    [name],
  );
  return [open, set];
}
