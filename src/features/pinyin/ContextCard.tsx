import { useCallback, useState } from 'react';
import { bestHeard, describeMiss, heardShare, missed, understood, type HeardResult } from '../../domain/pinyin/heard';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { canRecognise } from '../../platform/audio/recognition';
import { useLibrary } from '../shared/library';
import { RecordButton } from './RecordButton';
import type { ShadowSentence } from './ShadowPage';
import { recordSaid } from './progress';
import { useSayIt } from './useSayIt';
import { say } from '../../platform/audio/voiceOut';

const HAN = /[一-鿿]/;

/**
 * A sentence to say in a situation, from its meaning rather than its
 * characters.
 *
 * Shadowing is copying: the sentence is on the screen and a voice has just
 * said it, so what it measures is the ear and the mouth. Talking to somebody
 * is different — you know what you want to say, and the Chinese has to come
 * out of your own head at a speed that keeps the conversation going. So here
 * the page sets the scene, says what the other person said, and gives only
 * the English of your answer. You say it; recognition, which hears a whole
 * sentence the way a listener does, writes down what it heard; and only then
 * the Chinese and a native speaker saying it.
 *
 * The Chinese is there behind a button for when it will not come. A sentence
 * said from the screen still says something about how it sounded, so it
 * still counts towards being understood.
 */
export function ContextCard({
  sentence,
  at,
  total,
  onMove,
}: {
  sentence: ShadowSentence;
  at: number;
  total: number;
  onMove: (delta: number) => void;
}) {
  const lib = useLibrary();
  const [heard, setHeard] = useState<HeardResult | null>(null);
  const [shown, setShown] = useState(false);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const blocked = micUnavailable();
  const context = sentence.context!;
  const syllables = sentence.py.split(' ');

  const onHeard = useCallback(
    (alternatives: string[]) => {
      const h = bestHeard(sentence.py, alternatives, (ch) => lib.byChar.get(ch)?.py ?? [], sentence.zh);
      setHeard(h);
      if (h) recordSaid({ id: sentence.id, mode: 'context', ok: understood(h, sentence.zh), share: heardShare(h) });
    },
    [sentence, lib],
  );
  const rec = useSayIt(setSamples, onHeard, 2500 + 500 * syllables.length);
  const sayIt = useCallback(() => {
    if (rec.state === 'idle') setHeard(null);
    rec.toggle();
  }, [rec]);

  const ok = heard ? understood(heard, sentence.zh) : false;
  const revealed = shown || !!heard;

  let k = 0;
  const tiles = [...sentence.zh].map((ch, i) =>
    HAN.test(ch) ? (
      <span key={i} className="shadow-char" data-state={heard ? (missed(heard.syllables[k]) ? 'wrong' : 'right') : undefined}>
        <i>{syllables[k++]}</i>
        <b>{ch}</b>
      </span>
    ) : (
      <span key={i} className="shadow-punct">
        {ch}
      </span>
    ),
  );

  return (
    <div className="drill-stage shadow-stage context-stage">
      <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
        <button className="btn ghost sm" onClick={() => onMove(-1)} aria-label="Previous situation">
          ←
        </button>
        <span className="tiny muted">
          {at + 1} of {total} · HSK {sentence.hsk}
        </span>
        <button className="btn ghost sm" onClick={() => onMove(1)} aria-label="Next situation">
          →
        </button>
      </div>

      <div className="context-scene">
        <span className="tiny muted context-label">The situation</span>
        <p>{context.scene}</p>
        {context.before && (
          <div className="context-before">
            <span className="tiny muted">The {context.before.who} says</span>
            <span className="hanzi" lang="zh-CN">
              {context.before.zh}
            </span>
            <span className="tiny context-py">{context.before.py}</span>
            <span className="small muted">{context.before.en}</span>
          </div>
        )}
      </div>

      <div className="context-task">
        <span className="tiny muted context-label">You want to say</span>
        <p className="context-en">{sentence.en}</p>
      </div>

      {revealed ? (
        <div className="shadow-line" lang="zh-CN">
          {tiles}
        </div>
      ) : (
        <button className="btn ghost sm" onClick={() => setShown(true)}>
          Show the Chinese
        </button>
      )}

      {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}

      <div className="speak-controls">
        <button className="btn speak-side" disabled={!revealed} onClick={() => void say(sentence.zh)} title="How a native speaker says it">
          <span aria-hidden>🔊</span> Native
        </button>
        <RecordButton state={rec.state} level={rec.level} onToggle={sayIt} disabled={!!blocked} />
        <button className="btn speak-side" disabled={!samples} onClick={() => samples && rec.play(samples)}>
          <span aria-hidden>▶</span> Me
        </button>
      </div>

      {rec.error && <p className="notice speak-notice">{rec.error}</p>}
      {rec.heardError && <p className="notice speak-notice">{rec.heardError}</p>}
      {!canRecognise() && (
        <p className="tiny muted" style={{ margin: 0, maxWidth: 460 }}>
          This browser has no speech recognition, so nothing here can tell whether you were understood. Safari on the
          iPad has one, with Siri and Dictation switched on; so does Chrome.
        </p>
      )}

      {heard && (
        <div className="heard">
          <span className="tiny muted">It wrote down</span>
          <span className="heard-text hanzi" style={{ fontSize: 26 }}>
            {heard.text || '—'}
          </span>
          <p className="understood-verdict" data-state={ok ? 'right' : 'wrong'}>
            {ok ? 'Understood' : 'Not quite understood'}
          </p>
          {ok ? (
            <p className="small" style={{ margin: 0 }}>
              A listener would have got that. Now hear how a native speaker says it, and say it once more along with
              them.
            </p>
          ) : !heard.syllables.some(missed) ? (
            <p className="small" style={{ margin: 0 }}>
              Every sound was there, but it heard a different sentence around them — a word too many or too few.
            </p>
          ) : (
            <div className="verdicts">
              {heard.syllables
                .map((s, i) => ({ s, ch: [...sentence.zh].filter((c) => HAN.test(c))[i] }))
                .filter(({ s }) => missed(s))
                .map(({ s, ch }, i) => (
                  <div key={i} className="verdict" data-state="wrong">
                    <span className="verdict-hanzi">{ch}</span>
                    <span className="verdict-py">{s.want}</span>
                    <span className="tiny muted">{describeMiss(s)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <p className="tiny muted shadow-source">
        Said by {sentence.by} ·{' '}
        <a href={sentence.page} target="_blank" rel="noreferrer">
          {sentence.page.includes('tatoeba') ? 'Tatoeba' : 'Wikimedia Commons'}
        </a>
        , {sentence.license}
      </p>
    </div>
  );
}
