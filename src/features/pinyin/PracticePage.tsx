import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { analyse, type Attempt } from '../../domain/pinyin/analyse';
import { resample, TONE_NAME, type Verdict } from '../../domain/pinyin/contour';
import { singleTones, tonePairs, type PracticeWord } from '../../domain/pinyin/practice';
import { RULE_NOTE } from '../../domain/pinyin/sandhi';
import { withTone } from '../../domain/pinyin/syllable';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { trackPitch } from '../../platform/audio/pitch';
import { paths } from '../../navigation/paths';
import { useStore } from '../../store/store';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { PitchStaff } from './PitchStaff';
import { RecordButton } from './RecordButton';
import { useRecorder } from './useRecorder';
import { pairKey, record, toneKey, voiceRange } from './voice';
import { anyVoiceFor, packTexts, packVoices, referenceSamples, say, voicesFor } from './voiceOut';
import './pinyin.css';

interface PracticeSet {
  id: string;
  title: string;
  hint: string;
  tally: string;
  words: PracticeWord[];
}

/**
 * `pair-3-3` or `tone-2`, turned into something to say — only the words a
 * native speaker has recorded.
 *
 * A word nobody recorded would be read by the system voice, which is a
 * machine, and the one thing a drill must never do is teach a tone from a
 * machine. So those words are left out rather than read badly. Should the
 * pack be missing altogether the whole list comes back, since a drill with no
 * words is no drill at all. Undefined while the pack is still loading.
 */
function usePracticeSet(id: string | undefined): PracticeSet | null | undefined {
  const lib = useLibrary();
  const [voiced, setVoiced] = useState<Set<string> | null>(null);
  useEffect(() => {
    void packTexts().then(setVoiced);
  }, []);
  const set = useMemo(() => {
    const pair = /^pair-([1-4])-([1-5])$/.exec(id ?? '');
    if (pair) {
      const [a, b] = [Number(pair[1]), Number(pair[2])];
      const words = tonePairs(lib).find((p) => p.first === a && p.second === b)?.words ?? [];
      return {
        id: id!,
        title: `${TONE_NAME[a]} + ${TONE_NAME[b]}`.replace(/^./, (c) => c.toUpperCase()),
        hint: `Two syllables: ${TONE_NAME[a]}, then ${TONE_NAME[b]}. Listen, then say it.`,
        tally: pairKey(`${a}-${b}`),
        words,
      };
    }
    const tone = /^tone-([1-4])$/.exec(id ?? '');
    if (tone) {
      const t = Number(tone[1]);
      return {
        id: id!,
        title: `The ${TONE_NAME[t]} tone`,
        hint: 'One syllable at a time. Listen, then say it.',
        tally: toneKey(t),
        words: singleTones(lib)[t] ?? [],
      };
    }
    return null;
  }, [id, lib]);
  return useMemo(() => {
    if (!set) return set;
    if (!voiced) return undefined;
    const recorded = set.words.filter((w) => voiced.has(w.word));
    return recorded.length ? { ...set, words: recorded } : set;
  }, [set, voiced]);
}

/** One sitting of saying things, at /pinyin/practice/:set. */
export function PracticePage() {
  const { set: setId } = useParams();
  const set = usePracticeSet(setId);
  if (set === undefined) return null;
  if (!set || !set.words.length) return <Navigate to={paths.speaking()} replace />;
  return <Sitting key={set.id} set={set} />;
}

interface Result {
  word: PracticeWord;
  firstTry: boolean;
  tries: number;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  right: 'Right',
  close: 'Nearly',
  wrong: 'Not yet',
  light: 'Light',
  unheard: 'Not heard',
};

/**
 * The same verdicts, for when the chart is off and the only question is
 * whether a listener would have understood. "Nearly" still counts: a tone
 * that was a coin toss for the checker is one a listener gets from context.
 */
