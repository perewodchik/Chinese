import { useEffect, useRef, useState } from 'react';
import type { NarratorDto } from '../../../shared/narration';
import type { EvalResult, SyllableEval } from '../../../shared/speechEval';
import { evaluatePhrase } from '../../api/speechEval';
import { attemptOf, heardTag, noteOf, numbered } from '../../domain/phrases';
import { matchSyllables, tagOf, type Fix } from '../../domain/speak';
import { heardAnything } from '../../platform/audio/mic';
import { hush, playSamples, unlockAudio } from '../../platform/audio/voiceOut';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { NOTHING_HEARD, troubleOf } from '../pinyin/lineTrouble';
import { RecordButton } from '../pinyin/RecordButton';
import { band } from '../pinyin/ScoredLine';
import { attemptId, keepTry } from '../pinyin/speechHistory';
import type { useRecorder } from '../pinyin/useRecorder';
import { modelSamples, playModel } from './modelVoice';

/**
 * One word of a line, practised alone until it is right: what was wrong and
 * how to make it right, the word heard (a native recording when the voice
 * pack has it, else the narrator) and slowly, said and scored on its own,
 * every try's number in a row so the climb is plain. Kept as a drill try,
 * not a line's, so a word said twenty times does not crowd the lines' history.
 */
export function FixSheet({
  fix,
  narrator,
  sourceId,
  recorder,
  listen,
  onHear,
  onClose,
}: {
  fix: Fix;
  narrator: NarratorDto | null;
  sourceId: string;
  recorder: ReturnType<typeof useRecorder>;
  /** route the microphone's next recordings here (or back to the line, with null) */
  listen: (cb: ((s: Float32Array) => void) | null) => void;
  onHear: (word: string) => Promise<void>;
  onClose: () => void;
}) {
  const readings = fix.chars.map((c) => c.py);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [slowBusy, setSlowBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  function score(s: Float32Array) {
    setNote(null);
    if (!heardAnything(s)) {
      setNote(NOTHING_HEARD);
      return;
    }
    setSamples(s);
    setChecking(true);
    evaluatePhrase(fix.word, s, numbered(readings))
      .then(
        (r) => {
          if (!live.current) return;
          if (r.rejected) {
            setNote(`That did not sound like ${fix.word}. Hear it, then say just the word.`);
            return;
          }
          const a = attemptOf(r, Date.now());
          keepTry({ id: attemptId(), at: a.at, kind: 'drill', sourceId, text: fix.word, tally: `fix:${fix.word}`.slice(0, 80), good: a.faults.length === 0, summary: a, result: r });
          setResult(r);
          setScores((x) => [...x, Math.round(r.total)].slice(-8));
        },
        (err: unknown) => live.current && setNote(troubleOf(err).text),
      )
      .finally(() => live.current && setChecking(false));
  }
  // The microphone's recordings come here while the sheet is open.
  const scoreRef = useRef(score);
  scoreRef.current = score;
  useEffect(() => {
    listen((s) => scoreRef.current(s));
    return () => listen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function slowly() {
    if (!narrator || slowBusy) return;
    unlockAudio();
    hush();
    setSlowBusy(true);
    try {
      const s = await modelSamples(narrator, fix.word, { slow: true });
      if (live.current) void playModel(s);
    } catch (e) {
      if (live.current) setNote(e instanceof Error ? e.message : 'MiniMax did not answer.');
    } finally {
      if (live.current) setSlowBusy(false);
    }
  }

  const match = matchSyllables(fix.word, result);
  const right = result !== null && result.syllables.every((s) => noteOf(s).band === 'good');
  const state = checking ? 'checking' : recorder.state;

  return (
    <Modal
      title={`Practise ${fix.word}`}
      subtitle="Hear it, say just the word, and again until it is green."
      onClose={onClose}
      footer={
        <div className="sk-sheet-foot">
          <button className={`btn ${right ? 'primary' : 'tonal'}`} onClick={onClose}>
            Back to the line
          </button>
        </div>
      }
    >
      <div className="sk-practise">
        <div className="sk-practise-word" aria-label={fix.word}>
          {fix.chars.map((c, i) => {
            const syl = match[i] !== null && result ? result.syllables[match[i]!]! : null;
            const n = syl ? noteOf(syl) : null;
            return (
              <span key={i} className="sk-tile" data-state={!n ? undefined : n.band === 'good' ? 'ok' : n.band === 'mid' ? 'nearly' : 'bad'}>
                <span className="sk-tile-py">{c.py}</span>
                <span className="sk-tile-zh hanzi">{c.char}</span>
                <span className="sk-tile-tag">{syl ? tagOf(syl) : ''}</span>
              </span>
            );
          })}
        </div>

        <div className="sk-practise-hear">
          <button className="btn tonal" onClick={() => void onHear(fix.word)}>
            <Icon name="play" size={18} /> Hear it
          </button>
          <button className="btn tonal" onClick={() => void slowly()} disabled={!narrator} aria-busy={slowBusy || undefined}>
            {slowBusy ? <span className="spinner" aria-hidden /> : <Icon name="play" size={18} />} Slowly
          </button>
          <button
            className="btn quiet"
            onClick={() => {
              if (!samples) return;
              hush();
              void playSamples(samples);
            }}
            disabled={!samples}
          >
            <Icon name="sound" size={18} /> Yours
          </button>
        </div>

        <div className="sk-practise-rec">
          <RecordButton state={state} level={recorder.level} onToggle={() => (recorder.state === 'listening' || recorder.state === 'hearing' ? recorder.finish() : (hush(), recorder.toggle()))} />
        </div>

        <div className="sk-practise-out" aria-live="polite">
          {result ? (
            <p className="small">
              <b data-band={band(result.total)} className="sk-num">
                {Math.round(result.total)}
              </b>{' '}
              {right ? '' : heardOf(result.syllables)}
            </p>
          ) : (
            <p className="small sk-practise-faults">{heardOf(fix.chars.flatMap((c) => (c.syl ? [c.syl] : [])))}</p>
          )}
          {scores.length > 1 && <p className="tiny muted">Your tries: {scores.join(' · ')}</p>}
          {note && (
            <p className="small muted" role="status">
              {note}
            </p>
          )}
          {recorder.error && (
            <p className="small ph-error" role="alert">
              {recorder.error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** What the service heard wrong, character by character, in its own terms (zh → z, tone 2 → 1): nothing of the app's own. */
function heardOf(syls: SyllableEval[]): string {
  return syls
    .map((s) => [s.char, heardTag(s)] as const)
    .filter(([, t]) => t)
    .map(([c, t]) => `${c} ${t}`)
    .join(' · ');
}
