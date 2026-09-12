import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/** Where each history entry was scrolled to, for as long as the page is open. */
const positions = new Map<string, number>();

/**
 * Scroll positions for a pane that scrolls instead of the window.
 *
 * The router's own restoration knows only about the window, and in this app the
 * window never scrolls: the header stays put and `.main` scrolls under it. So a
 * new page starts at the top, going back returns to where you were, and a
 * change to the query alone — a filter, the character drawer — leaves the page
 * exactly where it is.
 */
export function useScrollRestoration(pane: RefObject<HTMLElement | null>) {
  const location = useLocation();
  const navigation = useNavigationType();
  const shownPath = useRef(location.pathname);

  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const key = location.key;
    const remember = () => positions.set(key, el.scrollTop);
    el.addEventListener('scroll', remember, { passive: true });
    return () => el.removeEventListener('scroll', remember);
  }, [pane, location.key]);

  useLayoutEffect(() => {
    const el = pane.current;
    if (!el || location.pathname === shownPath.current) return;
    shownPath.current = location.pathname;
    el.scrollTop = navigation === 'POP' ? (positions.get(location.key) ?? 0) : 0;
  }, [pane, location.pathname, location.key, navigation]);
}
