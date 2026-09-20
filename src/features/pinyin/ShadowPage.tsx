import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { melody } from '../../domain/pinyin/analyse';
import { bestHeard, describeMiss, type HeardResult } from '../../domain/pinyin/heard';
import { idValue } from '../../domain/ids';
import { paths } from '../../navigation/paths';
import { oneOf, useQuery } from '../../navigation/query';
import { micUnavailable, MIC_MESSAGE } from '../../platform/audio/mic';
import { trackPitch } from '../../platform/audio/pitch';
import { canRecognise } from '../../platform/audio/recognition';
import { useStore } from '../../store/store';
import { Seg } from '../../ui/Seg';
import { useTitle } from '../../ui/useTitle';
import { useLibrary } from '../shared/library';
import { SentenceStaff } from './PitchStaff';
import { RecordButton } from './RecordButton';
import { useSayIt } from './useSayIt';
import { usePinyinMemory, voiceRange } from './voice';
import { VoicePicker } from './VoicePicker';
import { referenceSamples, say } from './voiceOut';
import './pinyin.css';

/** One sentence to shadow, as the voice pack ships it. */
export interface ShadowSentence {
  /** the Tatoeba sentence number, for attribution */
  id: number;
  zh: string;
  /** one syllable per Han character */
  py: string;
  en: string;
  hsk: number;
  topics: string[];
}

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
 * Shadowing: saying a sentence along with a native-sounding voice, again and
 * again, until the melody is yours.
 *
 * Tones are learned in words; they are *used* in sentences, where they bend
 * to the rhythm around them, and that is only learned by copying whole
 * sentences out loud. So a sentence is played, said back, and the two
 * melodies drawn one over the other — with no syllable-by-syllable marks,
 * because over a whole sentence those would be guesses. The sounds are read
 * off the same breath by speech recognition, which is at its best on exactly
 * this: a whole sentence, with context.
 *
 * The sentences are short, everyday and translated, from Tatoeba, and can be
 * narrowed to the characters you have already marked learned.
 */
export function ShadowPage() {
  useTitle('Shadowing');
  const lib = useLibrary();
  const learned = useStore((s) => s.learned);
  const [all, setAll] = useState<ShadowSentence[] | null>(null);
  const [query, setQuery] = useQuery();
  const level = oneOf(query.get('level'), ['all', '1', '2', '3'] as const, 'all');
  const topic = query.get('topic');
  const mine = query.get('mine') === '1';
  const [at, setAt] = useState(0);

  useEffect(() => {
    void loadShelf().then(setAll);
  }, []);

  const known = useMemo(() => new Set([...learned].map(idValue)), [learned]);
  const topics = useMemo(() => {
    const ids = new Set(all?.flatMap((s) => s.topics));
    return lib.themes.filter((t) => ids.has(t.id));
  }, [all, lib.themes]);

  const list = useMemo(
    () =>
      (all ?? []).filter(
        (s) =>
          (level === 'all' || s.hsk === Number(level)) &&
          (!topic || s.topics.includes(topic)) &&
          (!mine || [...s.zh].every((c) => !HAN.test(c) || known.has(c))),
      ),
    [all, level, topic, mine, known],
  );

  useEffect(() => setAt(0), [level, topic, mine]);
  const sentence = list.length ? list[at % list.length]! : null;

  return (
    <section className="pinyin shadow">
      <div className="row" style={{ marginBottom: 14 }}>
        <Link className="btn ghost sm" to={paths.pinyin()}>
          ← Pronunciation
        </Link>
      </div>
      <div className="row" style={{ marginBottom: 14, alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0 }}>Shadowing</h1>
          <p className="small muted" style={{ margin: '2px 0 0' }}>
            Listen to a sentence, say it back, and see what came out — the melody and the sounds.
          </p>
        </div>
        <div className="spacer" />
        <Seg value={level} options={LEVELS} onChange={(v) => setQuery('level', v, 'all')} size="sm" label="Level" />
      </div>

      {/* Which voice reads them and which sentences they are: both chosen
          before starting, and both a row of chips, so they need their headings
          to keep from reading as one long wall of them. */}
      <div className="opt-panel">
        <div className="opt-row">
          <span className="tiny muted">Voice</span>
          <VoicePicker preview={sentence?.zh} />
        </div>
        <div className="opt-row wide">
          <span className="tiny muted">Topic</span>
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
      </div>

      {all === null ? (
        <p className="small muted">Loading sentences…</p>
      ) : !sentence ? (
        <div className="empty">
          <span className="big">空</span>
          <p>{all.length ? 'No sentences match those filters.' : 'The sentence pack is not installed on this server.'}</p>
        </div>
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
    (alternatives: string[]) =>
      setHeard(bestHeard(sentence.py, alternatives, (ch) => lib.byChar.get(ch)?.py ?? [])),
    [sentence.py, lib],
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
      <span key={i} className="shadow-char" data-state={heard ? (heard.syllables[k]?.off.length ? 'wrong' : 'right') : undefined}>
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
          {heard.clean ? (
            <p className="small" style={{ margin: 0 }}>
              Every sound as meant.
            </p>
          ) : !chart ? (
            <p className="small" style={{ margin: 0 }}>
              {heard.syllables.filter((x) => x.off.length).length} of {heard.syllables.length} came out differently —
              marked above.
            </p>
          ) : (
            <div className="verdicts">
              {heard.syllables
                .map((s, i) => ({ s, ch: [...sentence.zh].filter((c) => HAN.test(c))[i] }))
                .filter(({ s }) => s.off.length)
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
        Sentence{' '}
        <a href={`https://tatoeba.org/en/sentences/show/${sentence.id}`} target="_blank" rel="noreferrer">
          #{sentence.id}
        </a>{' '}
        from Tatoeba, CC BY 2.0 FR.
      </p>
    </div>
  );
}
