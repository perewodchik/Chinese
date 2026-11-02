import { useEffect, useState } from 'react';
import { STRICTNESS, type EvalStatus, type Strictness } from '../../../shared/speechEval';
import { evalStatus, forgetEvalKeys, saveEvalKeys, setStrictness } from '../../api/speechEval';

const STRICT_LABEL: Record<Strictness, string> = { easy: 'Easy', common: 'Common', hard: 'Hard' };

/**
 * Pronunciation checking: the learner's iFlytek keys (APPID, APIKey and
 * APISecret from the xfyun.cn console), which score each phrase said in
 * Speaking › Phrases, and how strictly. The keys go to the server, which
 * tries them with iFlytek before keeping them and never sends them back.
 */
export function PronunciationKey({ onChange }: { onChange?: (s: EvalStatus) => void } = {}) {
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [keys, setKeys] = useState({ appId: '', apiKey: '', apiSecret: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null }, strictness: 'common' }));
  }, []);

  async function act(fn: () => Promise<EvalStatus>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await fn();
      setStatus(next);
      onChange?.(next);
      setKeys({ appId: '', apiKey: '', apiSecret: '' });
      setMessage(done);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const filled = keys.appId.trim() && keys.apiKey.trim() && keys.apiSecret.trim();
  const field = (name: keyof typeof keys, label: string, secret: boolean) => (
    <label className="field" style={{ display: 'grid', gap: 4, flex: '1 1 160px', minWidth: 0 }}>
      <span className="small">{label}</span>
      <input
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={keys[name]}
        onChange={(e) => setKeys((k) => ({ ...k, [name]: e.target.value }))}
        style={{ fontSize: 16, minWidth: 0 }}
      />
    </label>
  );

  return (
    <div className="card">
      <header>
        <h2>Pronunciation checking</h2>
      </header>
      <div className="body" style={{ display: 'grid', gap: 12 }}>
        <p className="small muted" style={{ margin: 0 }}>
          iFlytek's speech evaluation scores each phrase you say in Speaking › Phrases: every syllable's initial, final and
          tone, the flow, and what was left out. Your own keys, from the console at xfyun.cn (语音评测): they stay on the
          server and are never shown again.
        </p>
        <p className="small" style={{ margin: 0, minHeight: '1.5em' }}>
          {status === null ? '' : status.key.set ? `Keys with an APIKey ending ${status.key.hint} are saved.` : 'No keys saved yet.'}
        </p>
        <form
          style={{ display: 'grid', gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (filled) void act(() => saveEvalKeys(keys), 'Saved. iFlytek accepted the keys.');
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {field('appId', 'APPID', false)}
            {field('apiKey', 'APIKey', true)}
            {field('apiSecret', 'APISecret', true)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn tonal" type="submit" disabled={busy || !filled}>
              {busy ? 'Checking…' : status?.key.set ? 'Replace the keys' : 'Save the keys'}
            </button>
            {status?.key.set && (
              <button className="btn quiet" type="button" disabled={busy} onClick={() => void act(forgetEvalKeys, 'The keys are forgotten.')}>
                Remove
              </button>
            )}
          </div>
        </form>
        {status?.key.set && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 200px', display: 'grid' }}>
              <span className="small">How strict</span>
              <span className="tiny muted">Easy forgives a learner's accent; Hard marks every slip, as for a native speaker.</span>
            </span>
            <div className="seg sm" role="group" aria-label="How strict">
              {STRICTNESS.map((s) => (
                <button key={s} aria-pressed={status.strictness === s} disabled={busy} onClick={() => void act(() => setStrictness(s), `Scoring is now ${STRICT_LABEL[s].toLowerCase()}.`)}>
                  {STRICT_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="tiny muted" style={{ margin: 0, minHeight: '1.4em' }}>
          {message ?? ''}
        </p>
      </div>
    </div>
  );
}
