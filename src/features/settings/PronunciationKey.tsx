import { useEffect, useState } from 'react';
import { EVAL_PROVIDERS, PROVIDER_NAME, STRICTNESS, type EvalKeys, type EvalProvider, type EvalStatus, type Strictness } from '../../../shared/speechEval';
import { evalStatus, forgetEvalKeys, saveEvalKeys, setStrictness } from '../../api/speechEval';
import { KeyHelp } from './KeyHelp';

const STRICT_LABEL: Record<Strictness, string> = { easy: 'Easy', common: 'Common', hard: 'Hard' };

/** Each service's fields, as its console names them. */
const FIELDS: Record<EvalProvider, Array<{ name: string; label: string; secret: boolean }>> = {
  speechsuper: [
    { name: 'appKey', label: 'appKey', secret: false },
    { name: 'secretKey', label: 'secretKey', secret: true },
  ],
  iflytek: [
    { name: 'appId', label: 'APPID', secret: false },
    { name: 'apiKey', label: 'APIKey', secret: true },
    { name: 'apiSecret', label: 'APISecret', secret: true },
  ],
};

const ABOUT: Record<EvalProvider, string> = {
  speechsuper:
    'SpeechSuper scores each phrase you say in Speaking › Phrases: every syllable’s initial, final and tone out of 100, what a wrong sound was like and which tone you said, the tone a syllable takes in the phrase, the rhythm and the pace. Your own keys, from the console at speechsuper.com.',
  iflytek:
    'iFlytek’s speech evaluation scores each phrase you say in Speaking › Phrases: whether each syllable’s initial, final and tone were right, the flow, and what was left out. Your own keys, from the console at xfyun.cn (语音评测).',
};

/**
 * Pronunciation checking: the learner's keys for SpeechSuper or iFlytek, which
 * score each phrase said in Speaking › Phrases, and how strictly. The keys go
 * to the server, which tries them before keeping them and never sends them back.
 */
export function PronunciationKey({ onChange }: { onChange?: (s: EvalStatus) => void } = {}) {
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [provider, setProvider] = useState<EvalProvider>('speechsuper');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void evalStatus().then(
      (s) => {
        setStatus(s);
        if (s.key.provider) setProvider(s.key.provider);
      },
      () => setStatus({ key: { set: false, hint: null, provider: null }, strictness: 'common' }),
    );
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

  const fields = FIELDS[provider];
  const filled = fields.every((f) => keys[f.name]?.trim());
  const typed = { provider, ...Object.fromEntries(fields.map((f) => [f.name, keys[f.name] ?? ''])) } as EvalKeys;
  const name = PROVIDER_NAME[provider];
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
        <div className="seg sm" role="group" aria-label="Service">
          {EVAL_PROVIDERS.map((p) => (
            <button key={p} type="button" aria-pressed={provider === p} disabled={busy} onClick={() => setProvider(p)}>
              {PROVIDER_NAME[p]}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {ABOUT[provider]} They stay on the server and are never shown again.
        </p>
        {provider === 'speechsuper' && <KeyHelp service="speechsuper" />}
        <p className="small" style={{ margin: 0, minHeight: '1.5em' }}>
          {status === null
            ? ''
            : status.key.set && status.key.provider
              ? `${PROVIDER_NAME[status.key.provider]} keys ending ${status.key.hint} are saved and used.`
              : 'No keys saved yet.'}
        </p>
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
