import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { NarratorDto } from '../../../shared/narration';
import type { AttemptOut, EvalResult } from '../../../shared/speechEval';
import { chooseNarrator, chosenNarrator, listNarrators, narrationOf } from '../../api/narration';
import { attemptResult, evaluatePhrase } from '../../api/speechEval';
import { attemptOf, numbered, resultOfAttempt, type Attempt, type Phrase } from '../../domain/phrases';
import { alignPinyin } from '../../domain/reading';
import { heardAnything } from '../../platform/audio/mic';
import { hush, playSamples } from '../../platform/audio/voiceOut';
import { paths } from '../../navigation/paths';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import { addReading, narratedLine, narratedReadings, playLine, prepareClips, stopLine, type Clips, type Narrated } from '../reader/narratedClips';
import { useLibrary } from '../shared/library';
import { NOTHING_HEARD, troubleOf, type Trouble } from './lineTrouble';
import { RecordButton } from './RecordButton';
import { band, ScoredLine } from './ScoredLine';
import { attemptId, forget, keepTry, knownTries, remember } from './speechHistory';
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
  /** what the account kept of it: drawn from when the whole answer is not kept */
  summary?: Attempt;
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
  return { id: a.id, mine: a.kind !== 'voice', at: a.at, total: s?.total ?? null, narratorId: a.kind === 'voice' ? (a.tally ?? undefined) : undefined, shadow: s?.shadow, full: a.full, ...(s ? { summary: s } : {}) };
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
  onForget,
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
  /** a try of the learner's taken back */
  onForget: (zh: string, at: number) => void;
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
    // Kept before the whole answer was: drawn from its summary, right and wrong by part.
    if (!take.full) return setSelResult(take.summary ? resultOfAttempt(phrase.zh, numbered(readings), take.summary) : null);
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

  // ------------------------------------------------------------ hearing
  // What the dock is playing, the narrator's line or your try: its button reads Stop
  // meanwhile, and a second tap stops it rather than starting it again.
  const [sounding, setSounding] = useState<'hear' | 'mine' | null>(null);
  const sound = useRef(0);
  function stopSound() {
    sound.current++;
    stopLine();
    hush();
    setSounding(null);
  }
  function play(what: 'hear' | 'mine', run: () => Promise<void> | undefined) {
    if (sounding === what) return stopSound();
    stopSound();
    const n = sound.current;
    const p = run();
    if (!p) return;
    setSounding(what);
    void p.finally(() => sound.current === n && setSounding(null));
  }
  // Another line, or leaving: what was playing stops with it.
  useEffect(() => stopSound, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = recorder.state === 'listening' || recorder.state === 'hearing';
  function onRecord() {
    // Never record over the speaker: whatever is playing stops first.
    if (sounding) stopSound();
    if (live) return recorder.finish();
    if (mode === 'shadow') void shadow();
    else recorder.toggle();
  }

  const hear = () => play('hear', () => (clips ? playLine(clips, index, slow ? 0.75 : 1) : undefined));
  const hearMine = () => play('mine', () => (mineSamples ? playSamples(mineSamples) : undefined));
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
  // The tries open over the page, not in it: nothing under them moves. Closed by a choice, a tap elsewhere, or Escape.
  const tries = useRef<HTMLDivElement>(null);
  const pick = (id: string) => {
    setSel(id);
    setListOpen(false);
    setConfirm(null);
  };
  useEffect(() => {
    if (!listOpen) return;
    const away = (e: PointerEvent) => {
      if (!tries.current?.contains(e.target as Node)) {
        setListOpen(false);
        setConfirm(null);
      }
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setListOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [listOpen]);
  // Your own voice: the try on screen when it is yours and was said this visit. Otherwise
  // the last thing you said, unless that is another try in the list: under a try kept from
  // an earlier visit (its scores, not its sound) Mine would play a different one.
  const lastIsATake = lastSamples !== null && takes.some((t) => t.samples === lastSamples);
  const mineSamples = take?.mine && take.samples ? take.samples : take?.mine && lastIsATake && take.samples !== lastSamples ? null : lastSamples;
  const [order, setOrder] = useState<'new' | 'best'>('new');
  const [confirm, setConfirm] = useState<string | null>(null);
  // Which saying is shown, in a few words.
  const showing = !take
    ? null
    : !take.mine
      ? `The voice · ${nameOf(take.narratorId)}`
      : take.id === firstNew
        ? take.shadow
          ? 'Just now · shadowing'
          : 'Just now'
        : `${take.id === bestId ? 'Your best' : 'Your try'} · ${whenOf(take.at)}${!take.full && !take.result && !take.summary?.chars ? ' · marks only' : ''}`;
  const listed = order === 'best' ? [...shown.mine].sort((x, y) => (y.total ?? -1) - (x.total ?? -1) || y.at - x.at) : shown.mine;

  async function drop(t: Take) {
    setConfirm(null);
    const rest = takes.filter((x) => x.id !== t.id);
    setTakes(rest);
    // The one shown taken back: the best of what is left is shown instead.
    if (sel === t.id) setSel(rest.filter((x) => x.mine && x.total !== null).sort((a, b) => b.total! - a.total! || b.at - a.at)[0]?.id ?? null);
    try {
      await forget(t.id);
    } catch {
      // gone from this screen; the account is told again next time it is opened
    }
    if (t.mine) onForget(phrase.zh, t.at);
  }

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
        <ScoredLine zh={phrase.zh} readings={readings} result={selResult} samples={take?.samples ?? null} scoring={checking || selLoading} marks={marks}>
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

          {/* Which saying is shown, in one line: the result is what matters, the tries a tap away. */}
          <div className="ph-showing" ref={tries}>
            <span className="small muted ph-showing-what">{showing ?? (shown.mine.length ? '' : 'Not said yet')}</span>
            {(shown.mine.length > 0 || shown.voiceTakes.length > 0 || voice) && (
              <button className="btn quiet sm" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)}>
                Tries {shown.mine.length ? `(${shown.mine.length})` : ''} <Icon name="down" size={14} />
              </button>
            )}
            {listOpen && (
              <div className="ph-tries-box" role="dialog" aria-label="Your tries">
                <div className="ph-tries-head">
                  <b className="small">Your tries</b>
                  <div className="seg sm" role="group" aria-label="Order">
                    <button aria-pressed={order === 'new'} onClick={() => setOrder('new')}>
                      Newest
                    </button>
                    <button aria-pressed={order === 'best'} onClick={() => setOrder('best')}>
                      Best
                    </button>
                  </div>
                </div>
                <div className="list ph-tries-list" role="group" aria-label="Your tries of this line">
                  {listed.map((t) => (
                    <div key={t.id} className="ph-try-mini" aria-current={sel === t.id || undefined}>
                      <button className="ph-try-pick" onClick={() => pick(t.id)}>
                        <span className="small">{t.id === firstNew ? 'Just now' : whenOf(t.at).replace(/^./, (c) => c.toUpperCase())}</span>
                        <span className="tiny muted">{[t.id === bestId ? 'best' : '', t.shadow ? 'shadowing' : ''].filter(Boolean).join(' · ')}</span>
                        <b data-band={t.total === null ? 'none' : band(t.total)}>{t.total === null ? '–' : Math.round(t.total)}</b>
                      </button>
                      {confirm === t.id ? (
                        <button className="btn danger sm ph-try-del" onClick={() => void drop(t)}>
                          Delete
                        </button>
                      ) : (
                        <button className="icon-btn ph-try-del" aria-label="Delete this try" onClick={() => setConfirm(t.id)}>
                          <Icon name="close" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* The voice, last and quiet: a measure beside yours, not one of them. */}
                  {voice && (
                    <div className="ph-try-mini ph-try-voice" aria-current={(currentVoiceTake && sel === currentVoiceTake.id) || undefined}>
                      {currentVoiceTake ? (
                        <button className="ph-try-pick" onClick={() => pick(currentVoiceTake.id)}>
                          <span className="small">The voice</span>
                          <span className="tiny muted">{voice.name}</span>
                          <b data-band={currentVoiceTake.total === null ? 'none' : band(currentVoiceTake.total)}>{currentVoiceTake.total === null ? '–' : Math.round(currentVoiceTake.total)}</b>
                        </button>
                      ) : (
                        <button className="ph-try-pick" onClick={() => void scoreThisVoice()} disabled={voiceScoring}>
                          <span className="small">The voice</span>
                          <span className="tiny muted">{voice.name}</span>
                          <b className="ph-try-score-voice">{voiceScoring ? <span className="spinner" aria-hidden /> : 'Score it'}</b>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
        <button className="ph-dock-btn" onClick={hear} disabled={!clips} aria-pressed={sounding === 'hear'}>
          <Icon name={sounding === 'hear' ? 'stop' : 'play'} />
          <span>{sounding === 'hear' ? 'Stop' : slow ? 'Slowly' : 'Hear'}</span>
        </button>
        <RecordButton state={state} level={recorder.level} onToggle={onRecord} compact />
        <button className="ph-dock-btn" onClick={hearMine} disabled={!mineSamples} aria-pressed={sounding === 'mine'}>
          <Icon name={sounding === 'mine' ? 'stop' : 'play'} />
          <span>{sounding === 'mine' ? 'Stop' : 'Mine'}</span>
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
          index={index}
          line={phrase.zh}
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
 * The voice for a text, about the line on screen: every narrator, whether they
 * have read the text and what they scored on this line; the one chosen reads
 * the examples. A narrator who has not read it can, the whole text at once;
 * one who has can be scored on this line, to set beside the learner's numbers.
 */
function VoiceSheet({
  narrators,
  voices,
  current,
  index,
  line,
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
  index: number;
  /** the line on screen */
  line: string;
  lines: string[];
  voiceTakes: Take[];
  onRead: (r: Narrated) => void;
  onUse: (r: Narrated) => void;
  onScoreLine: (r: Narrated, i: number) => Promise<EvalResult | null>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState(current?.n.narratorId ?? narrators[0]?.id ?? '');
  const [reading, setReading] = useState(false);
  // The narrator whose reading of the line is being scored now.
  const [scoring, setScoring] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [kept, setKept] = useState<Record<string, number>>({});

  // Each narrator's latest score on this line: what is kept, and what was scored here this visit.
  useEffect(() => {
    void knownTries('voice').then((all) => {
      const by: Record<string, number> = {};
      for (const a of all) if (a.tally && a.text === line && by[a.tally] === undefined) by[a.tally] = (a.summary as Attempt | null)?.total ?? 0;
      for (const t of voiceTakes) if (t.narratorId && t.total !== null) by[t.narratorId] = t.total;
      setKept(by);
    }, () => undefined);
  }, [line, voiceTakes]);

  const pickedName = narrators.find((n) => n.id === picked)?.name ?? 'Narrator';
  const readingOf = voices.find((v) => v.n.narratorId === picked) ?? null;

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

  /** A narrator's reading of this line, scored, from the score on its own row. */
  async function scoreOf(id: string) {
    const r0 = voices.find((v) => v.n.narratorId === id);
    if (!r0 || scoring) return;
    const name = narrators.find((n) => n.id === id)?.name ?? 'Narrator';
    setScoring(id);
    setFailed(null);
    try {
      const r = await onScoreLine(r0, index);
      if (r) setKept((k) => ({ ...k, [id]: r.total }));
      else setFailed(`${name}'s reading did not match this line.`);
    } catch (err) {
      setFailed(troubleOf(err).text);
    } finally {
      setScoring(null);
    }
  }

  return (
    <Modal
      title="The voice"
      subtitle="Who reads the examples, and how each scored on this line."
      onClose={onClose}
      footer={
        <div className="ph-sheet-foot">
          {readingOf ? (
            <button
              className="btn primary"
              onClick={() => {
                onUse(readingOf);
                onClose();
              }}
            >
              Use {pickedName}
            </button>
          ) : (
            <button className="btn primary" onClick={() => void readAll()} disabled={reading || !picked}>
              {reading ? 'Reading the text… up to a minute' : `Have ${pickedName} read the text`}
            </button>
          )}
        </div>
      }
    >
      <div className="list ph-sheet-list">
        {narrators.map((n) => {
          const has = voices.some((v) => v.n.narratorId === n.id);
          const here = kept[n.id];
          return (
            <div key={n.id} className="ph-sheet-line">
              <button className="ph-sheet-row" aria-pressed={picked === n.id} onClick={() => setPicked(n.id)}>
                <span className="ph-sheet-radio" aria-hidden />
                <span className="ph-text-name">
                  <b>{n.name}</b>
                  <span className="tiny muted">
                    {has ? (here !== undefined ? 'Its score on this line' : 'Tap Score to score this line') : 'Has not read this text'}
                    {current?.n.narratorId === n.id ? ' · in use' : ''}
                  </span>
                </span>
              </button>
              {/* The score is the button that makes it: Score at first, then the number, a tap to score it again. */}
              {has ? (
                <button
                  className="ph-score ph-score-btn"
                  data-band={scoring === n.id || here === undefined ? 'none' : band(here)}
                  onClick={() => void scoreOf(n.id)}
                  disabled={scoring !== null}
                  title={here === undefined ? `Score ${n.name}'s reading of this line` : `Score ${n.name}'s reading of this line again`}
                  aria-label={here === undefined ? `Score ${n.name} on this line` : `${Math.round(here)}: score ${n.name} on this line again`}
                >
                  {scoring === n.id ? <span className="spinner" aria-hidden /> : here === undefined ? 'Score' : Math.round(here)}
                </button>
              ) : (
                <span className="ph-score" data-band="none">
                  –
                </span>
              )}
            </div>
          );
        })}
        {narrators.length === 0 && <p className="small muted">No narrators yet: make one in Voices.</p>}
      </div>
      {failed && <p className="small ph-error">{failed}</p>}
    </Modal>
  );
}