const PLAIN_LABEL: Record<Verdict, string> = {
  right: 'Understood',
  close: 'Understood',
  wrong: 'Not understood',
  light: 'Understood',
  unheard: 'Not heard',
};
const PLAIN_STATE: Record<Verdict, 'right' | 'wrong' | undefined> = {
  right: 'right',
  close: 'right',
  wrong: 'wrong',
  light: 'right',
  unheard: undefined,
};

function Sitting({ set }: { set: PracticeSet }) {
  useTitle(set.title);
  const navigate = useNavigate();
  const [at, setAt] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [take, setTake] = useState(0);
  const [tries, setTries] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const blocked = micUnavailable();
  const chart = useStore((s) => s.settings.pitchChart);

  const word = set.words[at];
  const exit = () => navigate(paths.speaking(), { replace: true });

  const onRecorded = useCallback(
    (s: Float32Array) => {
      if (!word) return;
      const frames = trackPitch(s, { sampleRate: 16000 });
      const a = analyse(frames, word.spoken, voiceRange());
      setSamples(s);
      setAttempt(a);
      setTake((n) => n + 1);
      if (a.problem) return;
      const good = a.syllables.every((x) => x.judged.verdict === 'right' || x.judged.verdict === 'light');
      record(set.tally, good);
      setTries((n) => n + 1);
      if (good || tries === 0) {
        // The first try is what counts for the tally; a later success only
        // counts as having got there.
        setResults((r) => (r.some((x) => x.word === word) ? r : [...r, { word, firstTry: good, tries: tries + 1 }]));
      }
    },
    [word, set.tally, tries],
  );

  const rec = useRecorder(onRecorded, 1800 + 700 * (word?.syllables.length ?? 1));

  // Who says this word. Several native speakers often recorded the same
  // one, and hearing a tone pair in more than one voice is what teaches the
  // ear which part is the tone and which is the person: so each word opens
  // in one of them (the learner's chosen voice if it has the word) and
  // "Another speaker" goes round the rest.
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [speaker, setSpeaker] = useState<string | undefined>(undefined);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    void packVoices().then((vs) => setNames(Object.fromEntries(vs.map((v) => [v.id, v.name]))));
  }, []);
  useEffect(() => {
    if (!word) return;
    let live = true;
    setSpeaker(undefined);
    void Promise.all([voicesFor(word.word), anyVoiceFor(word.word)]).then(([all, first]) => {
      if (!live) return;
      setSpeakers(all);
      setSpeaker(first ?? all[0] ?? '');
    });
    return () => {
      live = false;
    };
  }, [word]);
  const otherSpeaker = useCallback(() => {
    if (speakers.length < 2 || speaker === undefined) return;
    const nextOne = speakers[(speakers.indexOf(speaker) + 1) % speakers.length]!;
    setSpeaker(nextOne);
    if (word) void say(word.word, { voice: nextOne });
  }, [speakers, speaker, word]);

  const listen = useCallback(
    () => void (word && speaker !== undefined && say(word.word, { slow: true, voice: speaker || undefined })),
    [word, speaker],
  );

  // With a natural voice, the reference on the staff is that voice's own pitch
  // rather than the textbook shape: real sandhi, a real neutral tone, the
  // exact thing being imitated. Measured on its own scale, like the learner.
  const [native, setNative] = useState<Array<number[] | null> | null>(null);
  useEffect(() => {
    setNative(null);
    if (!word || speaker === undefined) return;
    let live = true;
    void referenceSamples(word.word, { slow: true, voice: speaker || undefined }).then((s) => {
      if (!live || !s) return;
      const a = analyse(trackPitch(s, { sampleRate: 16000 }), word.spoken, null);
      if (a.problem) return;
      setNative(
        a.syllables.map((syl) => {
          const pts = a.line.filter((p) => p.t >= syl.from && p.t <= syl.to && Number.isFinite(p.chao)).map((p) => p.chao);
          // The tenth at each end is left off, as the checker leaves it off:
          // the consonant's push at the start and the voice trailing away at
          // the end are where a pitch tracker jumps an octave, and a spike to
          // the top of the staff is not a tone anybody should copy.
          const cut = Math.floor(pts.length * 0.1);
          const kept = pts.slice(cut, pts.length - cut || undefined);
          return kept.length > 3 ? resample(kept, 16) : null;
        }),
      );
    });
    return () => {
      live = false;
    };
  }, [word, speaker]);
  const next = useCallback(() => {
    setAt((n) => n + 1);
    setAttempt(null);
    setSamples(null);
    setTries(0);
  }, []);

  // A new word is heard before it is said: imitation first, then comparison.
  // Once, when its first speaker is known — not again on "Another speaker",
  // which says it itself.
  const heard = useRef<PracticeWord | null>(null);
  useEffect(() => {
    if (word && speaker !== undefined && heard.current !== word) {
      heard.current = word;
      const id = setTimeout(listen, 250);
      return () => clearTimeout(id);
    }
  }, [word, speaker, listen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        rec.toggle();
      } else if (e.key === 'l' || e.key === 'L') listen();
      else if ((e.key === 'p' || e.key === 'P') && samples) rec.play(samples);
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && attempt) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rec, listen, samples, attempt, next]);

  if (!word) return <Done set={set} results={results} onExit={exit} />;

  const judged = attempt && !attempt.problem ? attempt.syllables : null;
  const rules = [...new Set(word.spoken.map((s) => s.rule).filter(Boolean))] as Array<keyof typeof RULE_NOTE>;
  // Saying the dictionary's tone where a rule changes it is its own mistake,
  // and the useful thing to hear is the rule, not a description of the shape.
  const tip = judged
    ?.map((s, i) => {
      const sp = word.spoken[i]!;
      if (sp.rule && s.judged.verdict !== 'right' && s.judged.guess?.tone === sp.citation) {
        return `That was the dictionary's ${TONE_NAME[sp.citation]} tone. ${RULE_NOTE[sp.rule]}`;
      }
      return s.judged.tip;
    })
    .find(Boolean);
  const allRight = judged?.every((s) => s.judged.verdict === 'right' || s.judged.verdict === 'light');

  return (
    <section className="drill">
      <div className="drill-head">
        <button className="btn ghost sm" onClick={exit} title="Stop here — what you said is kept">
          ← Stop
        </button>
        <div style={{ minWidth: 0 }}>
          <b>{set.title}</b>
          <div className="tiny muted">{set.hint}</div>
        </div>
        <div className="spacer" />
        <span className="tiny muted">
          {at + 1} of {set.words.length}
        </span>
        <div className="bar" style={{ width: 140 }}>
          <i className="learned" style={{ width: `${(at / set.words.length) * 100}%` }} />
        </div>
      </div>

      <div className="drill-stage speak-stage">
        {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}

        <div className="speak-word">
          <span className="speak-hanzi">{word.word}</span>
          <span className="speak-reading">{word.reading}</span>
          <span className="small muted">{word.gloss}</span>
          {rules.length > 0 && (
            <span className="speak-said tiny">
              Said{' '}
              <b>
                {word.syllables.map((s, i) => withTone(s.bare, word.spoken[i]!.surface)).join(' ')}
              </b>{' '}
              — {rules.map((r) => RULE_NOTE[r]).join(' ')}
            </span>
          )}
        </div>

        {chart && (
          <div className="staff-card">
            <PitchStaff
              take={take}
              references={native}
              line={judged ? attempt!.line : undefined}
              syllables={word.spoken.map((s, i) => ({
                tone: s.surface,
                halfThird: s.halfThird,
                from: judged?.[i]?.from,
                to: judged?.[i]?.to,
                verdict: judged?.[i]?.judged.verdict,
              }))}
            />
            <div className="staff-legend tiny muted">
              <span>
                <i className="key-ref" /> {native ? 'the voice you are copying' : 'the shape to aim for'}
              </span>
              <span>
                <i className="key-voice" /> your voice
              </span>
            </div>
          </div>
        )}

        <div className="speak-controls">
          <button className="btn speak-side" onClick={listen} title="Listen (L)">
            <span aria-hidden>🔊</span> Listen
          </button>
          <RecordButton state={rec.state} level={rec.level} onToggle={rec.toggle} disabled={!!blocked} />
          <button
            className="btn speak-side"
            onClick={() => samples && rec.play(samples)}
            disabled={!samples}
            title="Hear yourself (P)"
          >
            <span aria-hidden>▶</span> Me
          </button>
        </div>

        {speaker && (
          <div className="row speak-speaker" style={{ justifyContent: 'center', gap: 10 }}>
            <span className="tiny muted">Said by {names[speaker] ?? speaker}</span>
            {speakers.length > 1 && (
              <button className="btn ghost sm" onClick={otherSpeaker}>
                Another speaker ({speakers.length})
              </button>
            )}
          </div>
        )}

        {rec.error && <p className="notice speak-notice">{rec.error}</p>}

        {attempt?.problem && (
          <p className="small muted" style={{ margin: 0 }}>
            {attempt.problem === 'silent'
              ? 'Nothing was heard. Say it a little louder, or closer to the microphone.'
              : `Could not find ${word.syllables.length} syllables in that. Say it again, a touch more slowly.`}
          </p>
        )}

        {judged && (
          <>
            <div className="verdicts">
              {judged.map((s, i) => {
                const sp = word.spoken[i]!;
                const heard = s.judged.guess?.tone;
                return (
                  <div key={i} className="verdict" data-state={chart ? s.judged.verdict : PLAIN_STATE[s.judged.verdict]}>
                    <span className="verdict-hanzi">{[...word.word][i]}</span>
                    <span className="verdict-py">{withTone(word.syllables[i]!.bare, sp.surface)}</span>
                    <b>{(chart ? VERDICT_LABEL : PLAIN_LABEL)[s.judged.verdict]}</b>
                    {chart && (
                      <span className="tiny muted">
                        {s.judged.verdict === 'light'
                          ? 'neutral — short and soft'
                          : s.judged.verdict === 'right'
                            ? `a clear ${TONE_NAME[sp.surface]}`
                            : heard
                              ? `sounded like a ${TONE_NAME[heard]}`
                              : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {chart && tip && <p className="speak-tip">{tip}</p>}
            {chart && attempt!.selfScaled && (
              <p className="tiny muted" style={{ margin: 0 }}>
                Your voice range is not set, so how high is guessed from this recording.{' '}
                <Link to={paths.speakingVoice()}>Set it up</Link> — it takes twenty seconds.
              </p>
            )}
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className={`btn${allRight ? ' primary' : ''}`} onClick={next}>
                {at + 1 < set.words.length ? 'Next word' : 'Finish'} <span className="key-hint tiny">↵</span>
              </button>
            </div>
          </>
        )}

        {!judged && (
          <p className="tiny muted key-hint" style={{ margin: 0 }}>
            Space to record · L to listen · P to hear yourself
          </p>
        )}
      </div>
    </section>
  );
}

function Done({ set, results, onExit }: { set: PracticeSet; results: Result[]; onExit: () => void }) {
  const first = results.filter((r) => r.firstTry).length;
  const again = results.filter((r) => !r.firstTry);
  return (
    <div className="drill-done">
      <span className="big hanzi">{again.length ? '差不多' : '好'}</span>
      <h2 style={{ fontSize: 17, margin: '4px 0 2px' }}>
        {first} of {results.length} right the first time
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        {results.length === 0
          ? 'Nothing was recorded this time.'
          : again.length
            ? `${set.title}: these took more than one go.`
            : `${set.title}: every one on the first try.`}
      </p>
      {again.length > 0 && (
        <div className="missed-row">
          {again.map((r) => (
            <span key={r.word.word} className="new-char">
              <span className="hanzi" style={{ fontSize: 26 }}>
                {r.word.word}
              </span>
              <span className="tiny muted">{r.word.reading}</span>
            </span>
          ))}
        </div>
      )}
      <button className="btn primary" onClick={onExit} style={{ marginTop: 6 }}>
        Done
      </button>
    </div>
  );
}
