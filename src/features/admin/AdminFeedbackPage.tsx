import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { FeedbackItem, FeedbackStatus } from '../../../shared/feedback';
import { adminFeedback, setFeedbackStatus } from '../../api/feedback';
import { ApiError } from '../../api/http';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { useTitle } from '../../ui/useTitle';
import { messageFor } from '../auth/messages';
import './admin.css';

const SHOWN: Array<{ id: FeedbackStatus; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'answered', label: 'Answered' },
  { id: 'closed', label: 'Closed' },
];
const KIND: Record<FeedbackItem['kind'], string> = { wrong: 'Something wrong', missing: 'Missing', good: 'Good' };
const when = (at: number) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * /admin/feedback (A12): what learners sent from the site, newest first, by
 * where it stands — new, answered, closed. The message is shown as the text
 * it is, never as markup.
 *
 * States: loading; not an admin; none in this state; the list.
 */
export function AdminFeedbackPage() {
  useTitle('Feedback');
  const toast = useToast();
  const [status, setStatus] = useState<FeedbackStatus>('new');
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  const load = (s: FeedbackStatus) =>
    adminFeedback(s).then(
      (r) => setItems(r.items),
      (err: unknown) => setDenied(err instanceof ApiError && err.status === 403 ? 'This page is for whoever runs the site.' : messageFor(err)),
    );
  useEffect(() => {
    setItems(null);
    void load(status);
  }, [status]);

  async function mark(id: string, to: FeedbackStatus) {
    try {
      await setFeedbackStatus(id, to);
      setItems((list) => (list ?? []).filter((i) => i.id !== id));
      toast(to === 'answered' ? 'Marked answered' : to === 'closed' ? 'Closed' : 'Back among the new');
    } catch (err) {
      toast(messageFor(err));
    }
  }

  return (
    <section className="admin-page">
      <header className="page-head">
        <Link className="back-link" to={paths.admin()}>
          <Icon name="back" />
          Admin
        </Link>
      </header>
      <h1>Feedback</h1>
      {denied ? (
        <p className="small muted">{denied}</p>
      ) : (
        <>
          <Seg value={status} options={SHOWN} onChange={setStatus} label="Which" size="sm" />
          {items === null ? (
            <p className="small muted admin-feedback-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="small muted admin-feedback-empty">None {status === 'new' ? 'new' : status}.</p>
          ) : (
            <ul className="list admin-list">
              {items.map((f) => (
                <li key={f.id} className="admin-row admin-feedback">
                  <span className="small muted">
                    <b className="admin-kind">{KIND[f.kind]}</b> · {f.username ?? 'an account since deleted'} · {when(f.createdAt)} · {f.page}
                  </span>
                  <p className="admin-feedback-message">{f.message}</p>
                  <div className="row">
                    {f.status !== 'answered' && (
                      <button className="btn quiet sm" onClick={() => void mark(f.id, 'answered')}>
                        Answered
                      </button>
                    )}
                    {f.status !== 'closed' && (
                      <button className="btn quiet sm" onClick={() => void mark(f.id, 'closed')}>
                        Close
                      </button>
                    )}
                    {f.status !== 'new' && (
                      <button className="btn quiet sm" onClick={() => void mark(f.id, 'new')}>
                        Back to new
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
