import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { PASSWORD_MIN, passwordProblem } from '../../../shared/credentials';
import { ApiError } from '../../api/http';
import { paths } from '../../navigation/paths';
import { Field } from '../../ui/Field';
import { AuthLayout } from './AuthLayout';
import { messageFor } from './messages';
import { useSession } from './session';

/**
 * A forgotten password, replaced with one of the account's recovery codes —
 * there is no e-mail to send a link to. The code is used up, every other
 * device is signed out, and this one is signed in.
 *
 * States: empty; a field's problem once tried (the server's, on its field);
 * busy; refused (a wrong name and a wrong code read the same); signed in.
 */
export function RecoverPage() {
  const { recover } = useSession();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const problems = {
    username: username.trim() ? null : 'Your name.',
    code: serverFields.code ?? (code.trim() ? null : 'One of your recovery codes.'),
    password: serverFields.newPassword ?? passwordProblem(password, username),
    again: again !== password ? 'The two passwords are different.' : null,
  };
  const ready = !problems.username && !problems.code && !problems.password && !problems.again;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await recover(username, code, password);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setServerFields(err.fields);
      else setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="A new password"
      lede="Forgot the password? One of the recovery codes you made on your account page sets a new one. Each code works once, and every other device is signed out."
      footer={
        <>
          Remembered it? <Link to={paths.login()}>Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <Field label="Name" error={tried ? problems.username : null}>
          <input type="text" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Recovery code" hint="As it was written, with or without the dash." error={tried || serverFields.code ? problems.code : null}>
          <input
            type="text"
            name="code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setServerFields({});
            }}
          />
        </Field>
        <Field label="New password" hint={`At least ${PASSWORD_MIN} characters.`} error={tried || serverFields.newPassword ? problems.password : null}>
          <input type="password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="New password again" error={tried ? problems.again : null}>
          <input type="password" name="password-again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Setting it…' : 'Set the new password'}
        </button>
      </form>
    </AuthLayout>
  );
}
