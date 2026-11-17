import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { AdminOverview } from '../../../shared/admin';
import { ApiError } from '../../api/http';
import { adminOverview, makeInvite, revokeInvite } from '../../api/admin';
import { deviceName } from '../../domain/device';
import { paths } from '../../navigation/paths';
import { copyText } from '../../platform/clipboard';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { messageFor } from '../auth/messages';
import { useUser } from '../auth/session';
import { NotConfirmed, useFreshPassword } from '../auth/useFreshPassword';
import { AdminAccounts } from './AdminAccounts';
import { SiteSettingsBlock } from './SiteSettingsBlock';
import { CostsBlock } from './CostsBlock';
import { day, mb, plural } from './format';
import './admin.css';


const when = (at: number) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });

/** What happened, in words. */
const EVENT: Record<string, string> = {
  'sign-in': 'Signed in',
  'sign-in-refused': 'Wrong password for',
  'sign-up': 'New account',
  recovery: 'New password from a recovery code',
  'recovery-refused': 'Wrong recovery code for',
  password: 'Password changed',
  deleted: 'Account deleted',
  invite: 'Invitation made by',
  'token-made': 'Access token made by',
  'token-revoked': 'Access token revoked by',
  'reauth-refused': 'Wrong password, asked again, for',
  reset: 'New password from a reset link',
  'reset-refused': 'A reset link that did not work',
  'rate-limited': 'Too many at once, held back:',
  'key-saved': 'Service key saved by',
  'key-removed': 'Service key removed by',
  exported: 'Copy of the data taken by',
};

/** SEC15: refused sign-ins in a day past this are worth saying in the teacher's red. */
const REFUSED_ALARM = 20;

const DAYS = [
  { value: 7, label: 'A week' },
  { value: 14, label: 'Two weeks' },
  { value: 30, label: 'A month' },
  { value: 0, label: 'No end' },
];

/**
 * The site's own page, for the accounts that run it (role `admin`): an
 * invitation made from the phone, the accounts with how much each keeps and
 * spends, and the invitations given out. Names, dates and sizes only —
 * nobody's work.
 *
 * States: loading; not an admin (said plainly); the overview; an invitation
 * being made; made (the link to copy, until the next one); refused.
 */
