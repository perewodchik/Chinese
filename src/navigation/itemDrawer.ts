import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { ItemId } from '../domain/ids';

/**
 * The character drawer lives in the address, as `?item=c好`.
 *
 * So it opens over whatever page you are on, survives a reload, and closes with
 * the back button — which on an iPad is a swipe in from the edge, the gesture
 * everybody tries first.
 */

const PARAM = 'item';

interface DrawerState {
  /** set when the drawer was opened from inside the app, so closing it can be going back */
  drawer?: boolean;
}

export function useOpenItem(): (id: ItemId) => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  return useCallback(
    (id: ItemId) => {
      const params = new URLSearchParams(search);
      params.set(PARAM, id);
      const state: DrawerState = { drawer: true };
      navigate({ pathname, search: `?${params}` }, { state, preventScrollReset: true });
    },
    [navigate, pathname, search],
  );
}

export function useItemDrawer(): { item: ItemId | null; close: () => void } {
  const navigate = useNavigate();
  const location = useLocation();
  const item = new URLSearchParams(location.search).get(PARAM);

  const close = useCallback(() => {
    if ((location.state as DrawerState | null)?.drawer) {
      navigate(-1);
      return;
    }
    // Arrived with the drawer already open — a reload, a shared link — so there
    // is nothing to go back to: take the parameter off where it is.
    const params = new URLSearchParams(location.search);
    params.delete(PARAM);
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true, preventScrollReset: true },
    );
  }, [navigate, location]);

  return { item, close };
}
