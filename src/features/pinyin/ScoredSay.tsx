import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PROVIDER_NAME, type EvalResult, type EvalStatus } from '../../../shared/speechEval';
import { evalStatus, evaluatePhrase } from '../../api/speechEval';
import { faultsOf, numbered, partsOf } from '../../domain/phrases';
import { heardAnything, micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { RecordButton } from './RecordButton';
import { useRecorder } from './useRecorder';

/**
 * A word to say, scored by the pronunciation service with the learner's own
 * keys — the only judge: nothing here measures pitch or listens for itself.
 * Each syllable is marked as the service found it, with the tone it should
 * have here (after sandhi), the one it sounded like, and its initial, final
 * and tone out of 100 when the service gives them.
 *
 * `readings` is each character's pinyin, tone-marked, in order.
 */
export function ScoredSay({
  word,
  readings,
  onListen,
  onScored,
  maxMs = 4000,
}: {
  word: string;
  readings: string[];
  onListen: () => void;
  /** good: every syllable as it should be */
  onScored?: (r: EvalResult, good: boolean) => void;
  maxMs?: number;
}) {
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [mine, setMine] = useState<Float32Array | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = micUnavailable();

  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null, provider: null }, strictness: 'common' }));
  }, []);
  useEffect(() => {
    setResult(null);
    setMine(null);
    setError(null);
  }, [word]);

  const rec = useRecorder((s) => {
    setMine(s);
    setError(null);
    setResult(null);
    // Silence is not sent to be scored: it would come back as every syllable left out.
    if (!heardAnything(s)) {
      setError(`Nothing came through from the microphone, so nothing was sent to be scored. Say it again; if it happens again, reload the page, and check the browser may use the microphone. (${rec.diagnostics()})`);
      return;
    }
    setChecking(true);
    evaluatePhrase(word, s, numbered(readings))
      .then(
        (r) => {
          setResult(r);
          // A recording that was not the word at all is not a try at it.
          if (!r.rejected) onScored?.(r, r.syllables.every((x) => faultsOf(x).length === 0));
        },
        (err: Error) => setError(err.message),
      )
      .finally(() => setChecking(false));
  }, maxMs);

  const noKey = status !== null && !status.key.set;
  const chars = [...word];
  const tip = result?.syllables.flatMap((s) => faultsOf(s))[0]?.how;

  return (
    <div className="say-check">
      {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}
      {noKey && (
        <p className="notice speak-notice">
          Scoring needs your SpeechSuper (or iFlytek) keys. <Link to={paths.settings()}>Add them in Settings</Link>.
        </p>
      )}

      <div className="speak-controls">
        <button className="btn speak-side" onClick={onListen} title="Listen (L)">
          <Icon name="sound" size={18} /> Listen
        </button>
        <RecordButton state={checking ? 'checking' : rec.state} level={rec.level} onToggle={rec.toggle} disabled={!!blocked || noKey} />
        <button className="btn speak-side" onClick={() => mine && rec.play(mine)} disabled={!mine} title="Hear yourself (P)">
          <span aria-hidden>▶</span> Me
        </button>
      </div>

      {(error || rec.error) && <p className="notice speak-notice">{error ?? rec.error}</p>}

      {result?.rejected && (
        <p className="small muted" style={{ margin: 0 }}>
          That did not sound like {word}. Listen once more, then say all of it, close to the microphone.
        </p>
      )}

      {result && !result.rejected && (
        <>
          <div className="verdicts">
            {result.syllables.map((s, i) => {
              const faults = faultsOf(s);
              const p = partsOf(s.symbol);
              const want = s.sandhi ?? p.tone;
              const shown = partsOf(s.symbol.replace(/\d$/, '') + want).marked;
              return (
                <div key={i} className="verdict" data-state={faults.length ? 'wrong' : 'right'}>
                  <span className="verdict-hanzi">{s.char || chars[i]}</span>
                  <span className="verdict-py">{shown}</span>
                  <b>{s.said === 'missed' ? 'Not heard' : faults.length ? 'Not yet' : 'Right'}</b>
                  <span className="tiny muted">
                    {faults.length ? faults.map((f) => f.title).join(' · ') : s.sandhi ? 'its tone changes here, and you said it so' : 'as it should be'}
                  </span>
                  {s.toneScore !== undefined && s.said !== 'missed' && (
                    <span className="tiny muted">
                      initial {Math.round(s.initialScore ?? 100)} · final {Math.round(s.finalScore ?? 100)} · tone {Math.round(s.toneScore)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {tip && <p className="speak-tip">{tip}</p>}
          <p className="tiny muted" style={{ margin: 0 }}>
            Scored by {PROVIDER_NAME[result.by]}: {Math.round(result.total)} of 100.
          </p>
        </>
      )}
    </div>
  );
}
