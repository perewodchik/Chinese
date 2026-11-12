import { useEffect, useMemo, useState } from 'react';
import type { SessionDto } from '../../../shared/api';
import { accountSessions, signOutOthers, signOutSession } from '../../api/account';
import { deviceName } from '../../domain/device';
import { Icon } from '../../ui/Icon';
import { messageFor } from '../auth/messages';

const when = (at: number) => {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
};

/** The other sessions, one row per kind of device: "Safari on an iPhone × 3, last used today". */
function groupOthers(list: SessionDto[]): Array<{ name: string; sessions: SessionDto[]; lastSeenAt: number }> {
  const groups = new Map<string, SessionDto[]>();
  for (const s of list) {
    if (s.current) continue;
    const name = deviceName(s.userAgent);
    groups.set(name, [...(groups.get(name) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([name, sessions]) => ({ name, sessions, lastSeenAt: Math.max(...sessions.map((s) => s.lastSeenAt)) }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

/**
 * The browsers signed in to the account (P13): one line by default — this
 * device and how many others — with Sign out everywhere else; the others,
 * grouped by kind of device, unfold under it, each group with its own Sign
 * out.
 *
 * States: loading (room kept for the line); failed (said in its place); only
 * this one (no button, nothing to unfold); several, folded; unfolded; one
 * group being signed out (its button says so and the others wait); a group
 * gone once it is out.
 */
export function Devices() {
  const [list, setList] = useState<SessionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    accountSessions().then(
      (s) => live && setList(s),
      (err: unknown) => live && setError(messageFor(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  const groups = useMemo(() => groupOthers(list ?? []), [list]);
  const others = (list ?? []).filter((s) => !s.current).length;
  const current = (list ?? []).find((s) => s.current);

  async function out(name: string, sessions: SessionDto[]) {
    setBusy(name);
    setError(null);
    try {
      for (const s of sessions) await signOutSession(s.id);
      const ids = new Set(sessions.map((s) => s.id));
      setList((l) => (l ?? []).filter((s) => !ids.has(s.id)));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  async function everywhereElse() {
    setBusy('others');
    setError(null);
    try {
      await signOutOthers();
      setList((l) => (l ?? []).filter((s) => s.current));
      setOpen(false);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="block">
      <h2 className="block-title">Devices</h2>
      <div className="ac-devices">
        {list === null ? (
          <p className="small muted">{error ?? 'Loading…'}</p>
        ) : (
          <>
            <div className="ac-device">
              <span className="grow">
                <b>{current ? deviceName(current.userAgent) : 'This device'}</b>
                <span className="small muted">
                  This one{others ? ` · and ${others} other device${others === 1 ? '' : 's'}` : ', and no other'}
                </span>
              </span>
              {others > 0 && (
                <button className="btn quiet sm ac-device-unfold" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  {open ? 'Hide' : 'Show'}
                  <Icon name="chevron" size={14} className="ac-chevron" />
                </button>
              )}
            </div>
            {open && (
              <ul className="list ac-device-groups">
                {groups.map((g) => (
                  <li key={g.name} className="ac-device">
                    <span className="grow">
                      <b>
                        {g.name}
                        {g.sessions.length > 1 ? ` × ${g.sessions.length}` : ''}
                      </b>
                      <span className="small muted">Last used {when(g.lastSeenAt)}</span>
                    </span>
                    <button className="btn quiet sm ac-device-out" onClick={() => void out(g.name, g.sessions)} disabled={busy !== null}>
                      {busy === g.name ? 'Signing out…' : 'Sign out'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {others > 0 && (
              <button className="btn tonal sm" onClick={() => void everywhereElse()} disabled={busy !== null}>
                {busy === 'others' ? 'Signing out…' : 'Sign out everywhere else'}
              </button>
            )}
          </>
        )}
        {list !== null && error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
