import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FEEDBACK_MAX, type FeedbackKind } from '../../../shared/feedback';
import { sendFeedback } from '../../api/feedback';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { messageFor } from '../auth/messages';
import './feedback.css';

const KINDS: Array<{ id: FeedbackKind; label: string }> = [
  { id: 'wrong', label: 'Something wrong' },
  { id: 'missing', label: 'Missing' },
  { id: 'good', label: 'Good' },
];

/**
 * /feedback?from= (A12): what someone found wrong, missing or good, sent to
 * whoever runs the site with the page it was about — and nothing else of
 * theirs.
 *
 * States: writing (Send waits for words); sending; refused (said under the
 * form); sent (thanks, and the way back).
 */
export function FeedbackPage() {
  useTitle('Send feedback');
  const [query] = useSearchParams();
  const from = query.get('from')?.startsWith('/') ? query.get('from')! : '/';
  const [kind, setKind] = useState<FeedbackKind>('wrong');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const length = [...message].length;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy || !message.trim() || length > FEEDBACK_MAX) return;
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ kind, message, page: from });
      setSent(true);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feedback-page">
      <header className="page-head">
        <Link className="back-link" to={from}>
          <Icon name="back" />
          Back
        </Link>
      </header>
      <h1>Send feedback</h1>
      {sent ? (
        <>
          <p>Thank you — it has gone to whoever runs the site, with the page it was about.</p>
          <Link className="btn tonal" to={from === '/' ? paths.read() : from}>
            Back to where you were
          </Link>
        </>
      ) : (
        <form className="feedback-form" onSubmit={send} noValidate>
          <p className="small muted">Something wrong, something missing, or something good: a line or two is plenty. It goes with the page you were on ({from}) and your name, nothing else.</p>
          <Seg value={kind} options={KINDS} onChange={setKind} label="What it is" />
          <label className="field">
            <span className="sr-only">What happened</span>
            <textarea rows={6} value={message} maxLength={FEEDBACK_MAX * 2} onChange={(e) => setMessage(e.target.value)} placeholder="What happened, or what you would like" />
          </label>
          <p className="tiny muted feedback-count" data-over={length > FEEDBACK_MAX || undefined}>
            {length.toLocaleString('en')} of {FEEDBACK_MAX.toLocaleString('en')}
          </p>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button className="btn primary" type="submit" disabled={busy || !message.trim() || length > FEEDBACK_MAX}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
