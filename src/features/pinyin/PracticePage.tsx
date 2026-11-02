import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import type { EvalResult } from '../../../shared/speechEval';
import { TONE_NAME } from '../../domain/pinyin/tones';
import { singleTones, tonePairs, type PracticeWord } from '../../domain/pinyin/practice';
import { RULE_NOTE } from '../../domain/pinyin/sandhi';
import { withTone } from '../../domain/pinyin/syllable';
import { paths } from '../../navigation/paths';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { ScoredSay } from './ScoredSay';
import { pairKey, record, toneKey } from './voice';
import { anyVoiceFor, packTexts, packVoices, say, voicesFor } from '../../platform/audio/voiceOut';
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
  if (!set || !set.words.length) return <Navigate to={paths.speakingTones()} replace />;
  return <Sitting key={set.id} set={set} />;
}

interface Result {
  word: PracticeWord;
  firstTry: boolean;
  tries: number;
}

function Sitting({ set }: { set: PracticeSet }) {
  useTitle(set.title);
  const navigate = useNavigate();
  const [at, setAt] = useState(0);
  const [scored, setScored] = useState<{ good: boolean } | null>(null);
  const [tries, setTries] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const word = set.words[at];
  const exit = () => navigate(paths.speakingTones(), { replace: true });

  // The service's verdict is the only one: the first try is what counts for the
  // tally; a later success only counts as having got there.
  const onScored = useCallback(
    (_r: EvalResult, good: boolean) => {
      if (!word) return;
      setScored({ good });
      record(set.tally, good);
      setTries((n) => n + 1);
      if (good || tries === 0) setResults((r) => (r.some((x) => x.word === word) ? r : [...r, { word, firstTry: good, tries: tries + 1 }]));
    },
    [word, set.tally, tries],
  );

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

  const next = useCallback(() => {
    setAt((n) => n + 1);
    setScored(null);
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
      if (e.key === 'l' || e.key === 'L') listen();
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && scored) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listen, scored, next]);

  if (!word) return <Done set={set} results={results} onExit={exit} />;

  const rules = [...new Set(word.spoken.map((s) => s.rule).filter(Boolean))] as Array<keyof typeof RULE_NOTE>;

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

        <ScoredSay
          word={word.word}
          readings={word.syllables.map((s) => s.py)}
          onListen={listen}
          onScored={onScored}
          maxMs={1800 + 700 * word.syllables.length}
        />

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

        {scored ? (
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className={`btn${scored.good ? ' primary' : ''}`} onClick={next}>
              {at + 1 < set.words.length ? 'Next word' : 'Finish'} <span className="key-hint tiny">↵</span>
            </button>
          </div>
        ) : (
          <p className="tiny muted key-hint" style={{ margin: 0 }}>
            L to listen
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
