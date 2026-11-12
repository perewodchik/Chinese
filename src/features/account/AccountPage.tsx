import { useMemo } from 'react';
import { Link } from 'react-router';
import { isWordId, type ItemId } from '../../domain/ids';
import { levelOf } from '../../domain/memory';
import { HSK_BANDS } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import type { SyncStatus } from '../../store/sync/engine';
import { useStore, useSyncStatus } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useIsAdmin, useUser } from '../auth/session';
import { useSignOut } from '../auth/useSignOut';
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

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/**
 * The account, about the person (P12): who, since when, the level (changed
 * here), what they have so far in one line, and the way to everything else —
 * Security, Your data, Progress, Settings, and Admin for an admin. Sign out
 * at the foot. The keys and what they cost are in Settings › Keys & services.
 */
export function AccountPage() {
  useTitle('Account');
  const user = useUser();
  const status = useSyncStatus();
  const admin = useIsAdmin();
  const level = useStore((s) => s.settings.targetHsk);
  const recall = useStore((s) => s.recall);
  const textsRead = useStore((s) => s.texts.filter((t) => t.read).length);
  const { leave, leaving } = useSignOut();
  // Met at least once, by review or by a claim: the count Progress starts from.
  const met = useMemo(() => {
    const now = Date.now();
    let chars = 0;
    let words = 0;
    for (const id in recall) {
      if (levelOf(recall[id as ItemId], now) === 0) continue;
      if (isWordId(id as ItemId)) words++;
      else chars++;
    }
    return { chars, words };
  }, [recall]);

  const rows: Array<{ to: string; label: string; blurb: string }> = [
    { to: paths.accountSecurity(), label: 'Security', blurb: 'Password, recovery codes, devices, access tokens' },
    { to: paths.accountData(), label: 'Your data', blurb: 'A copy to download, deleting your work or the account' },
    { to: paths.stats(), label: 'Progress', blurb: 'What you know, day by day and week by week' },
    { to: paths.settings(), label: 'Settings', blurb: 'Learning, speaking, keys, printing, the look' },
    ...(admin ? [{ to: paths.admin(), label: 'Admin', blurb: 'Invitations, the accounts, the catalogue, the log' }] : []),
  ];

  return (
    <section className="account-page">
      <div className="page-head">
        <h1>{user.username}</h1>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Learning since {new Date(user.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
      </p>
      <p className="small muted ac-sync">{whereWorkIs(status)}</p>

      <section className="block ac-who">
        <label className="field ac-level">
          Your level
          <select value={level} onChange={(e) => setSettings({ targetHsk: Number(e.target.value) })}>
            {HSK_BANDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <Link className="ac-sum" to={paths.stats()}>
          {plural(met.chars, 'character')} · {plural(met.words, 'word')} · {plural(textsRead, 'text')} read
          <Icon name="chevron" size={16} />
        </Link>
      </section>

      <nav className="block list ac-links" aria-label="Your account">
        {rows.map((r) => (
          <Link key={r.to} className="ac-link" to={r.to}>
            <span className="grow">
              <b>{r.label}</b>
              <span className="small muted">{r.blurb}</span>
            </span>
            <Icon name="chevron" />
          </Link>
        ))}
      </nav>

      <button className="btn quiet ac-signout" onClick={() => void leave()} disabled={leaving}>
        {leaving ? 'Signing out…' : 'Sign out'}
      </button>
    </section>
  );
}
