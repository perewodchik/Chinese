import { useEffect, useState, type FormEvent } from 'react';
import type { AccessTokenDto } from '../../../shared/api';
import { accessTokens, makeAccessToken, revokeAccessToken } from '../../api/account';
import { ApiError } from '../../api/http';
import { copyText } from '../../platform/clipboard';
import { Field } from '../../ui/Field';
import { Seg } from '../../ui/Seg';
import { useToast } from '../../ui/toast';
import { messageFor } from '../auth/messages';

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

const LASTS = [
  { id: '30', label: 'A month' },
  { id: '90', label: 'Three months' },
  { id: '365', label: 'A year' },
] as const;
type Lasts = (typeof LASTS)[number]['id'];

/**
 * Access tokens: what a helper that adds texts for you (Claude, with the
 * add-text skill) signs in with instead of the password. A token can read and
 * save the texts and their pictures and nothing else, is shown once, and stops
 * working when revoked, when it runs out, or when the password changes.
 *
 * States: loading (a line kept for the list); failed (said in place of the
 * list); none yet; some (each with when it was last used and until when it
 * works, or that it ran out); asking for a name and how long; making;
 * refused (on its field, or under the form); the new token shown, to copy,
 * until the page goes; one being revoked (its button says so, the others
 * wait); a row gone once it is revoked.
 */
export function AccessTokens() {
  const toast = useToast();
  const [list, setList] = useState<AccessTokenDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');
  const [lasts, setLasts] = useState<Lasts>('90');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    accessTokens().then(
      (t) => live && setList(t),
      (err: unknown) => live && setError(messageFor(err)),
    );
    return () => {
      live = false;
    };
  }, []);

  async function make(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy('make');
    setError(null);
    try {
      const { token, made } = await makeAccessToken({ name, days: Number(lasts) });
      setList((l) => [made, ...(l ?? [])]);
      setShown(token);
      setAsking(false);
      setName('');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setFields(err.fields);
      else setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    setBusy(id);
    setError(null);
    try {
      await revokeAccessToken(id);
      setList((l) => (l ?? []).filter((t) => t.id !== id));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  }

  const now = Date.now();
  return (
    <section className="block">
      <h2 className="block-title">Access tokens</h2>
      <p className="small muted ac-copy-lede">
        For a helper that adds texts for you, such as Claude with the add-text skill: it signs in with a token instead of your
        password. A token can read and save your texts and their pictures, nothing else. Changing the password stops them all.
      </p>
      {shown && (
        <div className="ac-codes-shown">
          <p className="small" style={{ margin: 0 }}>
            Shown this once. Put it where the helper reads it, and nowhere else.
          </p>
          <code className="ac-token">{shown}</code>
          <button
            className="btn tonal"
            onClick={() =>
              void copyText(shown).then(
                (ok) => toast(ok ? 'The token is copied' : 'Could not copy it: select and copy it by hand'),
                () => toast('Could not copy it: select and copy it by hand'),
              )
            }
          >
            Copy the token
          </button>
        </div>
      )}
      <div className="ac-tokens">
        {list === null ? (
          <p className="small muted">{error ?? 'Loading…'}</p>
        ) : list.length === 0 ? (
          <p className="small muted">None yet.</p>
        ) : (
          <ul className="list">
            {list.map((t) => (
              <li key={t.id} className="ac-device">
                <span className="grow">
                  <b className="ac-token-name">{t.name}</b>
                  <span className="small muted">
                    {t.lastUsedAt ? `Last used ${day(t.lastUsedAt)}` : 'Not used yet'}
                    {' · '}
                    {t.expiresAt > now ? `works until ${day(t.expiresAt)}` : `ran out on ${day(t.expiresAt)}`}
                  </span>
                </span>
                <button className="btn quiet sm ac-device-out" onClick={() => void revoke(t.id)} disabled={busy !== null}>
                  {busy === t.id ? 'Revoking…' : t.expiresAt > now ? 'Revoke' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {list !== null && error && !asking && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>
      {list !== null &&
        (asking ? (
          <form className="ac-codes" onSubmit={make} noValidate>
            <Field label="What uses it" hint="A name to know it by, such as “add-text skill”." error={fields.name ?? null}>
              <input
                name="token-name"
                autoComplete="off"
                maxLength={60}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFields({});
                }}
              />
            </Field>
            <div className="field">
              How long it works
              <Seg value={lasts} options={LASTS} onChange={setLasts} label="How long it works" />
            </div>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="row">
              <button className="btn tonal" type="submit" disabled={!name.trim() || busy !== null}>
                {busy === 'make' ? 'Making it…' : 'Make the token'}
              </button>
              <button className="btn quiet" type="button" onClick={() => setAsking(false)} disabled={busy !== null}>
                Not now
              </button>
            </div>
          </form>
        ) : (
          <button className="btn tonal" aria-expanded={false} onClick={() => setAsking(true)} disabled={busy !== null}>
            Make a token…
          </button>
        ))}
    </section>
  );
}
