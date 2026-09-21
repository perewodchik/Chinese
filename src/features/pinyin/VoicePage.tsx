import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { analyse, calibrate, type Attempt } from '../../domain/pinyin/analyse';
import { semitones, type VoiceRange } from '../../domain/pinyin/contour';
import { CALIBRATION } from '../../domain/pinyin/practice';
import { SOUND_LESSONS } from '../../domain/pinyin/sounds';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { trackPitch } from '../../platform/audio/pitch';
import { canRecognise } from '../../platform/audio/recognition';
import { paths } from '../../navigation/paths';
import { useTitle } from '../../ui/useTitle';
import { PitchStaff } from './PitchStaff';
import { RecordButton } from './RecordButton';
import { SayCheck } from './SayCheck';
import { useRecorder } from './useRecorder';
import { saveRange, usePinyinMemory } from './voice';
import { say } from './voiceOut';
import './pinyin.css';

/**
 * The microphone and the voice behind it: measured once, checked any time.
 *
 * Two jobs. The voice range, which every tone is judged against. And a check
 * of the sounds that pitch cannot see — whether the machine hears q or ch,
 * s or sh — using the browser's own speech recognition, which is crude but
 * native, and which may or may not be switched on on this device. Finding
 * that out here, once, is better than finding it out in the middle of a text.
 */
export function VoicePage() {
  useTitle('Your voice');
  const memory = usePinyinMemory();
  const blocked = micUnavailable();

  return (
    <section className="pinyin voice-page">
      <div className="row" style={{ marginBottom: 18 }}>
        <Link className="btn ghost sm" to={paths.speaking()}>
          ← Speaking
        </Link>
      </div>
      <h1 style={{ margin: 0 }}>Your voice</h1>
      <p className="small muted" style={{ margin: '2px 0 18px' }}>
        Everyone's high and low are different, so tones are judged on your own scale — 1 the bottom of your voice, 5
        the top.
      </p>

      {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}

      <div className="voice-grid">
        <Calibration current={memory.range} disabled={!!blocked} />
        <SoundCheck disabled={!!blocked} />
      </div>
    </section>
  );
}

function describeRange(r: VoiceRange) {
  return `${Math.round(r.floorHz)}–${Math.round(r.ceilHz)} Hz, ${semitones(r.ceilHz, r.floorHz).toFixed(0)} semitones`;
}

function Calibration({ current, disabled }: { current: VoiceRange | null; disabled: boolean }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [found, setFound] = useState<VoiceRange | null>(null);
  const [failed, setFailed] = useState(false);
  const [take, setTake] = useState(0);

  const onRecorded = useCallback((s: Float32Array) => {
    const frames = trackPitch(s, { sampleRate: 16000 });
    const range = calibrate(frames);
    setFound(range);
    setFailed(!range);
    setAttempt(analyse(frames, CALIBRATION.spoken, range));
    setTake((n) => n + 1);
  }, []);
  const rec = useRecorder(onRecorded, 6000);
  const judged = attempt && !attempt.problem ? attempt.syllables : null;

  return (
    <div className="card voice-card">
      <header>
        <h2>Your range</h2>
        <div className="spacer" />
        {current && <span className="tiny muted">{describeRange(current)}</span>}
      </header>
      <div className="body voice-body">
        <p className="small" style={{ margin: 0 }}>
          Say the four tones on one syllable, with a short pause between them. Go properly high on the first and
          properly low on the third — this is the one time exaggerating helps.
        </p>
        <div className="speak-word" style={{ minHeight: 0 }}>
          <span className="speak-hanzi" style={{ fontSize: 44 }}>
            {CALIBRATION.word}
          </span>
          <span className="speak-reading">{CALIBRATION.reading}</span>
        </div>
        <div className="staff-card">
          <PitchStaff
            take={take}
            line={judged ? attempt!.line : undefined}
            syllables={CALIBRATION.spoken.map((s, i) => ({
              tone: s.surface,
              halfThird: false,
              from: judged?.[i]?.from,
              to: judged?.[i]?.to,
              verdict: judged?.[i]?.judged.verdict,
            }))}
          />
        </div>
        <div className="speak-controls">
          <button className="btn speak-side" onClick={() => void say('妈，麻，马，骂', { slow: true })}>
            <span aria-hidden>🔊</span> Listen
          </button>
          <RecordButton state={rec.state} level={rec.level} onToggle={rec.toggle} disabled={disabled} />
          <span className="speak-side" />
        </div>
        {rec.error && <p className="notice speak-notice">{rec.error}</p>}
        {failed && (
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
            That did not give a clear range. Try again, a little louder, with the first tone high and the third low.
          </p>
        )}
        {found && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <span className="small">
              Measured <b>{describeRange(found)}</b>
            </span>
            <button className="btn primary sm" onClick={() => saveRange(found)}>
              {current ? 'Use this instead' : 'Use this'}
            </button>
          </div>
        )}
        {current && !found && (
          <p className="tiny muted" style={{ margin: 0, textAlign: 'center' }}>
            Set. Measure again if you change microphone or the tones start being judged oddly.{' '}
            <button className="btn ghost sm" onClick={() => saveRange(null)}>
              Forget it
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One word from each sound lesson, as a quick check of where things stand —
 * the lessons themselves are where each one is practised.
 */
const SOUND_WORDS = SOUND_LESSONS.map((l) => ({ lesson: l, word: l.words[0]! }));

function SoundCheck({ disabled }: { disabled: boolean }) {
  const [at, setAt] = useState(0);
  const { lesson, word } = SOUND_WORDS[at % SOUND_WORDS.length]!;

  return (
    <div className="card voice-card">
      <header>
        <h2>Can it hear your sounds?</h2>
        <div className="spacer" />
        <span className="tiny muted">experimental</span>
      </header>
      <div className="body voice-body">
        <p className="small" style={{ margin: 0 }}>
          Pitch shows tones, not consonants. For those, the browser's own speech recognition listens and writes
          down what it heard: if you say 起床 and it writes something with <i>ch</i> where the <i>q</i> should
          be, your q is drifting.
        </p>
        {!canRecognise() && (
          <p className="notice speak-notice">
            This browser has no speech recognition. Safari on the iPad does, with Siri &amp; Dictation switched on;
            so does Chrome.
          </p>
        )}
        <Link className="tiny muted" to={paths.speakingSounds(lesson.id)}>
          {lesson.mark} — {lesson.title.toLowerCase()}
        </Link>
        {!disabled && <SayCheck word={word} />}
        <button className="btn sm" onClick={() => setAt((n) => n + 1)}>
          Another sound →
        </button>
      </div>
    </div>
  );
}
