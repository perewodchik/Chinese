import { useEffect, useState, type FormEvent } from 'react';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/http';
import { copyText } from '../../platform/clipboard';
import { Field } from '../../ui/Field';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Recovery codes: the way back in when the password is forgotten, since the
 * site has no e-mail to send a link to. Made with the password and shown this
 * once; making new ones stops the old.
 *
 * States: loading (a line kept for the status); none yet; some left (how
 * many, since when); asking for the password; making; refused (wrong
 * password, on its field); the new codes shown, to copy, until the page goes.
 */
export function RecoveryCodes() {
  const toast = useToast();
  const [status, setStatus] = useState<{ left: number; createdAt: number } | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    authApi.recoveryStatus().then(
      (s) => live && setStatus(s),
      (err: unknown) => live && setError(messageFor(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  async function make(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await authApi.makeRecoveryCodes(password);
      setCodes(made);
      setStatus({ left: made.length, createdAt: Date.now() });
      setAsking(false);
      setPassword('');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setFields(err.fields);
      else setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const said =
    status === undefined
      ? (error ?? 'Loading…')
      : status === null
        ? 'None yet. If the password is ever forgotten, one of these sets a new one — there is no e-mail to send a link to.'
        : `${status.left} of 8 left, made ${day(status.createdAt)}. Each works once; making new ones stops these.`;

  return (
    <section className="block">
      <h2 className="block-title">Recovery codes</h2>
      <p className="small muted ac-copy-lede ac-codes-status">{said}</p>
      {codes && (
        <div className="ac-codes-shown">
          <p className="small" style={{ margin: 0 }}>
            Shown this once. Keep them somewhere other than this device: a note in your phone’s password manager, or on paper.
          </p>
          <ol className="ac-code-list">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <button
            className="btn tonal"
            onClick={() =>
              void copyText(codes.join('\n')).then(
                (ok) => toast(ok ? 'The codes are copied' : 'Could not copy them: select and copy them by hand'),
                () => toast('Could not copy them: select and copy them by hand'),
              )
            }
          >
            Copy the codes
          </button>
        </div>
      )}
      {!codes &&
        status !== undefined &&
        (asking ? (
          <form className="ac-codes" onSubmit={make} noValidate>
            <Field label="Your password" hint="Asked again, as for anything that lets someone in later." error={fields.password ?? null}>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFields({});
                }}
              />
            </Field>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <button className="btn tonal" type="submit" disabled={!password || busy}>
                {busy ? 'Making them…' : status ? 'Make new codes' : 'Make the codes'}
              </button>
              <button className="btn quiet" type="button" onClick={() => setAsking(false)} disabled={busy}>
                Not now
              </button>
            </div>
          </form>
        ) : (
          <button className="btn tonal" aria-expanded={false} onClick={() => setAsking(true)}>
            {status ? 'Make new codes…' : 'Make recovery codes…'}
          </button>
        ))}
    </section>
  );
}
