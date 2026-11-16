import { useState, type FormEvent } from 'react';
import type { AdminAccount } from '../../../shared/admin';
import { blockAccount, makeResetLink, signOutAccount, unblockAccount } from '../../api/admin';
import { copyText } from '../../platform/clipboard';
import { paths } from '../../navigation/paths';
import { ApiError } from '../../api/http';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Menu } from '../../ui/Menu';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';
import { NotConfirmed } from '../auth/useFreshPassword';
import { day, mb, plural } from './format';

/**
 * One account on the site's page, with what an admin can do to it in its ⋯
 * menu: a link for them to set a new password (A6, shown once in the row),
 * sign it out everywhere (its tokens too), pause it (with the reason,
 * asked in the row), open it again. Nothing for the admin's own row, which
 * is looked after from the account page.
 *
 * States: as listed (paused said in the line); the menu open; asking why
 * (the reason's field and Pause, in the row); working (the buttons wait);
 * refused (said in the row, on the field when it is the reason's); done
 * (the page reloads the list, and a toast says what happened).
 */
export function AdminAccountRow({
  account: a,
  self,
  confirm,
  onChanged,
}: {
  account: AdminAccount;
  self: boolean;
  /** runs an action, asking for the password again first when the server wants it (useFreshPassword) */
  confirm: <T>(run: () => Promise<T>) => Promise<T>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // A6: the reset link, shown here once — the server keeps only its digest.
  const [resetLink, setResetLink] = useState<{ url: string; expiresAt: number } | null>(null);

  async function makeLink() {
    setBusy(true);
    setError(null);
    try {
      const made = await confirm(() => makeResetLink(a.id));
      setResetLink({ url: `${window.location.origin}${paths.resetPassword(made.code)}`, expiresAt: made.expiresAt });
    } catch (err) {
      if (!(err instanceof NotConfirmed)) setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function act(run: () => Promise<unknown>, said: string) {
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await confirm(run);
      setAsking(false);
      setReason('');
      toast(said);
      onChanged();
    } catch (err) {
      if (err instanceof NotConfirmed) return;
      if (err instanceof ApiError && err.fields.reason) setFieldError(err.fields.reason);
      else setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  function pause(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim() || busy) return;
    void act(() => blockAccount(a.id, reason.trim()), `${a.username} is paused and signed out everywhere`);
  }

  const paused = a.status === 'blocked';
  return (
    <li className="admin-row admin-account">
      <div className="admin-account-head">
        <span className="admin-account-who">
          <b>{a.username}</b>
          {a.role === 'admin' && <span className="small muted"> runs the site</span>}
          <span className="small muted admin-account-meta">
            {paused ? 'Paused · ' : ''}
            {a.lastSeenAt ? `Last here ${day(a.lastSeenAt)}` : 'Not signed in anywhere'} · {plural(a.devices, 'device')} · {mb(a.storageBytes)}
            {a.scoredThisMonth || a.charactersReadThisMonth
              ? ` · this month ${plural(a.scoredThisMonth, 'phrase')} scored, ${plural(a.charactersReadThisMonth, 'character')} read`
              : ''}
            {` · since ${day(a.createdAt)}`}
          </span>
        </span>
        {!self && (
          <Menu label={<Icon name="more" size={20} />} title={`What to do with ${a.username}`} className="icon-btn">
            {(close) => (
              <>
                {!paused && (
                  <button role="menuitem" className="btn ghost sm" disabled={busy} onClick={() => (close(), void makeLink())}>
                    Make a reset link…
                    <span className="tiny muted">for them to set a new password; you never see it</span>
                  </button>
                )}
                <button role="menuitem" className="btn ghost sm" disabled={busy} onClick={() => (close(), void act(() => signOutAccount(a.id), `${a.username} is signed out everywhere`))}>
                  Sign out everywhere
                  <span className="tiny muted">every device, and its access tokens</span>
                </button>
                {paused ? (
                  <button role="menuitem" className="btn ghost sm" disabled={busy} onClick={() => (close(), void act(() => unblockAccount(a.id), `${a.username} can sign in again`))}>
                    Open it again
                    <span className="tiny muted">it can sign in as before</span>
                  </button>
                ) : (
                  <button role="menuitem" className="btn ghost sm" disabled={busy} onClick={() => (close(), setAsking(true))}>
                    Pause the account…
                    <span className="tiny muted">signed out, and no signing in until opened again</span>
                  </button>
                )}
              </>
            )}
          </Menu>
        )}
      </div>
      {asking && (
        <form className="admin-pause" onSubmit={pause} noValidate>
          <Field label="Why" hint="For the log. The account is not told." error={fieldError}>
            <input
              name="reason"
              autoComplete="off"
              maxLength={300}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setFieldError(null);
              }}
            />
          </Field>
          <div className="row">
            <button className="btn danger" type="submit" disabled={!reason.trim() || busy}>
              {busy ? 'Pausing…' : 'Pause the account'}
            </button>
            <button className="btn quiet" type="button" onClick={() => setAsking(false)} disabled={busy}>
              Not now
            </button>
          </div>
        </form>
      )}
      {resetLink && (
        <div className="admin-pause admin-reset">
          <p className="small" style={{ margin: 0 }}>
            Send this to {a.username} yourself. It works once, until {new Date(resetLink.expiresAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}, and
            signs them out everywhere when used. It is not shown again.
          </p>
          <input readOnly value={resetLink.url} onFocus={(e) => e.target.select()} aria-label="Reset link" />
          <div className="row">
            <button className="btn tonal" type="button" onClick={() => void copyText(resetLink.url).then((ok) => toast(ok ? 'Copied' : 'Select the link and copy it by hand'))}>
              Copy the link
            </button>
            <button className="btn quiet" type="button" onClick={() => setResetLink(null)}>
              Done
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
