import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdminAccountCard } from '../../../shared/admin';
import { request } from '../../api/http';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { useUser } from '../auth/session';
import { messageFor } from '../auth/messages';
import { useFreshPassword } from '../auth/useFreshPassword';
import { AdminAccountRow } from './AdminAccountRow';
import { day, mb, plural } from './format';
import './admin.css';

const ROOM: Array<[keyof AdminAccountCard['room'], string]> = [
  ['work', 'Texts, cards and the rest of the work'],
  ['pictures', 'Pictures'],
  ['readings', 'Readings aloud'],
  ['tries', 'Phrases said and scored'],
  ['conversations', 'Conversations'],
  ['game', 'The walk through Beijing'],
];

/**
 * /admin/users/:id (A5): one account, more than its row in the list says —
 * the invitation it came by, its last thirty days in numbers, what its room
 * goes on — with the same things to do to it as the row's ⋯ menu.
 *
 * States: loading; not an admin or not there (said plainly); the card.
 */
export function AdminUserPage() {
  const { id = '' } = useParams();
  const me = useUser();
  const { confirm, sheet } = useFreshPassword();
  const [card, setCard] = useState<AdminAccountCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => request<AdminAccountCard>('GET', `/api/admin/accounts/${encodeURIComponent(id)}`).then(setCard, (err: unknown) => setError(messageFor(err)));
  useEffect(() => {
    void load();
  }, [id]);
  useTitle(card ? card.account.username : 'Account');

  return (
    <section className="admin-page">
      {sheet}
      <header className="page-head">
        <Link className="back-link" to={paths.admin()}>
          <Icon name="back" />
          Admin
        </Link>
      </header>
      {error ? (
        <p className="small muted">{error}</p>
      ) : !card ? (
        <div className="page-loading" aria-busy="true" />
      ) : (
        <>
          <h1>{card.account.username}</h1>
          <ul className="list admin-list admin-card-head">
            <AdminAccountRow account={card.account} self={card.account.id === me.id} confirm={confirm} onChanged={() => void load()} />
          </ul>
          <p className="small muted">
            {card.invite ? `Came by an invitation${card.invite.note ? ` “${card.invite.note}”` : ''}${card.invite.createdBy ? ` from ${card.invite.createdBy}` : ''}.` : 'Signed up without an invitation, or before they were kept.'}
          </p>

          <section className="block">
            <h2 className="block-title">The last thirty days</h2>
            <div className="admin-tiles">
              <span>
                <b>{card.month.days}</b>
                <small>days worked</small>
              </span>
              <span>
                <b>{card.month.minutes}</b>
                <small>minutes</small>
              </span>
              <span>
                <b>{card.month.textsRead}</b>
                <small>texts read</small>
              </span>
              <span>
                <b>{card.month.answers}</b>
                <small>cards answered</small>
              </span>
            </div>
            <p className="small muted admin-dash-line">
              {plural(card.month.spoken, 'line')} said · this month by its own keys: {plural(card.account.scoredThisMonth, 'phrase')} scored, {plural(card.account.charactersReadThisMonth, 'character')} read aloud.
            </p>
          </section>

          <section className="block">
            <h2 className="block-title">Its room · {mb(card.account.storageBytes)}</h2>
            <ul className="list admin-list">
              {ROOM.filter(([k]) => card.room[k] > 0).map(([k, label]) => (
                <li key={k} className="admin-row admin-invite-row">
                  <span className="grow">{label}</span>
                  <span className="small muted">{mb(card.room[k])}</span>
                </li>
              ))}
            </ul>
            <p className="small muted">Here since {day(card.account.createdAt)}.</p>
          </section>
        </>
      )}
    </section>
  );
}
