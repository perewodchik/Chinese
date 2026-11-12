import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ADMIN_ACTIONS, type AdminLogEntry } from '../../../shared/admin';
import { adminLog } from '../../api/admin';
import { ApiError } from '../../api/http';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { messageFor } from '../auth/messages';
import './admin.css';

/** What was done, in words; the account it was done to follows. */
const ACTION: Record<string, string> = {
  'invite-made': 'Invitation made',
  'account-made': 'Account made:',
  'password-reset': 'Password reset for',
  'role-granted': 'Made an admin:',
  'role-revoked': 'No longer an admin:',
  blocked: 'Paused:',
  unblocked: 'Opened again:',
  'signed-out': 'Signed out everywhere:',
};

const when = (at: number) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The details worth a line: an invitation's note and how long it was good for. */
function detailsOf(e: AdminLogEntry): string | null {
  const parts: string[] = [];
  if (typeof e.details.note === 'string' && e.details.note) parts.push(`for ${e.details.note}`);
  if (e.action === 'invite-made' && 'days' in e.details) parts.push(e.details.days ? `good for ${e.details.days} days` : 'good with no end');
  if (typeof e.details.reason === 'string' && e.details.reason) parts.push(`because: ${e.details.reason}`);
  return parts.length ? parts.join(', ') : null;
}

/**
 * What the accounts that run the site did, and what the server's commands
 * did, newest first, fifty at a time: invitations, roles, pauses, passwords
 * reset. Narrowed by what was done and by a name (who did it or to whom).
 *
 * States: loading; not an admin (said plainly); failed (said, with the
 * filters still there); nothing yet; nothing that matches; a page; more
 * being loaded (the button says so); more failed (said under the list).
 */
export function AdminLogPage() {
  useTitle('What admins did');
  const [action, setAction] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState({ action: '', name: '' });
  const [entries, setEntries] = useState<AdminLogEntry[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [more, setMore] = useState(false);
  // The answer to the latest question only: a slow page for an old filter is dropped.
  const asked = useRef(0);

  // A name is looked for once typing stops, not at every letter.
  useEffect(() => {
    const t = setTimeout(() => setQuery({ action, name: name.trim() }), name.trim() === query.name ? 0 : 350);
    return () => clearTimeout(t);
  }, [action, name, query.name]);

  useEffect(() => {
    const id = ++asked.current;
    setEntries(null);
    setError(null);
    adminLog({ action: query.action || undefined, name: query.name || undefined }).then(
      (page) => {
        if (id !== asked.current) return;
        setEntries(page.entries);
        setNext(page.next);
      },
      (err: unknown) => {
        if (id !== asked.current) return;
        if (err instanceof ApiError && err.status === 403) setDenied(true);
        else setError(messageFor(err));
      },
    );
  }, [query]);

  async function loadMore() {
    if (next === null || more) return;
    const id = asked.current;
    setMore(true);
    setError(null);
    try {
      const page = await adminLog({ action: query.action || undefined, name: query.name || undefined, before: next });
      if (id !== asked.current) return;
      setEntries((list) => [...(list ?? []), ...page.entries]);
      setNext(page.next);
    } catch (err) {
      if (id === asked.current) setError(messageFor(err));
    } finally {
      setMore(false);
    }
  }

  const head = (
    <header className="page-head">
      <Link className="back-link" to={paths.admin()}>
        <Icon name="back" />
        Admin
      </Link>
    </header>
  );

  if (denied) {
    return (
      <section className="admin-page">
        {head}
        <h1>What admins did</h1>
        <p className="small muted">This page is for whoever runs the site.</p>
      </section>
    );
  }

  const filtered = Boolean(query.action || query.name);
  return (
    <section className="admin-page">
      {head}
      <h1>What admins did</h1>
      <p className="small muted admin-log-lede">Invitations, roles, pauses and passwords reset, on the site and by the server’s own commands. Kept a year.</p>

      <div className="admin-log-filters">
        <label className="field">
          What
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Everything</option>
            {ADMIN_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {(ACTION[a] ?? a).replace(/:$/, '').replace(/ for$/, '')}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Who, by or to
          <input type="search" name="name" autoComplete="off" placeholder="A name" value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>

      <div className="admin-log">
        {entries === null ? (
          <p className="small muted">{error ?? 'Loading…'}</p>
        ) : entries.length === 0 ? (
          <p className="small muted">{filtered ? 'Nothing that matches.' : 'Nothing yet.'}</p>
        ) : (
          <ul className="list admin-list">
            {entries.map((e) => {
              const details = detailsOf(e);
              return (
                <li key={e.id} className="admin-row">
                  <span>
                    <b>{ACTION[e.action] ?? e.action}</b>
                    {e.target ? ` ${e.target}` : ''}
                    {details ? <span className="muted">, {details}</span> : null}
                  </span>
                  <span className="small muted">
                    by {e.actor} · {when(e.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {entries !== null && error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {entries !== null && next !== null && (
          <button className="btn tonal admin-log-more" onClick={() => void loadMore()} disabled={more}>
            {more ? 'Loading…' : 'Show older'}
          </button>
        )}
      </div>
    </section>
  );
}
