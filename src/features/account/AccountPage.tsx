import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { USAGE_UNIT, type UsageLine, type UsageResponse, type UsageService } from '../../../shared/usage';
import { accountStorage, accountUsage } from '../../api/account';
import { paths } from '../../navigation/paths';
import type { SyncStatus } from '../../store/sync/engine';
import { useSyncStatus } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { ChangePasswordForm } from '../auth/ChangePasswordForm';
import { useIsAdmin, useUser } from '../auth/session';
import { AccessTokens } from './AccessTokens';
import { DeleteAccount } from './DeleteAccount';
import { Devices } from './Devices';
import { RecoveryCodes } from './RecoveryCodes';
import { TwoStep } from './TwoStep';
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

const SERVICE: Record<UsageService, { name: string; calls: [string, string]; balance: string; site: string }> = {
  speechsuper: { name: 'SpeechSuper', calls: ['phrase scored', 'phrases scored'], balance: 'https://www.speechsuper.com/', site: 'speechsuper.com' },
  iflytek: { name: 'iFlytek', calls: ['phrase scored', 'phrases scored'], balance: 'https://console.xfyun.cn/', site: 'console.xfyun.cn' },
  minimax: { name: 'MiniMax', calls: ['reading', 'readings'], balance: 'https://platform.minimax.io/', site: 'platform.minimax.io' },
};

const counted = (n: number, [one, many]: [string, string]) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

function amount(service: UsageService, units: number): string {
  if (USAGE_UNIT[service] === 'characters') return `${units.toLocaleString('en')} character${units === 1 ? '' : 's'} read`;
  if (units < 60) return `${units} s of speech`;
  return `${Math.round(units / 60).toLocaleString('en')} min of speech`;
}

/**
 * The account: who is signed in and where the work is kept, the password,
 * and what the learner's own keys have been spent on — counted by the server
 * as it makes each call, so the same on every device. The bill itself is the
 * service's: each line links to where it shows the balance.
 */
export function AccountPage() {
  useTitle('Account');
  const user = useUser();
  const status = useSyncStatus();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Whoever runs the site has a row for its own page; nobody else sees it.
  const admin = useIsAdmin();
  useEffect(() => {
    let live = true;
    accountUsage().then(
      (u) => live && setUsage(u),
      (err: Error) => live && setFailed(err.message),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="account-page">
      <div className="page-head">
        <h1>Account</h1>
      </div>
      <p className="small" style={{ margin: 0 }}>
        Signed in as <b>{user.username}</b>, since {new Date(user.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.
      </p>
      <p className="small muted ac-sync">{whereWorkIs(status)}</p>

      <section className="block">
        <h2 className="block-title">Your own keys this month</h2>
        <div className="ac-usage">
          {usage === null ? (
            <p className="small muted">{failed ?? 'Loading…'}</p>
          ) : usage.lines.length === 0 ? (
            <p className="small muted">
              No keys of your own are saved. Pronunciation checking uses SpeechSuper’s (in <Link to={paths.settings()}>Settings</Link>), and
              narrators MiniMax’s (in <Link to={paths.speakingNarrators()}>Speak › Voices</Link>).
            </p>
          ) : (
            <ul className="list">
              {usage.lines.map((l) => (
                <UsageRow key={l.service} line={l} />
              ))}
            </ul>
          )}
        </div>
        <p className="tiny muted ac-note">
          Counted by this site as it asks each service: a reading kept from before costs nothing and is not here. Days run
          midnight to midnight UTC. What you have left is on the service’s own page.
        </p>
      </section>

      <section className="block">
        <h2 className="block-title">Your work</h2>
        <StorageLine />
        <p className="small muted ac-copy-lede">
          A copy to keep: your texts, shelves, cards and progress, the walk through Beijing, your conversations, tries and
          narrators, in one file. Not your keys, recordings or pictures.
        </p>
        <a className="btn tonal" href="/api/account/export" download>
          Download a copy
        </a>
      </section>

      <section className="block">
        <h2 className="block-title">Password</h2>
        <ChangePasswordForm />
      </section>

      <TwoStep />

      <RecoveryCodes />

      <Devices />

      <AccessTokens />

      <nav className="block list ac-links" aria-label="More about you">
        <Link className="ac-link" to={paths.stats()}>
          <span className="grow">
            <b>Your progress</b>
            <span className="small muted">What you know, day by day and week by week</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link className="ac-link" to={paths.settings()}>
          <span className="grow">
            <b>Settings</b>
            <span className="small muted">Pronunciation, reading, printing, the look</span>
          </span>
          <Icon name="chevron" />
        </Link>
        {admin && (
          <Link className="ac-link" to={paths.admin()}>
            <span className="grow">
              <b>The site</b>
              <span className="small muted">Invitations, and the accounts with how much each keeps</span>
            </span>
            <Icon name="chevron" />
          </Link>
        )}
      </nav>

      <DeleteAccount />
    </section>
  );
}

function UsageRow({ line }: { line: UsageLine }) {
  const s = SERVICE[line.service];
  const most = Math.max(1, ...line.days.map((d) => d.calls));
  return (
    <li className="ac-row">
      <div className="ac-row-head">
        <b>{s.name}</b>
        {!line.keySet && <span className="tiny muted">no key saved now</span>}
        <span className="spacer" />
        <span className="small muted ac-today">Today {line.today.calls.toLocaleString('en')}</span>
      </div>
      <span className="small">
        {line.month.calls ? `${counted(line.month.calls, s.calls)} · ${amount(line.service, line.month.units)}` : 'Nothing yet this month'}
      </span>
      <span className="ac-days" aria-hidden>
        {line.days.map((d) => (
          <i key={d.day} title={`${d.day}: ${counted(d.calls, s.calls)}`} style={{ height: d.calls ? `${Math.max(12, (d.calls / most) * 100)}%` : undefined }} data-none={d.calls ? undefined : ''} />
        ))}
      </span>
      <a className="tiny ac-balance" href={s.balance} target="_blank" rel="noreferrer">
        Your balance at {s.site}
      </a>
    </li>
  );
}

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes < MB ? '<1' : Math.round(bytes / MB).toLocaleString('en'));

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
          ? '\u00a0'
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
