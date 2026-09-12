import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { paths } from '../../navigation/paths';
import { AuthLayout } from './AuthLayout';
import { messageFor, useRegistration } from './messages';
import { useSession } from './session';

export function LoginPage() {
  const { signIn } = useSession();
  const [params] = useSearchParams();
  const next = params.get('next') ?? undefined;
  const expired = params.get('expired') === '1';
  const registration = useRegistration();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      // Nothing to do on success: the page this sits in moves on to `next` by itself.
      await signIn(username, password);
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      lede={
        expired
          ? 'You were signed out. Sign in again and carry on where you were — nothing you did has been lost.'
          : 'Your collections, reviews and texts, on whichever device you open them.'
      }
      footer={
        registration === 'open' && (
          <>
            New here? <Link to={paths.register(next)}>Make an account</Link>
          </>
        )
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="field">
          Name
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={busy || !username.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
