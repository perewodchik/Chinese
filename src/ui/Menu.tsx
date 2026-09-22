import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  children,
}: {
  label: ReactNode;
  title?: string;
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
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
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className="menu" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
