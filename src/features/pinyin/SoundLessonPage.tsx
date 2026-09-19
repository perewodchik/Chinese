import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { lessonById, type MinimalPair, type SaidWord, type SoundLesson } from '../../domain/pinyin/sounds';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { SayCheck } from './SayCheck';
import { hearKey, record, recentScore, sayKey, usePinyinMemory } from './voice';
import { anyVoiceFor, say } from './voiceOut';
import './pinyin.css';

type Step = 'learn' | 'hear' | 'say';
const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'learn', label: '1 · How it is made' },
  { id: 'hear', label: '2 · Hear it' },
  { id: 'say', label: '3 · Say it' },
];

/** One sound lesson, at /pinyin/sounds/:lesson?step=hear. */
export function SoundLessonPage() {
  const { lesson: id } = useParams();
  const lesson = lessonById(id);
  const [query, setQuery] = useQuery();
  const step = oneOf(query.get('step'), ['learn', 'hear', 'say'] as const, 'learn');
  useTitle(lesson?.title);
  if (!lesson) return <Navigate to={paths.pinyin()} replace />;

  const go = (s: Step) => setQuery('step', s, 'learn');

  return (
    <section className="pinyin lesson">
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" to={paths.pinyin()}>
          ← Pronunciation
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 18, alignItems: 'flex-end' }}>
        <div>
          <span className="lesson-mark">{lesson.mark}</span>
          <h1 style={{ margin: 0 }}>{lesson.title}</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            {lesson.blurb}
          </p>
        </div>
        <div className="spacer" />
        <Seg value={step} options={STEPS} onChange={go} label="Step" />
      </div>

      {step === 'learn' && <Learn lesson={lesson} onNext={() => go('hear')} />}
      {step === 'hear' && <Hear key={lesson.id} lesson={lesson} onNext={() => go('say')} />}
      {step === 'say' && <SayIt key={lesson.id} lesson={lesson} />}
    </section>
  );
}

/* ------------------------------------------------------------------ learn */

