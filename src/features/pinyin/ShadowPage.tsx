import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { melody } from '../../domain/pinyin/analyse';
import { bestHeard, describeMiss, heardShare, missed, understood, type HeardResult } from '../../domain/pinyin/heard';
import { charsOf } from '../../domain/ids';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { trackPitch } from '../../platform/audio/pitch';
import { canRecognise } from '../../platform/audio/recognition';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { BenchmarkCard } from './BenchmarkCard';
import { ContextCard } from './ContextCard';
import { SentenceStaff } from './PitchStaff';
import { recordSaid, share, useSaidLog, weeks, type SaidMode } from './progress';
import { RecordButton } from './RecordButton';
import { useSayIt } from './useSayIt';
import { usePinyinMemory, voiceRange } from './voice';
import { packTexts, referenceSamples, say } from './voiceOut';
import './pinyin.css';

/** One sentence to shadow, as the voice pack ships it: a native speaker's recording. */
export interface ShadowSentence {
  /** stable across builds: the clip's own name */
  id: string;
  zh: string;
  /** one syllable per Han character */
  py: string;
  en: string;
  hsk: number;
  topics: string[];
  /** who said it, on what licence, and where the recording lives — the attribution the licence asks for */
  by: string;
  license: string;
  page: string;
  /** where you would say it, and what was said to you just before */
  context?: {
    scene: string;
    before?: { who: string; zh: string; py: string; en: string };
  };
}

const MODES: ReadonlyArray<{ id: SaidMode | 'check'; label: string }> = [
  { id: 'shadow', label: 'Shadow' },
  { id: 'context', label: 'In context' },
  { id: 'check', label: 'Monthly check' },
];

let shelf: Promise<ShadowSentence[]> | null = null;
const loadShelf = () =>
  (shelf ??= fetch('/voices/sentences.json')
    .then((r) => (r.ok ? (r.json() as Promise<ShadowSentence[]>) : []))
    .catch(() => []));

const LEVELS = [
  { id: 'all', label: 'All' },
  { id: '1', label: 'HSK 1' },
  { id: '2', label: 'HSK 2' },
  { id: '3', label: 'HSK 3' },
] as const;

const HAN = /[一-鿿]/;

/**
 * Shadowing: saying a sentence along with a native speaker, again and again,
 * until the melody is yours.
 *
 * Every sentence is a real person's recording (scripts/voices/shadowing.json),
 * played exactly as they said it. It is not slowed down: the rhythm and the
 * way the tones bend at speed are what shadowing is for, and a stretched
 * recording teaches a speed nobody talks at. Short sentences are how it stays
 * possible to keep up.
 *
 * Tones are learned in words; they are *used* in sentences, where they bend
 * to the rhythm around them, and that is only learned by copying whole
 * sentences out loud. So a sentence is played, said back, and the two
 * melodies drawn one over the other — with no syllable-by-syllable marks,
 * because over a whole sentence those would be guesses. The sounds are read
 * off the same breath by speech recognition, which is at its best on exactly
 * this: a whole sentence, with context.
 *
 * The sentences are short, everyday and translated, from Wikimedia Commons
 * and Tatoeba, and can be narrowed to the characters you have already marked
 * learned.
 */
