import { useState, type FormEvent } from 'react';
import { deleteAccount } from '../../api/account';
import { ApiError } from '../../api/http';
import { Field } from '../../ui/Field';
import { messageFor } from '../auth/messages';
import { useSession, useUser } from '../auth/session';

/**
 * Deleting the account, at the foot of the account page: folded away until
 * asked for, then the name typed out and the password, so it is never one
 * tap. What goes is said plainly first, and so is the way to keep a copy.
 *
 * States: folded; open and not yet filled in (the button stays disabled
 * until the name matches); deleting; refused (a wrong password, said on its
 * field; anything else, said under the form); gone (the sign-in page).
 */
export function DeleteAccount() {
  const user = useUser();
  const { deleted } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim() === user.username && password.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      deleted();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setFields(err.fields);
      else setError(messageFor(err));
      setBusy(false);
    }
  }

  return (
    <section className="block">
      <h2 className="block-title">Delete the account</h2>
      {!open ? (
        <>
          <p className="small muted ac-copy-lede">Everything goes, on every device, and cannot be brought back.</p>
          <button className="btn danger" aria-expanded={false} onClick={() => setOpen(true)}>
            Delete the account…
          </button>
        </>
      ) : (
        <form className="ac-delete" onSubmit={submit} noValidate>
          <p className="small" style={{ margin: 0 }}>
            Your texts, shelves, cards and progress, the walk through Beijing, your conversations, tries, narrators and
            their readings, and your keys are deleted for good. Download a copy above first if you want to keep any of it.
          </p>
          <Field label={`Type ${user.username} to confirm`}>
            <input type="text" name="confirm-name" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Your password" error={fields.password ?? null}>
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
            <button className="btn danger" type="submit" disabled={!ready || busy}>
              {busy ? 'Deleting…' : 'Delete it for good'}
            </button>
            <button className="btn quiet" type="button" aria-expanded onClick={() => setOpen(false)} disabled={busy}>
              Keep it
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
