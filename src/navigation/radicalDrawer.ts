import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * The radical drawer lives in the address, as `?radical=61`.
 *
 * The same arrangement as the character drawer (itemDrawer.ts) and for the same
 * reasons: it opens over the page you are on, survives a reload, and closes
 * with the back button — which on an iPad is a swipe in from the edge.
 */

const PARAM = 'radical';

interface DrawerState {
  drawer?: boolean;
}

export function useOpenRadical(): (n: number) => void {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  return useCallback(
    (n: number) => {
      const params = new URLSearchParams(search);
      params.set(PARAM, String(n));
      const state: DrawerState = { drawer: true };
      navigate({ pathname, search: `?${params}` }, { state, preventScrollReset: true });
    },
    [navigate, pathname, search],
  );
}

export function useRadicalDrawer(): { radical: number | null; close: () => void } {
  const navigate = useNavigate();
  const location = useLocation();
  const raw = new URLSearchParams(location.search).get(PARAM);
  const n = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

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

  return { radical: n !== null && n >= 1 && n <= 214 ? n : null, close };
}
