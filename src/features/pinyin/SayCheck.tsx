import { useEffect, useState } from 'react';
import { bestHeard, describeMiss, type HeardResult } from '../../domain/pinyin/heard';
import type { SaidWord } from '../../domain/pinyin/sounds';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { canRecognise, recogniseOnce, RECOGNITION_MESSAGE } from '../../platform/audio/recognition';
import { useLibrary } from '../shared/library';
import { RecordButton } from './RecordButton';
import { say } from './voiceOut';
import { useRecorder } from './useRecorder';

/**
 * One word to say, and what came out.
 *
 * Where the browser has speech recognition, it listens and the result is
 * compared sound by sound with what was meant. Where it has none, the page
 * does the next most useful thing rather than nothing: record, then play the
 * reference and your recording back to back — the ear is a good judge once
 * it hears the two side by side.
 */
export function SayCheck({ word, onResult }: { word: SaidWord; onResult?: (r: HeardResult) => void }) {
  const lib = useLibrary();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HeardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Float32Array | null>(null);
  const recognises = canRecognise();
  const blocked = micUnavailable();
  const rec = useRecorder(setMine);

  useEffect(() => {
    setResult(null);
    setError(null);
    setMine(null);
  }, [word]);

  async function listen() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { alternatives } = await recogniseOnce().result;
      const readings = (ch: string) => lib.byChar.get(ch)?.py ?? [];
      const r = bestHeard(
        word.reading,
        alternatives.map((a) => a.transcript),
        readings,
      );
      if (r) {
        setResult(r);
        onResult?.(r);
      }
    } catch (e) {
      const code = (e as Error).message;
      setError(RECOGNITION_MESSAGE[code] ?? `Speech recognition stopped (${code}).`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="say-check">
      <div className="speak-word" style={{ minHeight: 0 }}>
        <span className="speak-hanzi" style={{ fontSize: 56 }}>
          {word.word}
        </span>
        <span className="speak-reading">{word.reading}</span>
      </div>

      {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}

      {recognises ? (
        <div className="speak-controls">
          <button className="btn speak-side" onClick={() => void say(word.word, { slow: true })}>
            <span aria-hidden>🔊</span> Listen
          </button>
          <button className="btn primary say-go" disabled={busy || !!blocked} onClick={() => void listen()}>
            {busy ? 'Listening…' : 'Say it'}
          </button>
          <span className="speak-side" />
        </div>
      ) : (
        <>
          <div className="speak-controls">
            <button className="btn speak-side" onClick={() => void say(word.word, { slow: true })}>
              <span aria-hidden>🔊</span> Listen
            </button>
            <RecordButton state={rec.state} level={rec.level} onToggle={rec.toggle} disabled={!!blocked} />
            <button className="btn speak-side" disabled={!mine} onClick={() => mine && rec.play(mine)}>
              <span aria-hidden>▶</span> Me
            </button>
          </div>
          <p className="tiny muted" style={{ margin: 0, maxWidth: 420 }}>
            This browser cannot check consonants for you. Record yourself, then play the word and your recording
            one after the other and listen for the difference.
          </p>
        </>
      )}

      {(error || rec.error) && <p className="notice speak-notice">{error ?? rec.error}</p>}

      {result && (
        <div className="heard">
          <span className="tiny muted">It wrote down</span>
          <span className="heard-text hanzi">{result.text || '—'}</span>
          <div className="verdicts">
            {result.syllables.map((s, i) => (
              <div key={i} className="verdict" data-state={s.off.length ? 'wrong' : 'right'}>
                <span className="verdict-hanzi">{[...word.word][i]}</span>
                <span className="verdict-py">{s.want}</span>
                <b>{s.off.length ? 'Heard differently' : 'Heard as meant'}</b>
                <span className="tiny muted">{s.off.length ? describeMiss(s) : s.got}</span>
              </div>
            ))}
          </div>
          {result.clean && (
            <p className="small" style={{ margin: 0 }}>
              Exactly what you meant.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
