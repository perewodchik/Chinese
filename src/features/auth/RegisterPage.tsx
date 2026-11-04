import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PASSWORD_MIN, passwordProblem, usernameProblem } from '../../../shared/credentials';
import { ApiError } from '../../api/http';
import { paths } from '../../navigation/paths';
import { Field } from '../../ui/Field';
import { AuthLayout } from './AuthLayout';
import { messageFor, useRegistration } from './messages';
import { useSession } from './session';

export function RegisterPage() {
  const { register } = useSession();
  const [params] = useSearchParams();
  const next = params.get('next') ?? undefined;
  const registration = useRegistration();

  // An invitation link (/register?invite=…) arrives with its code typed in.
  const [invite, setInvite] = useState(() => params.get('invite') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  /** field problems are shown once there has been a first try, not while the first letter is typed */
  const [tried, setTried] = useState(false);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsInvite = registration === 'invite';
  const problems = {
    invite: serverFields.invite ?? (needsInvite && !invite.trim() ? 'The code from your invitation.' : null),
    username: serverFields.username ?? usernameProblem(username),
    password: serverFields.password ?? passwordProblem(password, username),
    again: again !== password ? 'The two passwords are different.' : null,
  };
  const ready = !problems.invite && !problems.username && !problems.password && !problems.again;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await register(username, password, needsInvite ? invite : undefined);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setServerFields(err.fields);
      else setError(messageFor(err));
      setBusy(false);
    }
  }

  const signIn = <Link to={paths.login(next)}>Sign in</Link>;

  if (registration === 'closed') {
    return (
      <AuthLayout
        title="Make an account"
        lede="New accounts are switched off here. Whoever runs the site can make one for you."
        footer={<>Already have one? {signIn}</>}
      />
    );
  }

  return (
    <AuthLayout
      title="Make an account"
      lede={
        needsInvite
          ? 'New accounts here are by invitation. One account holds everything — what you have learned, the texts, the cards — on every device you sign in on.'
          : 'One account holds everything — collections, what you have learned, the texts — and opens it on any device that can reach this server.'
      }
      footer={<>Already have one? {signIn}</>}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {needsInvite && (
          <Field label="Invitation" hint="The code from your invitation, as it was written." error={tried || serverFields.invite ? problems.invite : null}>
            <input
              type="text"
              name="invite"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={invite}
              onChange={(e) => {
                setInvite(e.target.value);
                setServerFields({});
              }}
            />
          </Field>
        )}
        <Field label="Name" hint="What you sign in with." error={tried || serverFields.username ? problems.username : null}>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setServerFields({});
            }}
          />
        </Field>
        <Field
          label="Password"
          hint={`At least ${PASSWORD_MIN} characters. A few words in a row is easier to remember than symbols, and harder to guess.`}
          error={tried ? problems.password : null}
        >
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Password again" error={tried || again.length >= password.length ? (again && problems.again) || null : null}>
          <input
            type="password"
            name="password-again"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </Field>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Making it…' : 'Make the account'}
        </button>
      </form>
    </AuthLayout>
  );
}
