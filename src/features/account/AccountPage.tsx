import { useEffect, useMemo, useState } from 'react';
import { authApi } from '../../api/auth';
import { Link } from 'react-router';
import { dayKey } from '../../domain/activity';
import { isWordId, type ItemId } from '../../domain/ids';
import { levelOf } from '../../domain/memory';
import { HSK_BANDS } from '../../domain/text';
import { paths } from '../../navigation/paths';
import { setSettings } from '../../store/commands';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useIsAdmin, useUser } from '../auth/session';
import { useSignOut } from '../auth/useSignOut';
import './account.css';

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

/**
 * The account, about the person (P12): who, since when, the level (changed
 * here), what they have so far in one line, and the way to everything else —
 * Security, Your data, Progress, Settings, and Admin for an admin. Sign out
 * at the foot. The keys and what they cost are in Settings › Keys & services.
 */
/**
 * With no recovery codes and no e-mail, a forgotten password is a lost
 * account: said once, quietly, until there are codes (P17).
 */
function RecoveryNudge() {
  const [none, setNone] = useState(false);
  useEffect(() => {
    let live = true;
    authApi.recoveryStatus().then(
      (s) => live && setNone(s === null),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  if (!none) return null;
  return (
    <Link className="small ac-nudge" to={paths.accountSecurity()}>
      No way back in if you forget the password: make recovery codes
    </Link>
  );
}

export function AccountPage() {
  useTitle('Account');
  const user = useUser();
  const admin = useIsAdmin();
  const level = useStore((s) => s.settings.targetHsk);
  const recall = useStore((s) => s.recall);
  const textsRead = useStore((s) => s.texts.filter((t) => t.read).length);
  const goal = useStore((s) => (s.settings.dailyGoal === 'minutes' ? s.settings.goalMinutes : null));
  const minutesToday = useStore((s) => Math.round((s.activity[dayKey(Date.now())]?.ms ?? 0) / 60_000));
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
      <RecoveryNudge />

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
        {/* The day's goal, where one is set (P15): Settings › Learning sets it. */}
        {goal !== null && (
          <span className="small ac-today-goal">
            Today {minutesToday} of {goal} minutes{minutesToday >= goal ? ': the day counts.' : '.'}
          </span>
        )}
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
