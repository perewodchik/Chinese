import { useState, type FormEvent } from 'react';
import { PASSWORD_MIN, passwordProblem } from '../../../shared/credentials';
import { authApi } from '../../api/auth';
import { Field } from '../../ui/Field';
import { useToast } from '../../ui/toast';
import { messageFor } from './messages';
import { useUser } from './session';

export function ChangePasswordForm() {
  const user = useUser();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problem = next ? passwordProblem(next, user.username) : null;
  const mismatch = again && again !== next ? 'The two new passwords are different.' : null;
  const ready = Boolean(current && next && !problem && again === next);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setAgain('');
      toast('Password changed. Every other device has been signed out.');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="password-form" onSubmit={submit}>
      {/* For password managers, which want to know whose password is changing. */}
      <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
      <Field label="Current password">
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="New password" hint={`At least ${PASSWORD_MIN} characters.`} error={problem}>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="New password again" error={mismatch}>
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button className="btn" type="submit" disabled={busy || !ready}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
        <span className="tiny muted">Every other device signed in to this account is signed out.</span>
      </div>
    </form>
  );
}
