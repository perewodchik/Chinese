import { useCallback, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * The full-screen view of a character lives in the address, as `?view=好`,
 * for the same reasons the drawer does: it opens over any page, survives a
 * reload and closes with the back button.
 *
 * Moving to the next character replaces the address rather than adding to
 * it, so back closes the view instead of walking back through every
 * character looked at.
 */

const PARAM = 'view';

interface ViewState {
  view?: boolean;
}

/**
 * What the next and previous buttons walk through: the characters the page
 * underneath is showing, in its order and with its filter, set by that page.
 * Opened from anywhere else, the view holds the one character.
 */
let browse: readonly string[] = [];
const listeners = new Set<() => void>();

export function setBrowseList(chars: readonly string[]) {
  browse = chars;
  for (const l of listeners) l();
}

export function useBrowseList(): readonly string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => browse,
  );
}

export function useOpenViewer(): (char: string, opts?: { from?: 'item' }) => void {
  const navigate = useNavigate();
  const { pathname, search, state } = useLocation();
  return useCallback(
    (char: string, opts?: { from?: 'item' }) => {
      const params = new URLSearchParams(search);
      // From the drawer, the view takes its place; back goes to the drawer.
      if (opts?.from === 'item') params.delete('item');
      params.set(PARAM, char);
      navigate({ pathname, search: `?${params}` }, { state: { ...(state as object | null), view: true }, preventScrollReset: true });
    },
    [navigate, pathname, search, state],
  );
}

export function useCharViewer(): { char: string | null; show: (char: string) => void; close: () => void } {
  const navigate = useNavigate();
  const location = useLocation();
  const char = new URLSearchParams(location.search).get(PARAM);

  const show = useCallback(
    (next: string) => {
      const params = new URLSearchParams(location.search);
      params.set(PARAM, next);
      navigate({ pathname: location.pathname, search: `?${params}` }, { replace: true, state: location.state, preventScrollReset: true });
    },
    [navigate, location],
  );

  const close = useCallback(() => {
    if ((location.state as ViewState | null)?.view) {
      navigate(-1);
      return;
    }
    const params = new URLSearchParams(location.search);
    params.delete(PARAM);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true, preventScrollReset: true });
  }, [navigate, location]);

  return { char, show, close };
}
