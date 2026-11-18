import { useEffect, useState } from 'react';
import { STRICTNESS, type EvalKeys, type EvalStatus, type Strictness } from '../../../shared/speechEval';
import { evalStatus, forgetEvalKeys, retryEvalKeys, saveEvalKeys, setStrictness } from '../../api/speechEval';
import { BrokenKeyLine } from './BrokenKeyLine';
import { KeyHelp } from './KeyHelp';

const STRICT_LABEL: Record<Strictness, string> = { easy: 'Easy', common: 'Common', hard: 'Hard' };

/** The keys' fields, as SpeechSuper's console names them. */
const FIELDS: Array<{ name: 'appKey' | 'secretKey'; label: string; secret: boolean }> = [
  { name: 'appKey', label: 'appKey', secret: false },
  { name: 'secretKey', label: 'secretKey', secret: true },
];

const ABOUT =
  'SpeechSuper scores each phrase you say in Speaking › Phrases: every syllable’s initial, final and tone out of 100, what a wrong sound was like and which tone you said, the tone a syllable takes in the phrase, the rhythm and the pace. Your own keys, from the console at speechsuper.com.';

/**
 * Pronunciation checking: the learner's keys for SpeechSuper, which
 * score each phrase said in Speaking › Phrases, and how strictly. The keys go
 * to the server, which tries them before keeping them and never sends them back.
 */
export function PronunciationKey({ onChange }: { onChange?: (s: EvalStatus) => void } = {}) {
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void evalStatus().then(
      (s) => {
        setStatus(s);
        onChange?.(s);
      },
      () => {
        const none: EvalStatus = { key: { set: false, hint: null, provider: null }, strictness: 'common' };
        setStatus(none);
        onChange?.(none);
      },
    );
    // Told once as it loads; after that a parent showing what is in use follows the saves through `act`.
  }, []);

  async function act(fn: () => Promise<EvalStatus>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const next = await fn();
      setStatus(next);
      onChange?.(next);
      setKeys({});
      setMessage(done);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const fields = FIELDS;
  const filled = fields.every((f) => keys[f.name]?.trim());
  const typed: EvalKeys = { provider: 'speechsuper', appKey: keys.appKey ?? '', secretKey: keys.secretKey ?? '' };
  const name = 'SpeechSuper';
  const field = (name: string, label: string, secret: boolean) => (
    <label key={name} className="field" style={{ display: 'grid', gap: 4, flex: '1 1 160px', minWidth: 0 }}>
      <span className="small">{label}</span>
      <input
        type={secret ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={keys[name] ?? ''}
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
          {ABOUT} They stay on the server and are never shown again.
        </p>
        <KeyHelp service="speechsuper" />
        <p className="small" style={{ margin: 0, minHeight: '1.5em' }}>
          {status === null
            ? ''
            : status.key.set
              ? `SpeechSuper keys ending ${status.key.hint} are saved and used.`
              : 'No keys saved yet.'}
        </p>
        {status?.key.broken && <BrokenKeyLine broken={status.key.broken} busy={busy} onRetry={() => void act(retryEvalKeys, 'The next phrase goes to the service again.')} />}
        <form
          style={{ display: 'grid', gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (filled) void act(() => saveEvalKeys(typed), `Saved. ${name} accepted the keys.`);
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {fields.map((f) => field(f.name, f.label, f.secret))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn tonal" type="submit" disabled={busy || !filled}>
              {busy ? 'Checking…' : status?.key.set ? `Use these ${name} keys` : 'Save the keys'}
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
