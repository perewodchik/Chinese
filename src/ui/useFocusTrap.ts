import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * R18: Tab and Shift-Tab go round what is inside an open sheet or dialog
 * instead of walking off under it into the page behind; when it closes,
 * focus goes back to what opened it.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const at = document.activeElement;
      if (!ref.current.contains(at)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Back to what opened it, if it is still there to take focus.
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [ref]);
}
