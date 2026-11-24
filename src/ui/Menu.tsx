import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A button that opens a short list of actions, closing on a tap outside it or
 * on Escape — the account menu's behaviour, for anything with a few actions
 * too rare to deserve a button of their own.
 *
 * `children` is given `close`, so an item can close the menu before doing
 * whatever it does (opening a dialog, navigating away).
 */
export function Menu({
  label,
  title,
  className = 'btn sm',
  up,
  floating,
  children,
}: {
  label: ReactNode;
  title?: string;
  className?: string;
  /** opens above the button: for one at the foot of the screen */
  up?: boolean;
  /**
   * placed on the screen rather than in its box: for a button inside something
   * that scrolls sideways (a shelf of books), which would clip the menu. It
   * opens under the button, or over it near the foot, and never past an edge.
   */
  floating?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties | undefined>(undefined);
  useLayoutEffect(() => {
    if (!open || !floating) return;
    const btn = root.current?.querySelector('button')?.getBoundingClientRect();
    const m = panel.current;
    if (!btn || !m) return;
    const w = m.offsetWidth;
    const h = m.offsetHeight;
    const left = Math.max(8, Math.min(btn.right - w, window.innerWidth - w - 8));
    const below = btn.bottom + 6;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, btn.top - h - 6) : below;
    setPlace({ position: 'fixed', left, top, right: 'auto', bottom: 'auto', zIndex: 60 });
  }, [open, floating]);
  useEffect(() => {
    if (!open || !floating) return;
    // The page moving under it would leave it behind: it closes, as a tap outside does.
    const away = () => setOpen(false);
    window.addEventListener('scroll', away, true);
    window.addEventListener('resize', away);
    return () => {
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('resize', away);
    };
  }, [open, floating]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={root}>
      <button
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        aria-label={title}
        onClick={() => {
          setPlace(undefined);
          setOpen((o) => !o);
        }}
      >
        {label}
      </button>
      {open &&
        (() => {
          const list = (
            <div ref={panel} className={up ? 'menu up' : 'menu'} role="menu" style={floating ? (place ?? { position: 'fixed', visibility: 'hidden', zIndex: 60 }) : undefined}>
              {children(() => setOpen(false))}
            </div>
          );
          // Floating, it is drawn at the end of the page, over everything: inside a shelf the next cover painted over it.
          return floating ? createPortal(list, document.body) : list;
        })()}
    </div>
  );
}
