import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { NarratorDto } from '../../../shared/narration';
import type { AttemptOut, EvalResult } from '../../../shared/speechEval';
import { chooseNarrator, chosenNarrator, listNarrators, narrationOf } from '../../api/narration';
import { attemptResult, evaluatePhrase } from '../../api/speechEval';
import { attemptOf, numbered, type Attempt, type Phrase } from '../../domain/phrases';
import { alignPinyin } from '../../domain/reading';
import { heardAnything } from '../../platform/audio/mic';
import { playSamples } from '../../platform/audio/voiceOut';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { addReading, narratedLine, narratedReadings, playLine, prepareClips, stopLine, type Clips, type Narrated } from '../reader/narratedClips';
import { useLibrary } from '../shared/library';
import { NOTHING_HEARD, troubleOf, type Trouble } from './lineTrouble';
import { RecordButton } from './RecordButton';
import { band, ScoredLine } from './ScoredLine';
import { attemptId, keepTry, knownTries, remember } from './speechHistory';
import { useRecorder } from './useRecorder';
import './phrases.css';

/** One scored saying of the line: the learner's (now, or kept from before) or a narrator's. */
interface Take {
  id: string;
  mine: boolean;
  at: number;
  total: number | null;
  /** for a voice: whose */
  narratorId?: string;
  shadow?: boolean;
  /** the service's answer, when it is here; fetched for one kept from before */
  result?: EvalResult;
  /** the recording, when this visit has it, to hear a syllable again */
  samples?: Float32Array;
  full: boolean;
}

type Mode = 'repeat' | 'shadow';
const MODE_KEY = 'hanzi.phrases.mode';
const loadMode = (): Mode => {
  try {
    return localStorage.getItem(MODE_KEY) === 'shadow' ? 'shadow' : 'repeat';
  } catch {
    return 'repeat';
  }
};

const results = new Map<string, Promise<EvalResult>>();
function resultOf(id: string): Promise<EvalResult> {
  let p = results.get(id);
  if (!p) {
    p = attemptResult(id);
    p.catch(() => results.delete(id));
    results.set(id, p);
  }
  return p;
}

