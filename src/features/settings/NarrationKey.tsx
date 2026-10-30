import { useEffect, useState } from 'react';
import type { NarrationStatus } from '../../../shared/narration';
import { forgetNarrationKey, narrationStatus, saveNarrationKey } from '../../api/narration';

/**
 * The learner's MiniMax API key, for recording texts in a natural voice from
 * Listen. It goes to the server, which tries it with MiniMax before keeping
 * it and never sends it back: the page only ever sees its last characters.
 */
export function NarrationKey() {
  const [status, setStatus] = useState<NarrationStatus | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void narrationStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null } }));
  }, []);

  async function act(fn: () => Promise<NarrationStatus>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      setStatus(await fn());
      setKey('');
      setMessage(done);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <header>
        <h2>Natural voice</h2>
      </header>
      <div className="body" style={{ display: 'grid', gap: 12 }}>
        <p className="small muted" style={{ margin: 0 }}>
          MiniMax can read a text aloud in a natural Mandarin voice, from Listen on the text page. It uses your own
          API key from platform.minimax.io (API Keys), and its balance there: a chapter costs a few cents. The key
          stays on the server and is never shown again.
        </p>
        <p className="small" style={{ margin: 0, minHeight: '1.5em' }}>
          {status === null ? '' : status.key.set ? `A key ending ${status.key.hint} is saved.` : 'No key saved yet.'}
        </p>
        <form
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) void act(() => saveNarrationKey(key), 'Saved. MiniMax accepted the key.');
          }}
        >
          <input
            id="minimax-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={status?.key.set ? 'Replace it with another key' : 'Your MiniMax API key'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{ flex: '1 1 220px', minWidth: 0, fontSize: 16 }}
            aria-label="MiniMax API key"
          />
          <button className="btn tonal" type="submit" disabled={busy || !key.trim()}>
            {busy ? 'Checking…' : 'Save the key'}
          </button>
          {status?.key.set && (
            <button className="btn quiet" type="button" disabled={busy} onClick={() => void act(forgetNarrationKey, 'The key is forgotten.')}>
              Remove
            </button>
          )}
        </form>
        <p className="tiny muted" style={{ margin: 0, minHeight: '1.4em' }}>
          {message ?? ''}
        </p>
      </div>
    </div>
  );
}
