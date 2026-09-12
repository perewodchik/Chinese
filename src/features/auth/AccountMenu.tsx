import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { paths } from '../../navigation/paths';
import { useUser } from './session';
import { useSignOut } from './useSignOut';

/** Who is signed in, and the way out. */
export function AccountMenu() {
  const user = useUser();
  const { leave, leaving } = useSignOut();
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
    <div className="account" ref={root}>
      <button
        className="account-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Signed in as ${user.username}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden>
          {[...user.username][0]?.toUpperCase()}
        </span>
        <span className="account-name">{user.username}</span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="tiny muted">Signed in as</div>
          <b className="account-who">{user.username}</b>
          <Link role="menuitem" className="btn ghost sm" to={paths.settings()} onClick={() => setOpen(false)}>
            Account and settings
          </Link>
          <button role="menuitem" className="btn ghost sm" onClick={() => void leave()} disabled={leaving}>
            {leaving ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
