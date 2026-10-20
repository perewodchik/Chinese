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
  /**
   * The entry on screen, moved over the moment a page is put up. A scroll
   * event comes a frame late: the one the new page's shorter content causes,
   * read against the old entry, wrote the top of the page over where the
   * learner had been — and going back to the Library landed at the top.
   */
  const shownKey = useRef(location.key);
  /** while a position is being put back, the scrolling is ours, not the learner's */
  const restoring = useRef(false);

  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const remember = () => {
      if (!restoring.current) positions.set(shownKey.current, el.scrollTop);
    };
    el.addEventListener('scroll', remember, { passive: true });
    return () => el.removeEventListener('scroll', remember);
  }, [pane]);

  useLayoutEffect(() => {
    const el = pane.current;
    shownKey.current = location.key;
    if (!el || location.pathname === shownPath.current) return;
    shownPath.current = location.pathname;
    const top = navigation === 'POP' ? (positions.get(location.key) ?? 0) : 0;
    el.scrollTop = top;
    if (top <= 0) return;
    // A page whose content arrives a moment later — a library of three
    // thousand characters — is not tall enough yet to scroll that far. Keep
    // putting it back for half a second, while it grows.
    restoring.current = true;
    const key = location.key;
    let frames = 0;
    const settle = () => {
      if (shownKey.current !== key) return;
      if (Math.abs(el.scrollTop - top) > 1 && frames++ < 30) {
        el.scrollTop = top;
        requestAnimationFrame(settle);
      } else {
        restoring.current = false;
      }
    };
    requestAnimationFrame(settle);
    return () => {
      restoring.current = false;
    };
  }, [pane, location.pathname, location.key, navigation]);
}
