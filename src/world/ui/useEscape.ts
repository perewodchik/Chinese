import { useEffect, useRef } from 'react';

/**
 * Esc closes the drawer on top, not the whole menu (§10 P4). Drawers stack —
 * a quest's drawer over a person's — so they register here in the order
 * they open, and one key listener, ahead of the page's own (capture), closes
 * only the last. With no drawer open, Esc goes on to close the menu.
 */
const open: (() => void)[] = [];
let listening = false;

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !open.length) return;
  e.stopPropagation();
  e.preventDefault();
  open[open.length - 1]!();
}

export function useEscape(onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const close = () => latest.current();
    open.push(close);
    if (!listening) {
      window.addEventListener('keydown', onKey, true);
      listening = true;
    }
    return () => {
      open.splice(open.indexOf(close), 1);
    };
  }, []);
}
