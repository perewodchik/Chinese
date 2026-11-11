import { useEffect, useState, type FormEvent } from 'react';
import type { TwoStepSetup, TwoStepStatus } from '../../../shared/api';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/http';
import { Field } from '../../ui/Field';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';
import { NotConfirmed, useFreshPassword } from '../auth/useFreshPassword';

/** The key as an app's "enter a setup key" screen wants it read out: groups of four. */
const grouped = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? secret;

type Step = { kind: 'idle' } | { kind: 'adding'; setup: TwoStepSetup } | { kind: 'removing' };

/**
 * Two-step sign-in: after the password, the six digits an authenticator app
 * shows (the iPhone's Passwords app does it). Required for an account that
 * runs the site; anyone may turn it on.
 *
 * States: loading (a line kept); failed; off (with a line saying it is
 * needed, for an admin); adding (the link that opens the app, the key to
 * type instead, the first code); on; removing (a code, then off); working
 * (the buttons wait); a wrong code (said on its field); refused otherwise
 * (said under the form). Starting and removing ask for the password first
 * when it was typed long ago (useFreshPassword).
 */
export function TwoStep() {
  const toast = useToast();
  const { confirm, sheet } = useFreshPassword();
  const [status, setStatus] = useState<TwoStepStatus | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    authApi.twoStep().then(
      (s) => live && setStatus(s),
      (err: unknown) => live && setError(messageFor(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setCodeError(null);
    try {
      await work();
    } catch (err) {
      if (err instanceof NotConfirmed) return;
      if (err instanceof ApiError && err.fields.code) setCodeError(err.fields.code);
      else setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      const setup = await confirm(() => authApi.startTwoStep());
      setCode('');
      setStep({ kind: 'adding', setup });
    });

  function finish(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    void run(async () => {
      if (step.kind === 'adding') {
        await authApi.confirmTwoStep(code.trim());
        setStatus((s) => (s ? { ...s, enabled: true } : s));
        toast('Two-step sign-in is on. Your other devices were signed out.');
      } else {
        await confirm(() => authApi.disableTwoStep(code.trim()));
        setStatus((s) => (s ? { ...s, enabled: false } : s));
        toast('Two-step sign-in is off');
      }
      setStep({ kind: 'idle' });
      setCode('');
    });
  }

  const said =
    status === null
      ? (error ?? 'Loading…')
      : status.enabled
        ? 'On. Signing in asks for the code your authenticator app shows, after the password. A recovery code works in its place.'
        : status.required
          ? 'Off. An account that runs the site needs it to use the site’s pages. Turn it on with an authenticator app: the iPhone’s Passwords app is one.'
          : 'Off. With it on, signing in asks for a code from an authenticator app after the password: the iPhone’s Passwords app is one.';

  return (
    <section className="block">
      {sheet}
      <h2 className="block-title">Two-step sign-in</h2>
      <p className="small muted ac-copy-lede ac-codes-status">{said}</p>

      {step.kind === 'adding' && (
        <div className="ac-codes-shown">
          <a className="btn tonal" href={step.setup.link}>
            Add to your authenticator app
          </a>
          <p className="small" style={{ margin: 0 }}>
            Or type this key into the app:
          </p>
          <code className="ac-token">{grouped(step.setup.secret)}</code>
        </div>
      )}

      {step.kind !== 'idle' ? (
        <form className="ac-codes ac-two-step" onSubmit={finish} noValidate>
          <Field label={step.kind === 'adding' ? 'The code the app shows now' : 'A code from your app, or a recovery code'} error={codeError}>
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              spellCheck={false}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
            />
          </Field>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <button className={step.kind === 'adding' ? 'btn tonal' : 'btn danger'} type="submit" disabled={!code.trim() || busy}>
              {busy ? 'Checking…' : step.kind === 'adding' ? 'Turn it on' : 'Turn it off'}
            </button>
            <button className="btn quiet" type="button" onClick={() => setStep({ kind: 'idle' })} disabled={busy}>
              Not now
            </button>
          </div>
        </form>
      ) : (
        status !== null && (
          <>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {!status.enabled ? (
              <button className="btn tonal" onClick={() => void start()} disabled={busy}>
                {busy ? 'Starting…' : 'Turn it on…'}
              </button>
            ) : (
              !status.required && (
                <button className="btn quiet" onClick={() => setStep({ kind: 'removing' })} disabled={busy}>
                  Turn it off…
                </button>
              )
            )}
          </>
        )
      )}
    </section>
  );
}
