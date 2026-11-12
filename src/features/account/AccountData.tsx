import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { accountStorage } from '../../api/account';
import { paths } from '../../navigation/paths';
import { resetWorkspace } from '../../store/commands';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { useSyncStatus } from '../../store/store';
import type { SyncStatus } from '../../store/sync/engine';
import { useTitle } from '../../ui/useTitle';
import { DeleteAccount } from './DeleteAccount';
import './account.css';

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function whereWorkIs(status: SyncStatus | null): string {
  if (!status) return '';
  switch (status.phase) {
    case 'saved':
      return `Everything is saved to your account${status.lastSavedAt ? ` — last at ${time(status.lastSavedAt)}` : ''}. Sign in on another device and it is all there.`;
    case 'pending':
    case 'saving':
      return 'Saving your latest changes to your account…';
    case 'offline':
      return `${status.unsaved} change${status.unsaved === 1 ? ' is' : 's are'} kept on this device until the server can be reached again.`;
    case 'failing':
      return `The last save did not go through (${status.message ?? 'no reason given'}). Trying again shortly.`;
    case 'signed-out':
      return 'Signed out. Sign in again and anything unsaved goes to the server.';
  }
}

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes < MB ? '<1' : Math.round(bytes / MB).toLocaleString('en'));

/**
 * /account/data (P12, P16): how much the account keeps, a copy to download,
 * deleting all the work, and deleting the account.
 */
export function AccountData() {
  useTitle('Your data');
  const status = useSyncStatus();
  return (
    <section className="account-page">
      <header className="page-head">
        <Link className="back-link" to={paths.account()}>
          <Icon name="back" />
          Account
        </Link>
      </header>
      <h1>Your data</h1>
      {/* The one place that says whether the work is saved; More shows a dot when it is not (P18). */}
      <p className="small muted ac-sync">{whereWorkIs(status)}</p>

      <section className="block">
        <h2 className="block-title">Your work</h2>
        <StorageLine />
        <p className="small muted ac-copy-lede">
          Your texts, shelves, cards, lists and progress are kept in your account and saved as you go, the same on every
          device you sign in on. A copy to keep: all of that, the walk through Beijing, your conversations, tries and
          narrators, in one file. Not your keys, recordings or pictures.
        </p>
        <a className="btn tonal" href="/api/account/export" download>
          Download a copy
        </a>
      </section>

      <DeleteWork />

      <DeleteAccount />
    </section>
  );
}

/**
 * Deleting all the work, kept apart from deleting the account (P16): folded
 * away, then the word "delete" typed, with the copy to download offered
 * first — the same shape as deleting the account, never one tap.
 *
 * States: folded; open (the button waits for the word); deleted (a toast,
 * folded again).
 */
function DeleteWork() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const ready = word.trim().toLowerCase() === 'delete';
  return (
    <section className="block">
      <h2 className="block-title">Start again</h2>
      {!open ? (
        <>
          <p className="small muted ac-copy-lede">Everything you have done goes, on every device; the account stays, with nothing in it.</p>
          <button className="btn danger" aria-expanded={false} onClick={() => setOpen(true)}>
            Delete all my work…
          </button>
        </>
      ) : (
        <form
          className="ac-delete"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            resetWorkspace();
            setOpen(false);
            setWord('');
            toast('Everything in this account was deleted');
          }}
        >
          <p className="small" style={{ margin: 0 }}>
            Your texts, shelves, cards, lists and progress are deleted for good, on every device.{' '}
            <a href="/api/account/export" download>
              Download a copy
            </a>{' '}
            first if you want to keep any of it.
          </p>
          <label className="field">
            Type delete to confirm
            <input type="text" name="confirm-word" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={word} onChange={(e) => setWord(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn danger" type="submit" disabled={!ready}>
              Delete all my work
            </button>
            <button className="btn quiet" type="button" aria-expanded onClick={() => setOpen(false)}>
              Keep it
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/** How much the account keeps on the server, against its ceiling: a line, and a bar when there is a ceiling. */
function StorageLine() {
  const [use, setUse] = useState<{ usedBytes: number; limitBytes: number | null } | null>(null);
  useEffect(() => {
    let live = true;
    accountStorage().then(
      (u) => live && setUse(u),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  const share = use?.limitBytes ? Math.min(1, use.usedBytes / use.limitBytes) : 0;
  return (
    <div className="ac-storage">
      <span className="small">
        {use === null
          ? ' '
          : use.limitBytes
            ? `It takes ${mb(use.usedBytes)} MB of the ${mb(use.limitBytes)} MB an account keeps here.`
            : `It takes ${mb(use.usedBytes)} MB here.`}
      </span>
      <span className="ac-storage-bar" aria-hidden data-hidden={use?.limitBytes ? undefined : ''}>
        <i style={{ width: `${share * 100}%` }} />
      </span>
    </div>
  );
}
