import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { EvalResult, SyllableEval } from '../../../shared/speechEval';
import { attemptResult, evaluatePhrase } from '../../api/speechEval';
import { charScore, heardTag, noteOf, numbered, attemptOf, verdictOf, type Attempt } from '../../domain/phrases';
import { parseSyllable } from '../../domain/pinyin/syllable';
import { alignPinyin, tokenize, wordBands } from '../../domain/reading';
import { fixesOf, matchSyllables, pausesOf, tagOf, type Fix } from '../../domain/speak';
import { isHanzi } from '../../domain/text';
import { itemForToken } from '../../domain/words';
import type { Library } from '../../data/types';
import { paths } from '../../navigation/paths';
import { useOpenItem } from '../../navigation/itemDrawer';
import { heardAnything } from '../../platform/audio/mic';
import { hasClip, hush, playSamples, say, unlockAudio } from '../../platform/audio/voiceOut';
import { Icon } from '../../ui/Icon';
import { narratedReadings, type Narrated } from '../reader/narratedClips';
import { useLibrary } from '../shared/library';
import { NOTHING_HEARD, troubleOf, type Trouble } from '../pinyin/lineTrouble';
import { RecordButton } from '../pinyin/RecordButton';
import { band } from '../pinyin/ScoredLine';
import { attemptId, knownTries } from '../pinyin/speechHistory';
import { useRecorder } from '../pinyin/useRecorder';
import { FixSheet } from './FixSheet';
import { at16k, MODEL_RATE, modelSamples, playModel } from './modelVoice';
import { AUTOPLAY, keepPref, pref, SHADOW, SLOW } from './prefs';
import { useNarrator, type Source } from './sources';
import { VoiceSheet } from './VoiceSheet';
import '../pinyin/phrases.css';
import '../pinyin/pinyin.css';
import './speak.css';

/**
 * Set by a tap that opens a line (Next, Back, a segment, Start): the line
 * plays its example as it opens. A line opened by a reload or a link does
 * not, since nothing has woken the page's audio and nobody asked.
 */
let armed = false;
export const armAutoplay = () => {
  armed = true;
  unlockAudio();
};

const bandsOf = new WeakMap<Library, Map<string, number>>();

/** One saying of the line this visit, or the best kept from before when asked for. */
interface Take {
  result: EvalResult;
  samples: Float32Array | null;
  at: number;
  shadow: boolean;
  /** kept from before: the best, opened to look at */
  kept?: boolean;
}

/**
 * One line, said: hear it, say it, fix what was off.
 *
 * The example is the chosen narrator's, for any line (read on its own by
 * MiniMax when the text was never read whole) and slowly too. What came of
 * saying it is a number, one sentence, and the words to fix — only those, in
 * the order of the line, each with its own example, the learner's own
 * syllables, and a way to practise that word alone until it is right.
 */