export function ShadowPage() {
  useTitle('Whole sentences');
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const [all, setAll] = useState<ShadowSentence[] | null>(null);
  /** the sentences a voice in the pack actually reads; null until it is known */
  const [voiced, setVoiced] = useState<Set<string> | null>(null);
  const [query, setQuery] = useQuery();
  const level = oneOf(query.get('level'), ['all', '1', '2', '3'] as const, 'all');
  const topic = query.get('topic');
  const mine = query.get('mine') === '1';
  const mode = oneOf(query.get('mode'), ['shadow', 'context', 'check'] as const, 'shadow');
  const [at, setAt] = useState(0);
  const log = useSaidLog();
  const [thisWeek, lastWeek] = useMemo(() => {
    const ws = weeks(log, mode === 'check' ? undefined : mode);
    const monday = ws[0] && Date.now() - ws[0].start < 7 * 864e5 ? ws[0] : undefined;
    return [monday, monday ? ws[1] : ws[0]];
  }, [log, mode]);

  useEffect(() => {
    void loadShelf().then(setAll);
    void packTexts().then(setVoiced);
  }, []);

  const known = useMemo(() => charsOf(learned), [learned]);
  const topics = useMemo(() => {
    const ids = new Set(all?.flatMap((s) => s.topics));
    return lib.themes.filter((t) => ids.has(t.id));
  }, [all, lib.themes]);

  const list = useMemo(
    () =>
      (all ?? []).filter(
        (s) =>
          (!voiced || voiced.has(s.zh)) &&
          (mode === 'shadow' || !!s.context) &&
          (level === 'all' || s.hsk === Number(level)) &&
          (!topic || s.topics.includes(topic)) &&
          (!mine || [...s.zh].every((c) => !HAN.test(c) || known.has(c))),
      ),
    [all, voiced, level, topic, mine, known, mode],
  );

  useEffect(() => setAt(0), [level, topic, mine, mode]);
  const sentence = list.length ? list[at % list.length]! : null;

  return (
    <section className="pinyin shadow">
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" to={paths.speaking()}>
          ← Speaking
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 14, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0 }}>{mode === 'shadow' ? 'Shadowing' : mode === 'context' ? 'In context' : 'Monthly check'}</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            {mode === 'shadow'
              ? 'Listen to a native speaker, say it along, and find out whether you were understood.'
              : mode === 'context'
                ? 'A situation, and what you want to say in it. Say it in Chinese — then hear how a native speaker says it.'
                : 'Six sentences, once a month, kept — to hear how far you have come.'}
          </p>
          <p className="tiny muted understood-week" style={{ margin: '4px 0 0' }}>
            {share(thisWeek) !== null
              ? `Understood this week: ${share(thisWeek)}% of ${thisWeek!.tries} sentences`
              : 'Understood this week: say a few sentences to see'}
            {share(lastWeek) !== null && ` · the week before: ${share(lastWeek)}%`}
          </p>
        </div>
        <div className="spacer" />
        {mode !== 'check' && (
          <Seg value={level} options={LEVELS} onChange={(v) => setQuery('level', v, 'all')} size="sm" label="Level" />
        )}
      </div>

      {/* Each sentence has the one voice that recorded it, so there is no
          voice to choose here — only which sentences. */}
      <div className="opt-panel">
        <div className="opt-row">
          <span className="tiny muted">Practise</span>
          <Seg value={mode} options={MODES} onChange={(v) => setQuery('mode', v, 'shadow')} size="sm" label="Practise" />
        </div>
        {mode !== 'check' && (
        <div className="opt-row wide">
          <span className="tiny muted">{topics.length ? 'Topic' : 'Sentences'}</span>
          <div className="chips">
            {topics.map((t) => (
              <button
                key={t.id}
                className="chip"
                aria-pressed={topic === t.id}
                onClick={() => setQuery('topic', topic === t.id ? null : t.id)}
              >
                {t.name}
              </button>
            ))}
            {known.size > 0 && (
              <button className="chip" aria-pressed={mine} onClick={() => setQuery('mine', mine ? null : '1')}>
                Only characters I know
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {mode === 'check' ? (
        all && <BenchmarkCard sentences={all} />
      ) : all === null ? (
        <p className="small muted">Loading sentences…</p>
      ) : !sentence ? (
        <div className="empty">
          <span className="big">空</span>
          <p>{all.length ? 'No sentences match those filters.' : 'The sentence pack is not installed on this server.'}</p>
        </div>
      ) : mode === 'context' ? (
        <ContextCard
          key={sentence.id}
          sentence={sentence}
          at={at % list.length}
          total={list.length}
          onMove={(d) => setAt((n) => (n + d + list.length) % list.length)}
        />
      ) : (
        <ShadowCard
          key={sentence.id}
          sentence={sentence}
          at={at % list.length}
          total={list.length}
          onMove={(d) => setAt((n) => (n + d + list.length) % list.length)}
        />
      )}
    </section>
  );
}

function ShadowCard({
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
  const [native, setNative] = useState<Array<{ t: number; chao: number }> | null>(null);
  const [nativeLength, setNativeLength] = useState(0);
  const [mineLine, setMineLine] = useState<Array<{ t: number; chao: number }> | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [take, setTake] = useState(0);
  const [heard, setHeard] = useState<HeardResult | null>(null);
  const blocked = micUnavailable();
  const chart = useStore((st) => st.settings.pitchChart);
  const syllables = sentence.py.split(' ');
  // The line drawn to copy is a particular voice's pitch, so choosing another
  // one has to draw it again — otherwise the melody on the staff belongs to a
  // voice that is no longer the one speaking.
  const voice = usePinyinMemory().voice;

  useEffect(() => {
    let live = true;
    setNative(null);
    void referenceSamples(sentence.zh).then((s) => {
      if (!live || !s) return;
      setNative(melody(trackPitch(s, { sampleRate: 16000 }), null));
      setNativeLength(s.length / 16000);
    });
    return () => {
      live = false;
    };
  }, [sentence.zh, voice]);

  // Heard once when it arrives, not again every time the voice is changed:
  // picking a voice says the sentence itself.
  useEffect(() => {
    const id = setTimeout(() => void say(sentence.zh), 300);
    return () => clearTimeout(id);
  }, [sentence.zh]);

  const onRecorded = useCallback((s: Float32Array) => {
    setSamples(s);
    setMineLine(melody(trackPitch(s, { sampleRate: 16000 }), voiceRange()));
    setTake((n) => n + 1);
  }, []);
  const onHeard = useCallback(
    (alternatives: string[]) => {
      const h = bestHeard(sentence.py, alternatives, (ch) => lib.byChar.get(ch)?.py ?? [], sentence.zh);
      setHeard(h);
      if (h) recordSaid({ id: sentence.id, mode: 'shadow', ok: understood(h, sentence.zh), share: heardShare(h) });
    },
    [sentence, lib],
  );
  const rec = useSayIt(onRecorded, onHeard, 2500 + 450 * syllables.length);

  // What the last take came out as belongs to the last take; it goes the
  // moment a new one starts, not when the new answer arrives to replace it.
  const sayIt = useCallback(() => {
    if (rec.state === 'idle') setHeard(null);
    rec.toggle();
  }, [rec]);

  // The voice, then you, back to back: the comparison the ear makes best.
  const both = () => {
    if (!samples) return;
    void say(sentence.zh).then((how) => {
      const wait = how === 'natural' && nativeLength ? nativeLength * 1000 + 350 : 2500;
      setTimeout(() => rec.play(samples), wait);
    });
  };

  // Characters with their syllable above; punctuation sits on the line. Once
  // recognition has answered, each character carries whether it was heard as
  // meant — which, with the chart off, is the whole of the feedback.
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
    <div className="drill-stage shadow-stage">
      <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
        <button className="btn ghost sm" onClick={() => onMove(-1)} aria-label="Previous sentence">
          ←
        </button>
        <span className="tiny muted">
          {at + 1} of {total} · HSK {sentence.hsk}
        </span>
        <button className="btn ghost sm" onClick={() => onMove(1)} aria-label="Next sentence">
          →
        </button>
      </div>

      <div className="shadow-line" lang="zh-CN">
        {tiles}
      </div>
      <p className="shadow-en">{sentence.en}</p>

      {blocked && <p className="notice speak-notice">{MIC_MESSAGE[blocked]}</p>}

      {chart && (
        <div className="staff-card">
          <SentenceStaff native={native} mine={mineLine} take={take} />
          <div className="staff-legend tiny muted">
            <span>
              <i className="key-ref" /> the voice
            </span>
            <span>
              <i className="key-voice" /> you
            </span>
          </div>
        </div>
      )}

      <div className="speak-controls">
        <button className="btn speak-side" onClick={() => void say(sentence.zh)}>
          <span aria-hidden>🔊</span> Listen
        </button>
        <RecordButton state={rec.state} level={rec.level} onToggle={sayIt} disabled={!!blocked} />
        <button className="btn speak-side" disabled={!samples} onClick={() => samples && rec.play(samples)}>
          <span aria-hidden>▶</span> Me
        </button>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" disabled={!samples} onClick={both}>
          Voice, then me
        </button>
      </div>

      {rec.error && <p className="notice speak-notice">{rec.error}</p>}
      {rec.heardError && <p className="notice speak-notice">{rec.heardError}</p>}
      {!canRecognise() && (
        <p className="tiny muted" style={{ margin: 0, maxWidth: 460 }}>
          This browser has no speech recognition, so only the melody is checked here. Safari on the iPad has one,
          with Siri and Dictation switched on; so does Chrome.
        </p>
      )}

      {heard && (
        <div className="heard">
          <span className="tiny muted">It wrote down</span>
          <span className="heard-text hanzi" style={{ fontSize: 26 }}>
            {heard.text || '—'}
          </span>
          <p className="understood-verdict" data-state={understood(heard, sentence.zh) ? 'right' : 'wrong'}>
            {understood(heard, sentence.zh) ? 'Understood' : 'Not quite understood'}
          </p>
          {understood(heard, sentence.zh) ? (
            <p className="small" style={{ margin: 0 }}>
              Every word came through as you meant it.
            </p>
          ) : !chart ? (
            <p className="small" style={{ margin: 0 }}>
              {heard.syllables.filter(missed).length} of {heard.syllables.length} came through as something else —
              marked above.
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
