import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { analyse, calibrate, type Attempt } from '../../domain/pinyin/analyse';
import { semitones, type VoiceRange } from '../../domain/pinyin/contour';
import { CALIBRATION } from '../../domain/pinyin/practice';
import { parseSyllable, syllables } from '../../domain/pinyin/syllable';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { trackPitch } from '../../platform/audio/pitch';
import { canRecognise, recogniseOnce, RECOGNITION_MESSAGE } from '../../platform/audio/recognition';
import { speak } from '../../platform/speech';
import { paths } from '../../navigation/paths';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { PitchStaff } from './PitchStaff';
import { RecordButton } from './RecordButton';
import { useRecorder } from './useRecorder';
import { saveRange, usePinyinMemory } from './voice';
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
        <Link className="btn ghost sm" to={paths.pinyin()}>
          ← Pronunciation
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
          <button className="btn speak-side" onClick={() => speak(CALIBRATION.word, { rate: 0.6 })}>
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

/** Words that each lean on one family of sounds English speakers mix up. */
const SOUND_WORDS: Array<{ word: string; reading: string; focus: string }> = [
  { word: '学校', reading: 'xué xiào', focus: 'x' },
  { word: '起床', reading: 'qǐ chuáng', focus: 'q · ch' },
  { word: '知道', reading: 'zhī dào', focus: 'zh' },
  { word: '老师', reading: 'lǎo shī', focus: 'sh' },
  { word: '四十', reading: 'sì shí', focus: 's · sh' },
  { word: '自己', reading: 'zì jǐ', focus: 'z · j' },
  { word: '绿色', reading: 'lǜ sè', focus: 'ü' },
  { word: '去年', reading: 'qù nián', focus: 'q · ü' },
  { word: '心情', reading: 'xīn qíng', focus: '-n · -ng' },
  { word: '很冷', reading: 'hěn lěng', focus: '-n · -ng' },
];

interface Check {
  heard: string;
  /** per target syllable: what was heard there, and whether its sounds matched */
  syllables: Array<{ want: string; got: string | null; same: boolean }>;
  exact: boolean;
}

function SoundCheck({ disabled }: { disabled: boolean }) {
  const lib = useLibrary();
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = canRecognise();
  const target = SOUND_WORDS[at % SOUND_WORDS.length]!;

  async function listen() {
    setBusy(true);
    setError(null);
    setCheck(null);
    try {
      const { alternatives } = await recogniseOnce().result;
      const best = alternatives.find((a) => a.transcript.includes(target.word)) ?? alternatives[0];
      const heard = (best?.transcript ?? '').replace(/[，。！？、,.!?\s]/g, '');
      const want = syllables(target.reading);
      const got = [...heard].map((ch) => lib.byChar.get(ch)?.py[0] ?? null);
      setCheck({
        heard,
        exact: heard.includes(target.word),
        syllables: want.map((w, i) => {
          const g = got[i] ? parseSyllable(got[i]!) : null;
          return { want: w.py, got: got[i] ?? null, same: !!g && g.initial === w.initial && g.final === w.final };
        }),
      });
    } catch (e) {
      const code = (e as Error).message;
      setError(RECOGNITION_MESSAGE[code] ?? `Speech recognition stopped (${code}).`);
    } finally {
      setBusy(false);
    }
  }

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
        {!supported ? (
          <p className="notice speak-notice">
            This browser has no speech recognition. Safari on the iPad does, with Siri &amp; Dictation switched on;
            so does Chrome.
          </p>
        ) : (
          <>
            <div className="speak-word" style={{ minHeight: 0 }}>
              <span className="tiny muted">{target.focus}</span>
              <span className="speak-hanzi" style={{ fontSize: 44 }}>
                {target.word}
              </span>
              <span className="speak-reading">{target.reading}</span>
            </div>
            <div className="speak-controls">
              <button className="btn speak-side" onClick={() => speak(target.word, { rate: 0.75 })}>
                <span aria-hidden>🔊</span> Listen
              </button>
              <button className="btn primary" disabled={busy || disabled} onClick={() => void listen()}>
                {busy ? 'Listening…' : 'Say it'}
              </button>
              <button
                className="btn speak-side"
                onClick={() => {
                  setAt((n) => n + 1);
                  setCheck(null);
                  setError(null);
                }}
              >
                Next word
              </button>
            </div>
            {error && <p className="notice speak-notice">{error}</p>}
            {check && (
              <div className="heard">
                <span className="tiny muted">It wrote down</span>
                <span className="heard-text hanzi">{check.heard || '—'}</span>
                <div className="verdicts">
                  {check.syllables.map((s, i) => (
                    <div key={i} className="verdict" data-state={s.same ? 'right' : 'wrong'}>
                      <span className="verdict-py">{s.want}</span>
                      <b>{s.same ? 'Heard' : 'Heard as'}</b>
                      <span className="tiny muted">{s.same ? 'as meant' : (s.got ?? 'nothing')}</span>
                    </div>
                  ))}
                </div>
                {check.exact && <p className="small" style={{ margin: 0 }}>Exactly what you meant.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
