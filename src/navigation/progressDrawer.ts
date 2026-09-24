import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * The progress panel lives in the address, as `?progress`.
 *
 * The same arrangement as the character and radical drawers (itemDrawer.ts,
 * radicalDrawer.ts): it opens over the page you are on from the meter in the
 * header, survives a reload, and closes with the back button — which on an
 * iPad is a swipe in from the edge.
 */

const PARAM = 'progress';

interface DrawerState {
  drawer?: boolean;
}

export function useOpenProgress(): () => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  return useCallback(() => {
    const params = new URLSearchParams(search);
    if (params.has(PARAM)) return;
    params.set(PARAM, '');
    const state: DrawerState = { drawer: true };
    navigate({ pathname, search: `?${params}` }, { state, preventScrollReset: true });
  }, [navigate, pathname, search]);
}

export function useProgressDrawer(): { open: boolean; close: () => void } {
  const navigate = useNavigate();
  const location = useLocation();
  const open = new URLSearchParams(location.search).has(PARAM);

  const close = useCallback(() => {
    if ((location.state as DrawerState | null)?.drawer) {
      navigate(-1);
      return;
    }
    // Arrived with it already open — a reload, a shared link — so there is
    // nothing to go back to: take the parameter off where it is.
    const params = new URLSearchParams(location.search);
    params.delete(PARAM);
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true, preventScrollReset: true },
    );
  }, [navigate, location]);

  return { open, close };
}