export function SayLine({
  source,
  index,
  scores,
  tries,
  onAttempt,
  onGo,
  onNext,
  onBack,
}: {
  source: Source;
  index: number;
  /** each line's best, −1 for not said */
  scores: number[];
  /** this line's tries kept from before */
  tries: Attempt[];
  onAttempt: (zh: string, a: Attempt, r: EvalResult, id: string) => void;
  onGo: (i: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const lib = useLibrary();
  const openItem = useOpenItem();
  const phrase = source.phrases[index]!;
  const readings = useMemo(() => alignPinyin({ zh: phrase.zh, py: phrase.py }, lib), [phrase, lib]);
  const words = useMemo(() => {
    let b = bandsOf.get(lib);
    if (!b) bandsOf.set(lib, (b = wordBands(lib)));
    return tokenize(phrase.zh, lib, b).filter((t) => t.word);
  }, [phrase.zh, lib]);
  // By the lines' text, not the array: a set made for a sitting is made anew on every render.
  const linesKey = source.phrases.map((p) => p.zh).join('\n');
  const lines = useMemo(() => linesKey.split('\n'), [linesKey]);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      hush();
    };
  }, []);

  // ------------------------------------------------------------ the example
  const voice = useNarrator();
  const narrator = voice.narrator;
  const [wholeList, setWholeList] = useState<Narrated[] | null>(null);
  useEffect(() => {
    let live = true;
    narratedReadings(lines).then(
      (l) => live && setWholeList(l),
      () => live && setWholeList([]),
    );
    return () => {
      live = false;
    };
  }, [lines]);
  const whole = wholeList && narrator ? (wholeList.find((r) => r.n.narratorId === narrator.id) ?? null) : null;
  const [slow, setSlowState] = useState(() => pref(SLOW, false));
  const setSlow = (on: boolean) => {
    setSlowState(on);
    keepPref(SLOW, on);
  };
  const [model, setModel] = useState<'none' | 'loading' | 'ready' | 'failed'>('none');
  const [modelError, setModelError] = useState<string | null>(null);
  const [hearing, setHearing] = useState(false);
  // Read once as the line mounts (twice under StrictMode, so let go of in an effect, not here).
  const [armedHere] = useState(() => armed);
  const autoplay = useRef(armedHere);
  // Recording, opening the microphone, counting in or scoring: no example plays by itself then.
  const busy = useRef(false);
  useEffect(() => {
    armed = false;
  }, []);

  const example = (s: boolean) => (narrator ? modelSamples(narrator, phrase.zh, { slow: s, whole, index }) : Promise.reject(new Error('No narrator yet.')));

  // Ready as the line opens, the next line's too, so Hear plays at the tap.
  useEffect(() => {
    if (!narrator || wholeList === null) return;
    let live = true;
    setModel('loading');
    setModelError(null);
    example(slow).then(
      (s) => {
        if (!live) return;
        setModel('ready');
        // Not into a recording the learner has already started, nor over a line being scored.
        if (autoplay.current && pref(AUTOPLAY, true) && !busy.current) void playModel(s);
        autoplay.current = false;
      },
      (e: Error) => {
        if (!live) return;
        setModel('failed');
        setModelError(e.message);
      },
    );
    const next = source.phrases[index + 1];
    if (next) void modelSamples(narrator, next.zh, { slow, whole, index: index + 1 }).catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrator?.id, wholeList, slow, index]);

  async function hear() {
    if (!narrator || hearing) return;
    autoplay.current = false;
    unlockAudio();
    setHearing(true);
    try {
      const s = await example(slow);
      if (!mounted.current) return;
      setModel('ready');
      void playModel(s);
    } catch (e) {
      if (!mounted.current) return;
      setModel('failed');
      setModelError(e instanceof Error ? e.message : 'MiniMax did not answer.');
    } finally {
      if (mounted.current) setHearing(false);
    }
  }

  // ------------------------------------------------------------ saying it
  const [take, setTake] = useState<Take | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<Trouble | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [micDetail, setMicDetail] = useState<string | null>(null);
  const [lastSamples, setLastSamples] = useState<Float32Array | null>(null);
  const [shadowMode, setShadowState] = useState(() => pref(SHADOW, false));
  const setShadowMode = (on: boolean) => {
    setShadowState(on);
    keepPref(SHADOW, on);
  };
  const [count, setCount] = useState<number | null>(null);
  const [readying, setReadying] = useState(false);
  const shadowing = useRef(false);
  const lastShadow = useRef(false);
  // The best before this visit, to beat.
  // Taken as the line opens: the tries passed in grow with every try said here, and a try is not its own best before.
  const [bestBefore] = useState(() => (tries.length ? tries.reduce((a, b) => (b.total > a.total ? b : a)) : null));
  const [bestNow, setBestNow] = useState<number | null>(null);

  // Where the microphone's recording goes: the line, or the word being practised in the sheet.
  const target = useRef<'line' | 'fix'>('line');
  const fixDone = useRef<((s: Float32Array) => void) | null>(null);

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
          if (!mounted.current) return;
          if (r.rejected) {
            setNote('That did not sound like this line. Hear it once more, then say all of it, close to the microphone.');
            return;
          }
          const id = attemptId();
          const a = { ...attemptOf(r, Date.now()), ...(shadow ? { shadow: true } : {}) };
          onAttempt(phrase.zh, a, r, id);
          setTake({ result: r, samples: s, at: a.at, shadow });
          setBestNow((b) => Math.max(b ?? -1, r.total));
        },
        (err: unknown) => mounted.current && setError(troubleOf(err)),
      )
      .finally(() => mounted.current && setChecking(false));
  }

  const recorder = useRecorder((s) => {
    if (target.current === 'fix') {
      fixDone.current?.(s);
      return;
    }
    setLastSamples(s);
    lastShadow.current = shadowing.current;
    score(s, shadowing.current);
    shadowing.current = false;
  }, 15_000);

  // Shadow: a count of three, then the example and the learner together, for the example's length.
  async function shadow() {
    if (!narrator || readying) return;
    setReadying(true);
    setError(null);
    let said: Float32Array;
    try {
      if (!(await recorder.prepare())) return;
      said = await example(false);
    } catch (err) {
      if (mounted.current) setError(troubleOf(err));
      return;
    } finally {
      if (mounted.current) setReadying(false);
    }
    for (const n of [3, 2, 1]) {
      if (!mounted.current) return;
      setCount(n);
      await new Promise((r) => setTimeout(r, 650));
    }
    if (!mounted.current) return;
    setCount(0);
    hush();
    shadowing.current = true;
    void recorder.recordFor(Math.round((said.length / MODEL_RATE) * 1000) + 900);
    // The microphone's own audio plays at the rate it records at.
    recorder.play(at16k(said));
    setTimeout(() => mounted.current && setCount(null), 500);
  }

  const live = recorder.state === 'listening' || recorder.state === 'hearing';
  busy.current = live || checking || readying || count !== null || recorder.state === 'opening';
  function onRecord() {
    autoplay.current = false;
    target.current = 'line';
    if (live) return recorder.finish();
    hush();
    if (shadowMode && narrator) void shadow();
    else recorder.toggle();
  }
  const state = checking ? 'checking' : count !== null || readying ? 'opening' : recorder.state;

  // ------------------------------------------------------------ the best kept from before, to look at
  const [opening, setOpening] = useState(false);
  async function showBest() {
    setOpening(true);
    setError(null);
    try {
      const kept = (await knownTries('phrase')).filter((t) => t.text === phrase.zh && t.full);
      const best = kept.sort((a, b) => ((b.summary as Attempt | null)?.total ?? 0) - ((a.summary as Attempt | null)?.total ?? 0) || b.at - a.at)[0];
      if (!best) throw new Error('Only its number was kept for that try.');
      const r = await attemptResult(best.id);
      if (mounted.current) setTake({ result: r, samples: null, at: best.at, shadow: false, kept: true });
    } catch (e) {
      if (mounted.current) setError({ title: 'That try could not be opened', text: e instanceof Error ? e.message : 'Try again.', retry: false, settings: false });
    } finally {
      if (mounted.current) setOpening(false);
    }
  }

  // ------------------------------------------------------------ what to fix
  const result = take?.result ?? null;
  const fixes = useMemo(() => (result ? fixesOf(phrase.zh, readings, result, words) : []), [result, phrase.zh, readings, words]);
  const [fix, setFix] = useState<Fix | null>(null);
  const verdict = result ? verdictOf(result) : null;
  const pauses = result ? pausesOf(result) : [];
  const done = result !== null && !take?.kept;
  const last = index + 1 >= source.phrases.length;

  async function hearWord(word: string) {
    unlockAudio();
    hush();
    try {
      // A word the voice pack has is a native speaker's own recording: the best example there is.
      if (await hasClip(word)) {
        await say(word);
        return;
      }
      if (!narrator) return;
      void playModel(await modelSamples(narrator, word));
    } catch (e) {
      setModelError(e instanceof Error ? e.message : 'MiniMax did not answer.');
    }
  }
  const spanOf = (f: Fix) => {
    const syls = f.chars.map((c) => c.syl).filter((s): s is SyllableEval => Boolean(s && s.said !== 'missed' && s.to > s.from));
    return syls.length ? { from: syls[0]!.from, to: syls[syls.length - 1]!.to } : null;
  };
  function hearMine(f: Fix) {
    const s = take?.samples;
    const span = spanOf(f);
    if (!s || !span) return;
    hush();
    void playSamples(s.subarray(Math.max(0, Math.floor(((span.from - 40) / 1000) * 16000)), Math.ceil(((span.to + 60) / 1000) * 16000)));
  }

  const [sheet, setSheet] = useState(false);
  const modelLine = !narrator
    ? voice.list === null
      ? 'Finding your narrator…'
      : null
    : model === 'failed'
      ? modelError
      : model === 'loading' && !whole
        ? `${narrator.name} is reading it — a few seconds, once`
        : `Read by ${narrator.name}${slow ? ', slowly' : ''}`;

  return (
    <section className="ph-say sk-say">
      <header className="ph-say-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back to Speak">
          <Icon name="close" />
        </button>
        <span className="ph-say-title">
          <span className="hanzi">{source.title}</span>
          <span className="tiny muted">
            Line {index + 1} of {source.phrases.length}
          </span>
        </span>
        <button className="chip sk-voice-chip" onClick={() => setSheet(true)} aria-label="Choose the voice">
          <Icon name="sound" size={16} />
          <span>{narrator?.name ?? 'Voice'}</span>
        </button>
      </header>
      <div className="ph-segs" role="group" aria-label="The lines">
        {scores.map((b, i) => (
          <button
            key={i}
            className="ph-seg"
            data-band={b < 0 ? 'none' : band(b)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Line ${i + 1}${b < 0 ? '' : `, ${Math.round(b)}`}`}
            onClick={() => {
              armAutoplay();
              onGo(i);
            }}
          >
            <i />
          </button>
        ))}
      </div>

      <div className="ph-say-body sk-body">
        {count !== null && (
          <div className="ph-count" aria-live="assertive">
            <span key={count}>{count === 0 ? 'Now' : count}</span>
          </div>
        )}

        <LineTiles zh={phrase.zh} readings={readings} result={result} dim={checking} onWord={(at) => openItem(itemForToken(lib, wordAt(words, phrase.zh, at)))} />
        {phrase.en && <p className="ph-en">{phrase.en}</p>}

        <div className="sk-tools">
          <span className="small muted sk-model" role="status" data-failed={(Boolean(narrator) && model === 'failed') || undefined} data-wrap={!narrator || model === 'failed' || undefined}>
            {model === 'failed' && narrator ? (
              <>
                {modelError} <Link to={paths.speakingNarrators()}>Open Voices</Link>
              </>
            ) : modelLine ??
              (voice.failed ? (
                voice.failed
              ) : (
                <>
                  No narrator yet: <Link to={paths.speakingNarrators()}>make one in Voices</Link>, and it reads every line for you.
                </>
              ))}
          </span>
          <span className="sk-chips">
            <button className="chip" aria-pressed={slow} onClick={() => setSlow(!slow)} disabled={!narrator} title="Hear it read slowly, in the same voice">
              Slowly
            </button>
            <button className="chip" aria-pressed={shadowMode} onClick={() => setShadowMode(!shadowMode)} disabled={!narrator} title="Three, two, one — then say it with the voice. Headphones help.">
              Shadow
            </button>
          </span>
        </div>

        <div className="sk-result" aria-live="polite">
          {checking || opening ? (
            <div className="ph-scoring" role="status">
              <span className="spinner ph-scoring-spin" aria-hidden />
              <span>
                <b>{opening ? 'Opening your best try…' : 'Scoring your line…'}</b>
                <span className="tiny muted">{opening ? 'A moment.' : 'Usually two to five seconds.'}</span>
              </span>
            </div>
          ) : result && verdict ? (
            <>
              <div className="ph-sum sk-sum">
                <span className="ph-sum-total" data-band={band(result.total)} aria-label={`${Math.round(result.total)} out of 100`}>
                  {Math.round(result.total)}
                </span>
                <span className="ph-sum-text">
                  {take?.kept && <b>Your best, {whenOf(take.at)}</b>}
                  <span className="ph-sum-parts">
                    {(
                      [
                        ['Tones', result.tone],
                        ['Sounds', result.sounds],
                        ['Flow', result.fluency],
                      ] as Array<[string, number]>
                    ).map(([name, v]) => (
                      <span key={name} data-band={band(v)}>
                        {name} <b>{Math.round(v)}</b>
                      </span>
                    ))}
                  </span>
                  {!take?.kept && <span className="tiny muted">{progressLine(result.total, bestBefore?.total ?? null, take?.shadow ?? false)}</span>}
                </span>
              </div>
              {(pauses.length > 0 || result.quiet || (result.speed !== undefined && result.speed > 0 && result.speed < 110)) && (
                <p className="small muted sk-flow">
                  {[
                    pauses.length ? `You paused after ${pauses.map((c) => c).join(', ')}: say the words of a phrase in one breath.` : '',
                    result.speed !== undefined && result.speed > 0 && result.speed < 110 ? 'Slow and careful is fine; once it is right, join the words.' : '',
                    result.quiet ? 'The recording was very quiet: hold the device closer.' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              )}
              {fixes.length ? (
                <section className="sk-fixes" aria-label="To fix">
                  <h2 className="sk-fixes-title small">
                    {fixes.length === 1 ? 'One word to fix' : `${fixes.length} words to fix`}
                  </h2>
                  <ul className="list">
                    {fixes.map((f) => (
                      <FixRow
                        key={f.at}
                        fix={f}
                        canHearMine={Boolean(take?.samples && spanOf(f))}
                        onWord={() => openItem(itemForToken(lib, f.word))}
                        onExample={() => void hearWord(f.word)}
                        onMine={() => hearMine(f)}
                        onPractise={() => !live && !checking && setFix(f)}
                      />
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="sk-clean">Every word as it should be.</p>
              )}
            </>
          ) : (
            <div className="sk-empty">
              <p className="small muted">
                {narrator ? 'Hear it, then tap the microphone and say the whole line. It stops by itself when you do.' : 'Tap the microphone and say the whole line. It stops by itself when you do.'}
              </p>
              {bestBefore && (
                <p className="small sk-best">
                  Your best so far: <b data-band={band(bestBefore.total)}>{Math.round(bestBefore.total)}</b>, {whenOf(bestBefore.at)}.{' '}
                  <button className="btn quiet sm" onClick={() => void showBest()}>
                    Show it
                  </button>
                </p>
              )}
            </div>
          )}

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
          {error && (
            <div className="ph-failed" role="alert">
              <b>{error.title}</b>
              <span className="small">{error.text}</span>
              <span className="ph-failed-actions">
                {error.retry && lastSamples && (
                  <button className="btn tonal sm" onClick={() => score(lastSamples, lastShadow.current)} disabled={checking}>
                    Try again
                  </button>
                )}
                {error.settings && (
                  <Link className="btn quiet sm" to={paths.settings()}>
                    Open Settings
                  </Link>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <footer className="ph-dock">
        <button
          className="ph-dock-btn"
          onClick={() => {
            armAutoplay();
            onGo(index - 1);
          }}
          disabled={index === 0}
        >
          <Icon name="prev" />
          <span>Back</span>
        </button>
        <button className="ph-dock-btn" onClick={() => void hear()} disabled={!narrator} aria-busy={hearing || undefined}>
          {hearing ? <span className="spinner sk-dock-spin" aria-hidden /> : <Icon name="play" />}
          <span>{slow ? 'Slowly' : 'Hear'}</span>
        </button>
        <RecordButton state={state} level={recorder.level} onToggle={onRecord} compact />
        <button
          className="ph-dock-btn"
          onClick={() => {
            const s = take?.samples ?? null;
            if (!s) return;
            hush();
            void playSamples(s);
          }}
          disabled={!take?.samples}
        >
          <Icon name="sound" />
          <span>Yours</span>
        </button>
        <button
          className="ph-dock-btn"
          data-go={done && (bestNow ?? 0) >= 75 ? '' : undefined}
          onClick={() => {
            armAutoplay();
            onNext();
          }}
        >
          <Icon name="next" />
          <span>{last ? 'Done' : 'Next'}</span>
        </button>
      </footer>

      {sheet && <VoiceSheet list={voice.list ?? []} current={narrator} wholeIds={(wholeList ?? []).map((r) => r.n.narratorId)} failed={voice.failed} onChoose={voice.choose} onClose={() => setSheet(false)} />}
      {fix && (
        <FixSheet
          fix={fix}
          narrator={narrator}
          sourceId={source.id}
          recorder={recorder}
          listen={(cb) => {
            target.current = cb ? 'fix' : 'line';
            fixDone.current = cb;
          }}
          onHear={hearWord}
          onClose={() => {
            // A word half said as the sheet closes is let go of, not scored as the line.
            if (recorder.state === 'listening' || recorder.state === 'hearing') {
              target.current = 'fix';
              fixDone.current = () => undefined;
              recorder.finish();
            }
            target.current = 'line';
            fixDone.current = null;
            setFix(null);
          }}
        />
      )}
    </section>
  );
}

/** The word of the line a character is in, as the reader cuts it; the character alone when it is in none. */
function wordAt(words: Array<{ text: string; at: number }>, zh: string, at: number): string {
  const w = words.find((x) => at >= x.at && at < x.at + [...x.text].length);
  return w ? w.text : ([...zh][at] ?? '');
}

/** How this try sits beside the best before it: the number to beat, and whether it was beaten. */
function progressLine(now: number, before: number | null, shadow: boolean): string {
  const how = shadow ? 'Shadowed. ' : '';
  if (before === null) return `${how}Your first try at this line.`;
  const d = Math.round(now) - Math.round(before);
  if (d > 0) return `${how}${d} up on your best before (${Math.round(before)}).`;
  if (d === 0) return `${how}As good as your best (${Math.round(before)}).`;
  return `${how}Your best is ${Math.round(before)}.`;
}

/** When a try was: today, yesterday, the weekday this week, else the date. */
function whenOf(at: number): string {
  const d = new Date(at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (at >= today.getTime()) return 'today';
  if (at >= today.getTime() - 86_400_000) return 'yesterday';
  if (at >= today.getTime() - 6 * 86_400_000) return `on ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`;
  return `on ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`;
}

/** A pinyin with its wrong part in red: the initial, the final, or (for the tone) the final underlined. */
function MarkedPinyin({ py, syl }: { py: string; syl: SyllableEval }) {
  const initial = parseSyllable(py).initial;
  const rest = py.slice(initial.length);
  return (
    <span className="sk-tile-py ph-marked">
      {initial && <span data-wrong={syl.said === 'missed' || syl.initial || undefined}>{initial}</span>}
      <span data-wrong={syl.said === 'missed' || syl.final || undefined} data-tone={syl.tone || undefined}>
        {rest}
      </span>
    </span>
  );
}

/**
 * The line: each character with its pinyin, coloured by how it was said, the
 * wrong part of its pinyin in red and a short tag under it. The tag's row is
 * there before a result, so nothing moves when one comes. A tap on a
 * character opens its word in the drawer.
 */
function LineTiles({ zh, readings, result, dim, onWord }: { zh: string; readings: string[]; result: EvalResult | null; dim: boolean; onWord: (at: number) => void }) {
  const chars = [...zh];
  const match = matchSyllables(zh, result);
  let k = 0;
  const tiles = chars.map((char, i) => ({ char, py: isHanzi(char) ? (readings[k++] ?? '') : '', syl: match[i] !== null && result ? result.syllables[match[i]!]! : null }));
  // Each character with the punctuation after it, so a full stop never starts a line alone.
  const groups = tiles.reduce<number[][]>((out, t, i) => {
    if (!t.py && out.length) out[out.length - 1]!.push(i);
    else out.push([i]);
    return out;
  }, []);
  return (
    <div className="sk-line" aria-label={zh} data-dim={dim || undefined}>
      {groups.map((g) => (
        <span key={g[0]} className="ph-word">
          {g.map((i) => {
            const t = tiles[i]!;
            if (!t.py) {
              return (
                <span key={i} className="sk-punct hanzi">
                  {t.char}
                </span>
              );
            }
            const n = t.syl ? noteOf(t.syl) : null;
            const s = !n ? undefined : n.band === 'good' ? 'ok' : n.band === 'mid' ? 'nearly' : 'bad';
            return (
              <button key={i} className="sk-tile" data-state={s} onClick={() => onWord(i)} aria-label={`${t.char} ${t.py}${t.syl ? `, ${Math.round(charScore(t.syl) ?? 0)}` : ''}`}>
                {t.syl && s !== 'ok' ? <MarkedPinyin py={t.py} syl={t.syl} /> : <span className="sk-tile-py">{t.py}</span>}
                <span className="sk-tile-zh hanzi">{t.char}</span>
                <span className="sk-tile-tag">{t.syl ? tagOf(t.syl) : ''}</span>
              </button>
            );
          })}
        </span>
      ))}
    </div>
  );
}

/** A word to fix: the word and its reading, what was wrong, and its three actions. */
function FixRow({ fix, canHearMine, onWord, onExample, onMine, onPractise }: { fix: Fix; canHearMine: boolean; onWord: () => void; onExample: () => void; onMine: () => void; onPractise: () => void }) {
  return (
    <li className="sk-fix" data-band={fix.band}>
      <button className="sk-fix-word" onClick={onWord} aria-label={`${fix.word}: open the word`}>
        <span className="hanzi">{fix.word}</span>
        <span className="sk-fix-py">{fix.chars.map((c) => c.py).join(' ')}</span>
      </button>
      <span className="sk-fix-text">
        {/* What the service heard, character by character: no sentence of the app's own. */}
        <b>
          {fix.chars
            .map((c) => (c.syl ? heardTag(c.syl) : ''))
            .map((t, i) => (t ? `${fix.chars.length > 1 ? `${fix.chars[i]!.char} ` : ''}${t}` : ''))
            .filter(Boolean)
            .join(' · ')}
        </b>
      </span>
      <span className="sk-fix-actions">
        <button className="icon-btn" onClick={onExample} aria-label={`Hear ${fix.word} said`} title="Hear it said">
          <Icon name="play" size={18} />
        </button>
        <button className="icon-btn" onClick={onMine} disabled={!canHearMine} aria-label={`Hear your ${fix.word}`} title="Hear yours">
          <Icon name="sound" size={18} />
        </button>
        <button className="btn tonal sm" onClick={onPractise}>
          Practise
        </button>
      </span>
    </li>
  );
}