function Learn({ lesson, onNext }: { lesson: SoundLesson; onNext: () => void }) {
  return (
    <>
      <div className="note-grid">
        {lesson.notes.map((n) => (
          <article key={n.sound} className="card note-card">
            <header>
              <span className="note-sound">{n.sound}</span>
              <div className="spacer" />
              <span className="note-example">
                <span className="hanzi">{n.example.word}</span> <span className="note-py">{n.example.reading}</span>
                <button className="say" aria-label={`Hear ${n.example.word}`} onClick={() => void say(n.example.word, { slow: true })}>
                  🔊
                </button>
              </span>
            </header>
            <dl className="body note-body">
              <dt>Mouth</dt>
              <dd>{n.mouth}</dd>
              <dt>Like English</dt>
              <dd>{n.like}</dd>
              <dt>Watch out</dt>
              <dd>{n.mistake}</dd>
            </dl>
          </article>
        ))}
      </div>
      {lesson.rule && <p className="notice lesson-rule">{lesson.rule}</p>}
      <div className="row lesson-next">
        <button className="btn primary" onClick={onNext}>
          Now hear the difference →
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- hear */

const ROUNDS = 10;

interface Round {
  pair: MinimalPair;
  /** which of the two is said */
  target: 'a' | 'b';
}

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Telling two words apart by ear, ten times.
 *
 * Perception before production: a learner who cannot hear q from ch has no
 * target to aim at, and every attempt to say it is a guess. One of two words
 * is said; you pick which. The pair stays on screen afterwards so both can be
 * played again, back to back, which is where the difference is learned.
 */
function Hear({ lesson, onNext }: { lesson: SoundLesson; onNext: () => void }) {
  const rounds = useMemo<Round[]>(() => {
    const out: Round[] = [];
    while (out.length < ROUNDS) {
      for (const pair of shuffled(lesson.pairs)) {
        if (out.length < ROUNDS) out.push({ pair, target: Math.random() < 0.5 ? 'a' : 'b' });
      }
    }
    return out;
  }, [lesson]);
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [right, setRight] = useState(0);
  const round = rounds[at];

  // A different voice each time where there are several: the ear has to learn
  // what makes it q, not what this one speaker's q sounds like.
  const play = useCallback(() => {
    if (!round) return;
    const word = round.pair[round.target].word;
    void anyVoiceFor(word).then((voice) => say(word, { voice }));
  }, [round]);

  useEffect(() => {
    if (!round) return;
    const id = setTimeout(play, 300);
    return () => clearTimeout(id);
  }, [round, play]);

  const pick = useCallback(
    (side: 'a' | 'b') => {
      if (!round || picked) return;
      setPicked(side);
      const ok = side === round.target;
      record(hearKey(lesson.id), ok);
      if (ok) setRight((n) => n + 1);
    },
    [round, picked, lesson.id],
  );

  const next = useCallback(() => {
    setPicked(null);
    setAt((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') pick('a');
      else if (e.key === '2') pick('b');
      else if (e.key === ' ') {
        e.preventDefault();
        play();
      } else if (e.key === 'Enter' && picked) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, play, next, picked]);

  if (!round) {
    return (
      <div className="drill-done">
        <span className="big hanzi">{right >= ROUNDS * 0.8 ? '好' : '差不多'}</span>
        <h2 style={{ fontSize: 17, margin: '4px 0 2px' }}>
          {right} of {ROUNDS} heard right
        </h2>
        <p className="small muted" style={{ margin: 0, maxWidth: 420, textAlign: 'center' }}>
          {right >= ROUNDS * 0.8
            ? 'Your ear has this. Now make your mouth do it.'
            : 'Worth another round before saying them — the difference has to be heard before it can be aimed at.'}
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
          <button
            className="btn"
            onClick={() => {
              setAt(0);
              setRight(0);
            }}
          >
            Another round
          </button>
          <button className="btn primary" onClick={onNext}>
            Say them →
          </button>
        </div>
      </div>
    );
  }

  const option = (side: 'a' | 'b', n: number) => {
    const w: SaidWord = round.pair[side];
    const state = picked === null ? undefined : side === round.target ? 'right' : side === picked ? 'wrong' : undefined;
    return (
      <button key={side} className="choice hear-choice" data-state={state} disabled={picked !== null} onClick={() => pick(side)}>
        <span className="hanzi hear-hanzi">{w.word}</span>
        <span className="hear-py">{w.reading}</span>
        <i className="tiny muted key-hint">{n}</i>
      </button>
    );
  };

  return (
    <div className="drill-stage hear-stage">
      <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
        <span className="tiny muted">
          {at + 1} of {ROUNDS}
        </span>
        <div className="bar" style={{ width: 140 }}>
          <i className="learned" style={{ width: `${(at / ROUNDS) * 100}%` }} />
        </div>
      </div>
      <p className="small" style={{ margin: 0 }}>
        Which one did you hear?
      </p>
      <button className="btn hear-again" onClick={play}>
        <span aria-hidden>🔊</span> Play again
      </button>
      <div className="choice-row">{[option('a', 1), option('b', 2)]}</div>
      {picked && (
        <>
          <p className="small" style={{ margin: 0 }}>
            {picked === round.target ? 'Yes' : 'No'} — it was <b>{round.pair[round.target].word}</b>. The difference is{' '}
            <b className="contrast">{round.pair.contrast}</b>.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => void say(round.pair.a.word)}>
              <span aria-hidden>🔊</span> {round.pair.a.word}
            </button>
            <button className="btn" onClick={() => void say(round.pair.b.word)}>
              <span aria-hidden>🔊</span> {round.pair.b.word}
            </button>
            <button className="btn primary" onClick={next}>
              Next <span className="key-hint tiny">↵</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- say */

function SayIt({ lesson }: { lesson: SoundLesson }) {
  const words = lesson.words;
  const [at, setAt] = useState(0);
  const [scored, setScored] = useState<Set<number>>(new Set());
  const memory = usePinyinMemory();
  const score = recentScore(memory.tallies[sayKey(lesson.id)]);
  const word = words[at % words.length]!;

  return (
    <div className="drill-stage">
      <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
        <span className="tiny muted">
          Word {(at % words.length) + 1} of {words.length}
        </span>
        {score !== null && <span className="tiny muted">· {Math.round(score * 100)}% heard as meant lately</span>}
      </div>
      <SayCheck
        word={word}
        onResult={(r) => {
          // The first attempt at each word is what counts; trying again until
          // it comes out right is practice, not a score.
          if (scored.has(at)) return;
          record(sayKey(lesson.id), r.clean);
          setScored((s) => new Set(s).add(at));
        }}
      />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => setAt((n) => n + 1)}>
          Next word →
        </button>
      </div>
    </div>
  );
}
