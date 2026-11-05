import { useEffect, useState } from 'react';
import type { SessionDto } from '../../../shared/api';
import { accountSessions, signOutOthers, signOutSession } from '../../api/account';
import { deviceName } from '../../domain/device';
import { messageFor } from '../auth/messages';

const when = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

/**
 * The browsers signed in to the account, the one in hand first, each with its
 * own Sign out; and Sign out everywhere else when there is anywhere else.
 *
 * States: loading (room kept for two rows); failed (said in place of the
 * list); only this one (no button for the others); several; one being signed
 * out (its button says so and the others wait); a row gone once it is out.
 */
export function Devices() {
  const [list, setList] = useState<SessionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    accountSessions().then(
      (s) => live && setList([...s].sort((a, b) => Number(b.current) - Number(a.current))),
      (err: unknown) => live && setError(messageFor(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  async function out(id: string) {
    setBusy(id);
    setError(null);
    try {
      await signOutSession(id);
      setList((l) => (l ?? []).filter((s) => s.id !== id));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  async function others() {
    setBusy('others');
    setError(null);
    try {
      await signOutOthers();
      setList((l) => (l ?? []).filter((s) => s.current));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  const more = (list ?? []).filter((s) => !s.current).length;
  return (
    <section className="block">
      <div className="block-head">
        <h2 className="block-title">Devices</h2>
        <span className="spacer" />
        {more > 0 && (
          <button className="btn quiet sm" onClick={() => void others()} disabled={busy !== null}>
            {busy === 'others' ? 'Signing out…' : 'Sign out everywhere else'}
          </button>
        )}
      </div>
      <div className="ac-devices">
        {list === null ? (
          <p className="small muted">{error ?? 'Loading…'}</p>
        ) : (
          <ul className="list">
            {list.map((s) => (
              <li key={s.id} className="ac-device">
                <span className="grow">
                  <b>{deviceName(s.userAgent)}</b>
                  <span className="small muted">{s.current ? 'This one, now' : `Last used ${when(s.lastSeenAt)}`}</span>
                </span>
                {!s.current && (
                  <button className="btn quiet sm ac-device-out" onClick={() => void out(s.id)} disabled={busy !== null}>
                    {busy === s.id ? 'Signing out…' : 'Sign out'}
                  </button>
                )}
              </li>
            ))}
          </ul>
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
