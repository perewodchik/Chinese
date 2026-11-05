import { useEffect, useState, type FormEvent } from 'react';
import type { AdminOverview } from '../../../shared/admin';
import { ApiError } from '../../api/http';
import { adminOverview, makeInvite } from '../../api/admin';
import { deviceName } from '../../domain/device';
import { paths } from '../../navigation/paths';
import { copyText } from '../../platform/clipboard';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { messageFor } from '../auth/messages';
import './admin.css';

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
const MB = 1024 * 1024;
const mb = (b: number) => (b < MB ? '<1 MB' : `${Math.round(b / MB).toLocaleString('en')} MB`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;

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
};

const DAYS = [
  { value: 7, label: 'A week' },
  { value: 14, label: 'Two weeks' },
  { value: 30, label: 'A month' },
  { value: 0, label: 'No end' },
];

/**
 * The site's own page, for whoever runs it (HANZI_ADMIN_USERS): an
 * invitation made from the phone, the accounts with how much each keeps and
 * spends, and the invitations given out. Names, dates and sizes only —
 * nobody's work.
 *
 * States: loading; not an admin (said plainly); the overview; an invitation
 * being made; made (the link to copy, until the next one); refused.
 */
export function AdminPage() {
  useTitle('The site');
  const toast = useToast();
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
      const { code } = await makeInvite(note, days);
      setMade({ code, note, link: `${location.origin}${paths.register()}?invite=${code}` });
      setNote('');
      void load();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <section className="admin-page">
        <div className="page-head">
          <h1>The site</h1>
        </div>
        <p className="small muted">{denied}</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="page-head">
        <h1>The site</h1>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {data
          ? `${plural(data.accounts.length, 'account')}. New accounts ${data.registration === 'invite' ? 'by invitation' : data.registration === 'open' ? 'open to anyone' : 'switched off'}${data.storageLimitBytes ? `; each keeps up to ${mb(data.storageLimitBytes)}` : ''}.`
          : 'Loading…'}
      </p>

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

      <section className="block">
        <h2 className="block-title">Accounts</h2>
        <ul className="list admin-list">
          {(data?.accounts ?? []).map((a) => (
            <li key={a.username} className="admin-row">
              <b>{a.username}</b>
              <span className="small muted">
                {a.lastSeenAt ? `Last here ${day(a.lastSeenAt)}` : 'Not signed in anywhere'} · {plural(a.devices, 'device')} · {mb(a.storageBytes)}
                {a.scoredThisMonth || a.charactersReadThisMonth
                  ? ` · this month ${plural(a.scoredThisMonth, 'phrase')} scored, ${plural(a.charactersReadThisMonth, 'character')} read`
                  : ''}
                {` · since ${day(a.createdAt)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

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

      <section className="block">
        <h2 className="block-title">Invitations</h2>
        {data && data.invites.length === 0 ? (
          <p className="small muted">None given out yet.</p>
        ) : (
          <ul className="list admin-list">
            {(data?.invites ?? []).map((i) => (
              <li key={`${i.createdAt}-${i.note}`} className="admin-row">
                <b>{i.note || 'For someone'}</b>
                <span className="small muted">
                  Made {day(i.createdAt)} ·{' '}
                  {i.usedBy
                    ? `used by ${i.usedBy} on ${day(i.usedAt!)}`
                    : i.expiresAt && i.expiresAt <= Date.now()
                      ? 'ran out unused'
                      : i.expiresAt
                        ? `good until ${day(i.expiresAt)}`
                        : 'good with no end'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