export function AdminPage() {
  useTitle('Admin');
  const toast = useToast();
  const user = useUser();
  const { confirm, sheet } = useFreshPassword();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ code: string; link: string; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    adminOverview().then(setData, (err: unknown) =>
      setDenied(err instanceof ApiError && err.status === 403 ? 'This page is for whoever runs the site.' : messageFor(err)),
    );
  useEffect(() => {
    void load();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { code } = await confirm(() => makeInvite(note, days));
      setMade({ code, note, link: `${location.origin}${paths.register()}?invite=${code}` });
      setNote('');
      void load();
    } catch (err) {
      if (!(err instanceof NotConfirmed)) setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function takeBack(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await confirm(() => revokeInvite(id));
      toast('Taken back: the code no longer makes an account');
      void load();
    } catch (err) {
      if (!(err instanceof NotConfirmed)) toast(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <section className="admin-page">
        <div className="page-head">
          <h1>Admin</h1>
        </div>
        <p className="small muted">{denied}</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      {sheet}
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {data
          ? `${plural(data.accountsTotal, 'account')}. New accounts ${data.registration === 'invite' ? 'by invitation' : data.registration === 'open' ? 'open to anyone' : 'switched off'}${data.storageLimitBytes ? `; each keeps up to ${mb(data.storageLimitBytes)}` : ''}.`
          : 'Loading…'}
      </p>
      {/* SEC15: what is worth a look today, one line, in red only when it is many or an admin's new browser. */}
      {data && <WatchLine watch={data.watch} />}

      <section className="block">
        <h2 className="block-title">Invite someone</h2>
        <form className="admin-invite" onSubmit={invite} noValidate>
          <label className="field">
            Who it is for
            <input type="text" name="note" value={note} placeholder="Masha" maxLength={120} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="field">
            Good for
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Making it…' : 'Make an invitation'}
          </button>
        </form>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {made && (
          <div className="admin-made">
            <p className="small" style={{ margin: 0 }}>
              {made.note ? `For ${made.note}: ` : ''}one account, with the code <b className="admin-code">{made.code}</b>. Send the link; it arrives with the code typed in. It is shown this once.
            </p>
            <span className="small admin-link">{made.link}</span>
            <button
              className="btn tonal"
              onClick={() => void copyText(made.link).then((ok) => toast(ok ? 'The link is copied' : 'Could not copy it: select it and copy it by hand'))}
            >
              Copy the link
            </button>
          </div>
        )}
      </section>

      <SiteSettingsBlock confirm={confirm} onChanged={() => void load()} />

      <CostsBlock />

      {data && <AdminAccounts first={data.accounts} total={data.accountsTotal} selfId={user.id} confirm={confirm} onChanged={() => void load()} />}

      <section className="block">
        <h2 className="block-title">Lately</h2>
        {data && data.events.length === 0 ? (
          <p className="small muted">Nothing yet.</p>
        ) : (
          <ul className="list admin-list">
            {(data?.events ?? []).map((e, i) => (
              <li key={`${e.at}-${i}`} className="admin-row">
                <span>
                  <b data-state={e.kind.endsWith('-refused') ? 'wrong' : undefined} className="admin-kind">
                    {EVENT[e.kind] ?? e.kind}
                  </b>{' '}
                  {e.username}
                </span>
                <span className="small muted">
                  {when(e.at)} · {deviceName(e.userAgent)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="block list" aria-label="More about the site">
        <Link className="admin-nav" to={paths.adminLog()}>
          <span className="grow">
            <b>What admins did</b>
            <span className="small muted">Invitations, roles, pauses and passwords reset, a year of them</span>
          </span>
          <Icon name="chevron" />
        </Link>
        <Link className="admin-nav" to={paths.adminFeedback()}>
          <span className="grow">
            <b>Feedback</b>
            <span className="small muted">What learners sent from the site, and where each stands</span>
          </span>
          <Icon name="chevron" />
        </Link>
      </nav>

      <section className="block">
        <h2 className="block-title">Invitations</h2>
        {data && data.invites.length === 0 ? (
          <p className="small muted">None given out yet.</p>
        ) : (
          <ul className="list admin-list">
            {(data?.invites ?? []).map((i) => (
              <li key={i.id} className="admin-row admin-invite-row">
                <span className="grow">
                  <b>{i.note || 'For someone'}</b>
                  <span className="small muted">
                    Made {day(i.createdAt)}
                    {i.createdBy ? ` by ${i.createdBy}` : ''} ·{' '}
                    {i.usedBy
                      ? `used by ${i.usedBy} on ${day(i.usedAt!)}`
                      : i.revokedAt
                        ? `taken back ${day(i.revokedAt)}`
                        : i.expiresAt && i.expiresAt <= Date.now()
                          ? 'ran out unused'
                          : i.expiresAt
                            ? `good until ${day(i.expiresAt)}`
                            : 'good with no end'}
                  </span>
                </span>
                {/* A8: one still good can be taken back, in case the link went to the wrong person. */}
                {!i.usedBy && !i.revokedAt && !(i.expiresAt && i.expiresAt <= Date.now()) && (
                  <button className="btn quiet sm" disabled={busy} onClick={() => void takeBack(i.id)}>
                    Take back
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function WatchLine({ watch }: { watch: AdminOverview['watch'] }) {
  const alarm = watch.refusedToday > REFUSED_ALARM || watch.newAdminDevices.length > 0;
  return (
    <p className="small admin-watch" data-state={alarm ? 'wrong' : undefined}>
      In the last day: {plural(watch.refusedToday, 'refused sign-in')}
      {watch.limitedToday ? `, ${plural(watch.limitedToday, 'limit')} reached` : ''}.
      {watch.newAdminDevices.map((d) => ` ${d.username} signed in from a new browser (${deviceName(d.userAgent)}) at ${new Date(d.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`)}
    </p>
  );
}

