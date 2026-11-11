import { useCallback, useRef, useState, type ReactNode } from 'react';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/http';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { messageFor } from './messages';
import './fresh.css';

/** What `confirm` rejects with when the password was not given: the action simply did not happen. */
export class NotConfirmed extends Error {
  constructor() {
    super('Not done: the password was not typed.');
    this.name = 'NotConfirmed';
  }
}

interface Asking {
  retry: () => void;
  cancel: () => void;
}

/**
 * For an admin's action the server wants the password for again
 * (`reauth_required`, a quarter of an hour after it was last typed): runs
 * the action, and when it is refused for that, asks for the password in a
 * sheet, sends it, and runs the action again. Cancelled, the promise rejects
 * with `NotConfirmed`, which a caller lets go of quietly.
 *
 * States: nothing asked; asking (the field, Go on, Not now); checking (Go
 * on says so, both wait); a wrong password (said on the field); refused
 * otherwise (said under it, a limit reached among them); gone again once the
 * action has run.
 */
export function useFreshPassword(): { confirm: <T>(run: () => Promise<T>) => Promise<T>; sheet: ReactNode } {
  const [asking, setAsking] = useState<Asking | null>(null);
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Asking | null>(null);

  const confirm = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    return run().catch((err: unknown) => {
      if (!(err instanceof ApiError && err.code === 'reauth_required')) throw err;
      return new Promise<T>((resolve, reject) => {
        const ask: Asking = {
          retry: () => void run().then(resolve, reject),
          cancel: () => reject(new NotConfirmed()),
        };
        pending.current = ask;
        setPassword('');
        setFieldError(null);
        setError(null);
        setAsking(ask);
      });
    });
  }, []);

  const close = () => {
    pending.current?.cancel();
    pending.current = null;
    setAsking(null);
  };

  async function submit() {
    if (!password || busy || !pending.current) return;
    setBusy(true);
    setFieldError(null);
    setError(null);
    try {
      await authApi.reauth(password);
      const ask = pending.current;
      pending.current = null;
      setAsking(null);
      ask?.retry();
    } catch (err) {
      if (err instanceof ApiError && err.fields.password) setFieldError(err.fields.password);
      else setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const sheet = asking ? (
    <Modal
      title="Your password, again"
      subtitle="Changing things on the site asks for it when it was last typed more than a quarter of an hour ago."
      onClose={close}
      onConfirm={() => void submit()}
      footer={
        <>
          <button className="btn quiet" type="button" onClick={close} disabled={busy}>
            Not now
          </button>
          <button className="btn primary fresh-go" type="button" onClick={() => void submit()} disabled={!password || busy}>
            {busy ? 'Checking…' : 'Go on'}
          </button>
        </>
      }
    >
      <Field label="Your password" error={fieldError}>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldError(null);
          }}
        />
      </Field>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  ) : null;

  return { confirm, sheet };
}