/** When a try was, so a week later it still says when: today, yesterday, the weekday this week, else the date — with the time. */
function whenOf(at: number): string {
  const d = new Date(at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (at >= today.getTime()) return `today, ${time}`;
  if (at >= today.getTime() - 86_400_000) return `yesterday, ${time}`;
  if (at >= today.getTime() - 6 * 86_400_000) return `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${time}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

const fromKept = (a: AttemptOut): Take => {
  const s = a.summary as (Attempt & { shadow?: boolean }) | null;
  return { id: a.id, mine: a.kind !== 'voice', at: a.at, total: s?.total ?? null, narratorId: a.kind === 'voice' ? (a.tally ?? undefined) : undefined, shadow: s?.shadow, full: a.full };
};

/**
 * One line of a text, said and scored, on the whole screen.
 *
 * Every saying of it is a take, in a row above the result: what the learner
 * said just now, every try kept from before (the latest shown as soon as the
 * line opens), and the narrator's own reading scored the same way, so the
 * learner's 60 can be set beside the voice's 96. A take tapped is the one
 * shown, its characters and cards. Two ways to say it: Repeat (hear it, then
 * say it) and Shadow (a count of three, then the narrator and the learner
 * together, recorded for the line's length). The voice is chosen in a sheet
 * that also has every line read by it, and scored by it.
 */
export function LineStudio({
  phrases,
  index,
  title,
  sourceId,
  lines,
  scores: lineScores,
  onAttempt,
  onGo,
  onNext,
  onBack,
}: {
  phrases: Phrase[];
  index: number;
  title: string;
  sourceId: string;
  lines: string[];
  /** each line's best score, −1 for not said yet */
  scores: number[];
  onAttempt: (zh: string, a: Attempt, r: EvalResult, id: string) => void;
  onGo: (i: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const lib = useLibrary();
  const phrase = phrases[index]!;
  const readings = useMemo(() => alignPinyin({ zh: phrase.zh, py: phrase.py }, lib), [phrase, lib]);

  // ------------------------------------------------------------ the voice
  const [clips, setClips] = useState<Clips | null>(null);
  const [voices, setVoices] = useState<Narrated[]>([]);
  const [voice, setVoice] = useState<Narrated | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    let live = true;
    void listNarrators().then((n) => live && setNarrators(n), () => live && setNarrators([]));
    void narratedReadings(lines).then(async (list) => {
      if (!live) return;
      setVoices(list);
      const c = chosenNarrator();
      const r = list.find((x) => x.n.narratorId === c) ?? list[0];
      if (r) {
        setVoice(r);
        const ready = await prepareClips(sourceId, r);
        if (live) setClips(ready);
      }
    }, () => undefined);
    return () => {
      live = false;
      stopLine();
    };
    // By the lines' text, not the array: the parent makes a new one each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.join('\n'), sourceId]);

  const nameOf = (id?: string) => narrators?.find((n) => n.id === id)?.name ?? voices.find((v) => v.n.narratorId === id)?.name ?? 'Narrator';

  async function switchVoice(r: Narrated) {
    stopLine();
    setVoice(r);
    chooseNarrator(r.n.narratorId);
    setClips(await prepareClips(sourceId, r));
  }

  // ------------------------------------------------------------ takes
  const [takes, setTakes] = useState<Take[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [selResult, setSelResult] = useState<EvalResult | null>(null);
  const [selLoading, setSelLoading] = useState(false);
  const [selFailed, setSelFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([knownTries('phrase').catch(() => []), knownTries('voice').catch(() => [])]).then(([mine, theirs]) => {
      if (!live) return;
      const kept = [...mine, ...theirs].filter((a) => a.text === phrase.zh).map(fromKept);
      setTakes((now) => [...now, ...kept.filter((k) => !now.some((t) => t.id === k.id))]);
      // The line opens on its best try, the one to beat; a try said now takes its place on screen.
      const best = kept.filter((t) => t.mine && t.total !== null).sort((a, b) => b.total! - a.total! || b.at - a.at)[0];
      setSel((s) => s ?? best?.id ?? null);
    });
    return () => {
      live = false;
    };
  }, [phrase.zh]);

  const take = takes.find((t) => t.id === sel) ?? null;
  useEffect(() => {
    setSelFailed(null);
    if (!take) return setSelResult(null);
    if (take.result) return setSelResult(take.result);
    if (!take.full) return setSelResult(null);
    let live = true;
    setSelLoading(true);
    setSelResult(null);
    resultOf(take.id)
      .then((r) => live && setSelResult(r), (err: Error) => live && setSelFailed(err.message))
      .finally(() => live && setSelLoading(false));
    return () => {
      live = false;
    };
  }, [take]);

  function addTake(t: Take) {
    setTakes((now) => [t, ...now.filter((x) => x.id !== t.id)]);
    setSel(t.id);
  }

  // The latest of each voice, then the learner's newest first.
  const shown = useMemo(() => {
    const voiceTakes = [...new Map(takes.filter((t) => !t.mine).sort((a, b) => a.at - b.at).map((t) => [t.narratorId, t])).values()];
    const mine = takes.filter((t) => t.mine).sort((a, b) => b.at - a.at).slice(0, 15);
    return { voiceTakes, mine };
  }, [takes]);
  const currentVoiceTake = shown.voiceTakes.find((t) => t.narratorId === voice?.n.narratorId);

  // ------------------------------------------------------------ saying it
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<Trouble | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [micDetail, setMicDetail] = useState<string | null>(null);
  const [lastSamples, setLastSamples] = useState<Float32Array | null>(null);
  const [mode, setModeState] = useState<Mode>(loadMode);
  const [count, setCount] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const [marks, setMarksState] = useState(() => {
    try {
      return localStorage.getItem('hanzi.phrases.marks') === '1';
    } catch {
      return false;
    }
  });
  const setMarks = (on: boolean) => {
    setMarksState(on);
    try {
      localStorage.setItem('hanzi.phrases.marks', on ? '1' : '0');
    } catch {
      // remembered for this visit
    }
  };
  // From the tap until the count begins: the microphone opening, the narrator's line decoded.
  const [readying, setReadying] = useState(false);
  const shadowing = useRef(false);
  // Whether the last recording was shadowed, so trying it again keeps it so.
  const lastShadow = useRef(false);
  // The line left during a count (Next, a segment, Back) is not recorded after it.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // remembered for this visit
    }
  };

  function score(s: Float32Array, shadow: boolean) {
    setError(null);
    setNote(null);
    setMicDetail(null);
    // Silence is not sent to be scored: it would come back as every syllable left out.
    if (!heardAnything(s)) {
      setNote(NOTHING_HEARD);
      setMicDetail(recorder.diagnostics());
      return;
    }
    setChecking(true);
    evaluatePhrase(phrase.zh, s, numbered(readings))
      .then(
        (r) => {
          // Not the line at all is not a try at it: nothing marked, nothing counted.
          if (r.rejected) {
            setNote('That did not sound like this line. Hear it once more, then say all of it, close to the microphone.');
            return;
          }
          const id = attemptId();
          const a = { ...attemptOf(r, Date.now()), ...(shadow ? { shadow: true } : {}) };
          onAttempt(phrase.zh, a, r, id);
          addTake({ id, mine: true, at: a.at, total: r.total, shadow, result: r, samples: s, full: true });
        },
        (err: unknown) => setError(troubleOf(err)),
      )
      .finally(() => setChecking(false));
  }

  const recorder = useRecorder((s) => {
    setLastSamples(s);
    lastShadow.current = shadowing.current;
    score(s, shadowing.current);
    shadowing.current = false;
  }, 15_000);

  // Shadow: a count of three, then the narrator's line and the learner together, for the line's length.
  // The line plays through the microphone's own audio, which is running once it is open: no tap needed then.
  async function shadow() {
    if (!voice || readying) return;
    // The button reads as opening meanwhile, so a second tap does not start a second count.
    setReadying(true);
    let said: Float32Array;
    try {
      if (!(await recorder.prepare())) return;
      said = await narratedLine(voice, index);
    } catch (err) {
      setError(troubleOf(err));
      return;
    } finally {
      setReadying(false);
    }
    for (const n of [3, 2, 1]) {
      if (!mounted.current) return;
      setCount(n);
      await new Promise((r) => setTimeout(r, 650));
    }
    if (!mounted.current) return;
    setCount(0);
    shadowing.current = true;
    void recorder.recordFor(Math.round((said.length / 16_000) * 1000) + 900);
    recorder.play(said);
    setTimeout(() => setCount(null), 500);
  }

  const live = recorder.state === 'listening' || recorder.state === 'hearing';
  function onRecord() {
    if (live) return recorder.finish();
    if (mode === 'shadow') void shadow();
    else recorder.toggle();
  }

  const hear = () => clips && playLine(clips, index, slow ? 0.75 : 1);
  const last = index + 1 >= phrases.length;
  const state = checking ? 'checking' : count !== null || readying ? 'opening' : recorder.state;

  // ------------------------------------------------------------ a voice scored
  const [voiceScoring, setVoiceScoring] = useState(false);
  async function scoreVoice(r: Narrated, i: number): Promise<EvalResult | null> {
    const said = await narratedLine(r, i);
    const line = phrases[i]!;
    const res = await evaluatePhrase(line.zh, said, numbered(alignPinyin({ zh: line.zh, py: line.py }, lib)));
    if (res.rejected) return null;
    const id = attemptId();
    const a = attemptOf(res, Date.now());
    keepTry({ id, at: a.at, kind: 'voice', sourceId, text: line.zh, tally: r.n.narratorId, good: a.faults.length === 0, summary: a, result: res });
    remember({ id, at: a.at, kind: 'voice', sourceId, text: line.zh, tally: r.n.narratorId, good: a.faults.length === 0, summary: a, full: true });
    if (i === index) addTake({ id, mine: false, at: a.at, total: res.total, narratorId: r.n.narratorId, result: res, samples: said, full: true });
    return res;
  }
  async function scoreThisVoice() {
    if (!voice) return;
    setVoiceScoring(true);
    setError(null);
    try {
      const r = await scoreVoice(voice, index);
      if (!r) setNote(`${voice.name}'s reading did not match this line: its timings may be off here.`);
    } catch (err) {
      setError(troubleOf(err));
    } finally {
      setVoiceScoring(false);
    }
  }

  const firstNew = shown.mine[0] && Date.now() - shown.mine[0].at < 30 * 60_000 && shown.mine[0].samples ? shown.mine[0].id : null;
  const bestId = shown.mine.filter((t) => t.total !== null).sort((a, b) => b.total! - a.total! || b.at - a.at)[0]?.id ?? null;
  const [listOpen, setListOpen] = useState(false);
  const showing = !take
    ? null
    : !take.mine
      ? `${nameOf(take.narratorId)}'s own reading, scored as you are — not one of your tries`
      : take.id === firstNew
        ? take.shadow
          ? 'Just now, shadowing'
          : 'Just now'
        : `${take.id === bestId ? `Your best of ${shown.mine.length}` : 'Your try'} · ${whenOf(take.at)}${take.shadow ? ' · shadowing' : ''}`;

  return (
    <section className="ph-say">
      <header className="ph-say-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back to the texts">
          <Icon name="close" />
        </button>
        <span className="ph-say-title">
          <span className="hanzi">{title}</span>
          <span className="tiny muted">
            Line {index + 1} of {phrases.length}
          </span>
        </span>
        <button className="chip ph-voice-chip" onClick={() => setSheet(true)} aria-label="Choose the voice">
          <Icon name="sound" size={16} />
          <span>{voice?.name ?? 'Voice'}</span>
        </button>
      </header>
      <div className="ph-segs" role="group" aria-label="The text's lines">
        {lineScores.map((b, i) => (
          <button
            key={i}
            className="ph-seg"
            data-band={b < 0 ? 'none' : band(b)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Line ${i + 1}${b < 0 ? '' : `, ${Math.round(b)}`}`}
            onClick={() => onGo(i)}
          >
            <i />
          </button>
        ))}
      </div>

      <div className="ph-say-body">
        {count !== null && (
          <div className="ph-count" aria-live="assertive">
            <span key={count}>{count === 0 ? 'Now' : count}</span>
          </div>
        )}
        <ScoredLine zh={phrase.zh} en={phrase.en} readings={readings} result={selResult} samples={take?.samples ?? null} scoring={checking || selLoading} marks={marks}>
          <div className="ph-modes">
            <div className="seg sm" role="group" aria-label="How to say it">
              <button aria-pressed={mode === 'repeat'} onClick={() => setMode('repeat')} title="Hear it, then say it.">
                Repeat
              </button>
              <button aria-pressed={mode === 'shadow'} onClick={() => setMode('shadow')} disabled={!voice} title="Three, two, one — then say it with the voice. Headphones help.">
                Shadow
              </button>
            </div>
            <button className="chip ph-slow" aria-pressed={slow} onClick={() => setSlow((x) => !x)} title="Hear it at three quarters of the speed">
              Slowly
            </button>
            <button className="chip" aria-pressed={marks} onClick={() => setMarks(!marks)} title="Show on the line what was wrong with each character">
              Marks
            </button>
          </div>

          {/* Which saying is shown, in a line: the result is what matters, the tries are a tap away. */}
          {(shown.mine.length > 0 || voice) && (
            <div className="ph-showing">
              <span className="small muted ph-showing-what">{showing ?? 'Say it, and it is scored here.'}</span>
              <span className="ph-showing-actions">
                {voice &&
                  (currentVoiceTake ? (
                    <button className="btn quiet sm" aria-pressed={sel === currentVoiceTake.id} onClick={() => setSel(sel === currentVoiceTake.id ? bestId : currentVoiceTake.id)}>
                      Voice {currentVoiceTake.total === null ? '' : Math.round(currentVoiceTake.total)}
                    </button>
                  ) : (
                    <button className="btn quiet sm" onClick={() => void scoreThisVoice()} disabled={voiceScoring}>
                      {voiceScoring ? <span className="spinner" aria-hidden /> : null} Score the voice
                    </button>
                  ))}
                {shown.mine.length > 0 && (
                  <button className="btn quiet sm" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)}>
                    Tries ({shown.mine.length}) <Icon name="down" size={14} />
                  </button>
                )}
              </span>
            </div>
          )}
          {listOpen && (
            <div className="list ph-tries-list" role="group" aria-label="Your tries of this line">
              {[...shown.voiceTakes].map((t) => (
                <button key={t.id} className="ph-try-mini" aria-pressed={sel === t.id} onClick={() => setSel(t.id)}>
                  <span className="small">{nameOf(t.narratorId)}</span>
                  <span className="tiny muted">the voice · {whenOf(t.at)}</span>
                  <b data-band={t.total === null ? 'none' : band(t.total)}>{t.total === null ? '–' : Math.round(t.total)}</b>
                </button>
              ))}
              {shown.mine.map((t) => (
                <button key={t.id} className="ph-try-mini" aria-pressed={sel === t.id} onClick={() => setSel(t.id)}>
                  <span className="small">{t.id === firstNew ? 'Just now' : whenOf(t.at).replace(/^./, (c) => c.toUpperCase())}</span>
                  <span className="tiny muted">{[t.id === bestId ? 'best' : '', t.shadow ? 'shadowing' : ''].filter(Boolean).join(' · ')}</span>
                  <b data-band={t.total === null ? 'none' : band(t.total)}>{t.total === null ? '–' : Math.round(t.total)}</b>
                </button>
              ))}
            </div>
          )}
          {!clips && narrators !== null && <NoReading narrators={narrators} lines={lines} onRead={(r) => { setVoices((v) => [...v.filter((x) => x.n.narratorId !== r.n.narratorId), r]); void switchVoice(r); }} />}
          {note && (
            <p className="small muted ph-note" role="status">
              {note}
              {micDetail && <span className="tiny ph-mic-detail">{micDetail}</span>}
            </p>
          )}
          {recorder.error && (
            <p className="narrator-error ph-error-box" role="alert">
              {recorder.error}
            </p>
          )}
          {(error || selFailed) && (
            <div className="ph-failed" role="alert">
              <b>{error?.title ?? 'This try could not be opened'}</b>
              <span className="small">{error?.text ?? selFailed}</span>
              <span className="ph-failed-actions">
                {error?.retry && lastSamples && (
                  <button className="btn tonal sm" onClick={() => score(lastSamples, lastShadow.current)} disabled={checking}>
                    Try again
                  </button>
                )}
                {error?.settings && (
                  <Link className="btn quiet sm" to={paths.settings()}>
                    Open Settings
                  </Link>
                )}
              </span>
            </div>
          )}
        </ScoredLine>
      </div>

      {/* Like a tab bar: an icon over a word, five equal places, so nothing is cut short on the narrowest phone. */}
      <footer className="ph-dock">
        <button className="ph-dock-btn" onClick={() => onGo(index - 1)} disabled={index === 0}>
          <Icon name="prev" />
          <span>Back</span>
        </button>
        <button className="ph-dock-btn" onClick={hear} disabled={!clips}>
          <Icon name="play" />
          <span>{slow ? 'Slowly' : 'Hear'}</span>
        </button>
        <RecordButton state={state} level={recorder.level} onToggle={onRecord} compact />
        <button className="ph-dock-btn" onClick={() => { const s = take?.samples ?? lastSamples; if (s) void playSamples(s); }} disabled={!(take?.samples ?? lastSamples)}>
          <Icon name="play" />
          <span>{take && !take.mine ? 'Voice' : 'Mine'}</span>
        </button>
        <button className="ph-dock-btn" data-go={takes.some((t) => t.mine && t.id === firstNew) ? '' : undefined} onClick={onNext}>
          <Icon name="next" />
          <span>{last ? 'Done' : 'Next'}</span>
        </button>
      </footer>

      {sheet && (
        <VoiceSheet
          narrators={narrators ?? []}
          voices={voices}
          current={voice}
          phrases={phrases}
          lines={lines}
          voiceTakes={shown.voiceTakes}
          onRead={(r) => setVoices((v) => [...v.filter((x) => x.n.narratorId !== r.n.narratorId), r])}
          onUse={(r) => void switchVoice(r)}
          onScoreLine={scoreVoice}
          onClose={() => setSheet(false)}
        />
      )}
    </section>
  );
}

/** No narrator has read the text yet: one can, once, with MiniMax. */
function NoReading({ narrators, lines, onRead }: { narrators: NarratorDto[]; lines: string[]; onRead: (r: Narrated) => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const n = narrators.find((x) => x.id === chosenNarrator()) ?? narrators[0];
  if (!n) return <p className="small muted ph-note">No narrator has read these yet. Make one in Voices, and it reads them for you to copy.</p>;
  async function read() {
    setBusy(true);
    setFailed(null);
    try {
      const made = await narrationOf(n!.id, lines, { generate: true });
      if (made) {
        const r = { n: made, name: n!.name };
        addReading(lines, r);
        onRead(r);
      }
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <p className="small muted ph-note">
      No narrator has read this text yet.{' '}
      <button className="btn quiet sm" onClick={() => void read()} disabled={busy}>
        {busy ? 'Reading… up to a minute' : `Have ${n.name} read it`}
      </button>
      {failed && <span className="ph-error"> {failed}</span>}
    </p>
  );
}

/**
 * The voice for a text: every narrator, whether they have read it and how
 * they scored on its lines; the one chosen reads the examples. A narrator who
 * has not read it can, every line at once; one who has can be scored on every
 * line, to set beside the learner's numbers.
 */
function VoiceSheet({
  narrators,
  voices,
  current,
  phrases,
  lines,
  voiceTakes,
  onRead,
  onUse,
  onScoreLine,
  onClose,
}: {
  narrators: NarratorDto[];
  voices: Narrated[];
  current: Narrated | null;
  phrases: Phrase[];
  lines: string[];
  voiceTakes: Take[];
  onRead: (r: Narrated) => void;
  onUse: (r: Narrated) => void;
  onScoreLine: (r: Narrated, i: number) => Promise<EvalResult | null>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState(current?.n.narratorId ?? narrators[0]?.id ?? '');
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; scores: number[]; failed: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [kept, setKept] = useState<Record<string, number[]>>({});
  const stop = useRef(false);
  // Left without closing it (the browser's back, a swipe back on iOS), the run stops too: each line costs a score.
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  // What each narrator scored on this text's lines, from what is kept.
  useEffect(() => {
    void knownTries('voice').then((all) => {
      const by: Record<string, number[]> = {};
      const latest = new Map<string, AttemptOut>();
      for (const a of all) if (a.tally && lines.includes(a.text) && !latest.has(`${a.tally}:${a.text}`)) latest.set(`${a.tally}:${a.text}`, a);
      for (const a of latest.values()) (by[a.tally!] ??= []).push((a.summary as Attempt | null)?.total ?? 0);
      setKept(by);
    }, () => undefined);
  }, [lines, progress?.done]);

  const pickedName = narrators.find((n) => n.id === picked)?.name ?? 'Narrator';
  const readingOf = voices.find((v) => v.n.narratorId === picked) ?? null;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  async function readAll() {
    setReading(true);
    setFailed(null);
    try {
      const made = await narrationOf(picked, lines, { generate: true });
      if (made) {
        const r = { n: made, name: pickedName };
        addReading(lines, r);
        onRead(r);
        onUse(r);
      }
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setReading(false);
    }
  }

  async function scoreAll() {
    if (!readingOf) return;
    stop.current = false;
    setFailed(null);
    const scores: number[] = [];
    let bad = 0;
    setProgress({ done: 0, scores, failed: 0 });
    for (let i = 0; i < phrases.length && !stop.current; i++) {
      try {
        const r = await onScoreLine(readingOf, i);
        if (r) scores.push(r.total);
        else bad += 1;
      } catch (err) {
        bad += 1;
        setFailed(troubleOf(err).text);
      }
      setProgress({ done: i + 1, scores: [...scores], failed: bad });
    }
  }
  const running = progress !== null && progress.done < phrases.length && !stop.current;

  return (
    <Modal
      title="The voice"
      subtitle="Who reads the examples. Any narrator can read the whole text, and be scored on every line the same way as you."
      onClose={() => {
        stop.current = true;
        onClose();
      }}
      footer={
        <div className="ph-sheet-foot">
          {readingOf ? (
            <>
              <button className="btn tonal" onClick={() => void scoreAll()} disabled={running}>
                {running ? `Scoring line ${progress!.done + 1} of ${phrases.length}…` : `Score ${pickedName} on every line`}
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  onUse(readingOf);
                  stop.current = true;
                  onClose();
                }}
                disabled={running}
              >
                Use {pickedName}
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={() => void readAll()} disabled={reading || !picked}>
              {reading ? 'Reading every line… up to a minute' : `Read every line with ${pickedName}`}
            </button>
          )}
        </div>
      }
    >
      <div className="list ph-sheet-list">
        {narrators.map((n) => {
          const has = voices.some((v) => v.n.narratorId === n.id);
          const own = kept[n.id] ?? [];
          return (
            <button key={n.id} className="ph-sheet-row" aria-pressed={picked === n.id} onClick={() => setPicked(n.id)}>
              <span className="ph-sheet-radio" aria-hidden />
              <span className="ph-text-name">
                <b>{n.name}</b>
                <span className="tiny muted">
                  {has ? (own.length ? `Read · scored on ${own.length} of ${phrases.length} lines` : 'Read · not scored yet') : 'Not read yet'}
                  {current?.n.narratorId === n.id ? ' · in use' : ''}
                </span>
              </span>
              {avg(own) !== null && (
                <span className="ph-score" data-band={band(avg(own)!)}>
                  {avg(own)}
                </span>
              )}
            </button>
          );
        })}
        {narrators.length === 0 && <p className="small muted">No narrators yet: make one in Voices.</p>}
      </div>
      {progress && (
        <p className="small ph-sheet-progress" role="status">
          {progress.done < phrases.length && !stop.current ? <span className="spinner" aria-hidden /> : null} {progress.done} of {phrases.length} lines scored
          {progress.scores.length ? `, ${avg(progress.scores)} on average` : ''}
          {progress.failed ? ` · ${progress.failed} could not be` : ''}.
        </p>
      )}
      {voiceTakes.length > 0 && <p className="tiny muted">Each voice's score for this line is beside yours, above the result.</p>}
      {failed && <p className="small ph-error">{failed}</p>}
    </Modal>
  );
}
