import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { paths } from '../../navigation/paths';
import type { NarratorDto, OwnTextDto } from '../../../shared/narration';
import type { EvalResult, EvalStatus } from '../../../shared/speechEval';
import { ApiError } from '../../api/http';
import { chosenNarrator, listNarrators, narrationOf, ownTexts } from '../../api/narration';
import { evalStatus, evaluatePhrase } from '../../api/speechEval';
import { pinyinOf } from '../../domain/ownText';
import { attemptOf, EVERYDAY, numbered, partsOf, troubles, type Attempt, type Phrase } from '../../domain/phrases';
import { alignPinyin } from '../../domain/reading';
import { shelve, type GeneratedText } from '../../domain/text';
import { heardAnything } from '../../platform/audio/mic';
import { playSamples } from '../../platform/audio/voiceOut';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';
import { useTitle } from '../../ui/useTitle';
import { addReading, narratedReadings, playLine, prepareClips, stopLine, type Clips } from '../reader/narratedClips';
import { useLibrary } from '../shared/library';
import { PronunciationKey } from '../settings/PronunciationKey';
import { attemptId, keepTry, loadHistory } from './speechHistory';
import { RecordButton } from './RecordButton';
import { band, ScoredLine } from './ScoredLine';
import { useRecorder } from './useRecorder';
import './phrases.css';
import './pinyin.css';



/* ------------------------------------------------------------ attempts, kept on this device */

const KEPT = 'hanzi.phrases.attempts';
const loadAttempts = (): Record<string, Attempt[]> => {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? '{}') as Record<string, Attempt[]>;
  } catch {
    return {};
  }
};
/** Keeps a try on this device at once and in the account, with the service's whole answer. */
function keepAttempt(zh: string, a: Attempt, sourceId: string, result: EvalResult): Record<string, Attempt[]> {
  const all = loadAttempts();
  all[zh] = [...(all[zh] ?? []), a].slice(-5);
  saveAttempts(all);
  keepTry({ id: attemptId(), at: a.at, kind: 'phrase', sourceId, text: zh, good: a.faults.length === 0, summary: a, result });
  return all;
}

function saveAttempts(all: Record<string, Attempt[]>) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(all));
  } catch {
    // kept for this visit only
  }
}

/** What went wrong sending a line to be scored, said so the learner knows what to do. */
interface Trouble {
  title: string;
  text: string;
  /** the same recording can simply be sent again */
  retry: boolean;
  settings: boolean;
}

function troubleOf(err: unknown): Trouble {
  if (err instanceof ApiError) {
    if (err.code === 'network') {
      return /too long/.test(err.message)
        ? { title: 'No answer in time', text: 'The scoring took too long — usually a slow connection. Your recording is kept: try again.', retry: true, settings: false }
        : { title: 'No connection', text: 'The server could not be reached. Check the internet, then try again: your recording is kept.', retry: true, settings: false };
    }
    if (err.status === 404) return { title: 'No pronunciation keys', text: err.message, retry: false, settings: true };
    if (err.status === 400) return { title: 'This recording cannot be scored', text: err.message, retry: false, settings: false };
    if (err.status === 401) return { title: 'Signed out', text: 'Sign in again, then say the line once more.', retry: false, settings: false };
    if (err.status === 429) return { title: 'Too many at once', text: 'Wait a minute, then try again.', retry: true, settings: false };
    return { title: 'The scoring service failed', text: `${err.message} Your recording is kept: try again.`, retry: true, settings: /key|sig|licen|expire|quota/i.test(err.message) };
  }
  return { title: 'Something went wrong', text: err instanceof Error ? err.message : 'Try again.', retry: true, settings: false };
}

const NOTHING_HEARD = 'Nothing was heard: the microphone gave only silence. Tap the button and say the line again; if it keeps happening, reload the page.';


/** What was being said last: a source and a line, to carry on from. */
const LAST = 'hanzi.phrases.last';
interface Last {
  sourceId: string;
  index: number;
}
const loadLast = (): Last | null => {
  try {
    return JSON.parse(localStorage.getItem(LAST) ?? 'null') as Last | null;
  } catch {
    return null;
  }
};
const keepLast = (l: Last) => {
  try {
    localStorage.setItem(LAST, JSON.stringify(l));
  } catch {
    // kept for this visit only
  }
};

/** Something to say line by line: one of the learner's texts, the everyday phrases, or one of their own. */
interface Source {
  id: string;
  title: string;
  sub: string;
  phrases: Phrase[];
}

/**
 * Phrases: choose a text, then say it line by line — each line heard in a
 * narrator's voice, said, and scored by SpeechSuper or iFlytek, then on to the
 * next. Choosing and saying are two screens: the choice is a list of texts by
 * shelf, each with how far it has got; the saying is one line at a time with
 * the whole text's lines as a strip along the top, so it is always clear
 * where in the text you are and what comes next.
 */
export function PhrasesPage() {
  useTitle('Phrases');
  const lib = useLibrary();
  const texts = useStore((s) => s.texts);
  const sets = useStore((s) => s.sets);
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [own, setOwn] = useState<OwnTextDto[] | null>(null);
  // Which text is being said, and where, is in the address: /speaking/say/:source?line=3.
  const navigate = useNavigate();
  const { source: sourceParam } = useParams();
  const [search] = useSearchParams();
  const open: Last | null = sourceParam ? { sourceId: sourceParam, index: Math.max(0, Number(search.get('line') ?? 1) - 1 || 0) } : null;
  const done = search.get('done') === '1';
  const [attempts, setAttempts] = useState(loadAttempts);

  useEffect(() => {
    void evalStatus().then(setStatus, () => setStatus({ key: { set: false, hint: null, provider: null }, strictness: 'common' }));
    void ownTexts().then(setOwn, () => setOwn([]));
    // The account's tries, every device's, in place of this one's.
    void loadHistory().then((h) => {
      if (!h) return;
      const all = Object.fromEntries(Object.entries(h.phrases).map(([zh, list]) => [zh, list.map((x) => x.summary as Attempt)]));
      saveAttempts(all);
      setAttempts(all);
    });
  }, []);

  // The shelves as Read has them, chapters in reading order; the shelf read most lately first.
  const shelves = useMemo(() => {
    const source = (t: GeneratedText): Source => ({
      id: t.id,
      title: t.titleZh || t.title,
      sub: t.titleZh && t.title !== t.titleZh ? t.title : '',
      phrases: t.lines.map((l) => ({ zh: l.zh, py: l.py, en: l.en })),
    });
    const { bySet, loose } = shelve(
      texts.filter((t) => t.lines.length),
      sets,
    );
    const lately = (list: GeneratedText[]) => Math.max(...list.map((t) => t.lastReadAt ?? t.createdAt));
    const groups = sets
      .filter((x) => bySet.get(x.id)?.length)
      .map((x) => ({ name: x.name, at: lately(bySet.get(x.id)!), list: bySet.get(x.id)!.map(source) }));
    if (loose.length) groups.push({ name: 'Other texts', at: lately(loose), list: loose.map(source) });
    return groups.sort((x, y) => y.at - x.at);
  }, [texts, sets]);

  const everyday: Source = { id: 'everyday', title: 'Everyday phrases', sub: 'Twenty to start from: greetings, shopping, asking again', phrases: EVERYDAY };
  const owns = useMemo(
    (): Source[] => (own ?? []).map((t) => ({ id: `own:${t.id}`, title: t.title || 'Untitled', sub: 'From Voices', phrases: t.lines.map((zh) => ({ zh, py: pinyinOf(zh, lib), en: '' })) })),
    [own, lib],
  );
  const all = useMemo(() => [...shelves.flatMap((g) => g.list), everyday, ...owns], [shelves, owns]);
  const find = (id: string) => all.find((x) => x.id === id) ?? null;

  const best = (zh: string) => Math.max(-1, ...(attempts[zh] ?? []).map((a) => a.total));
  const progressOf = (src: Source) => {
    const scores = src.phrases.map((p) => best(p.zh)).filter((b) => b >= 0);
    return { said: scores.length, avg: scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : -1 };
  };

  function start(src: Source, at?: number) {
    const firstNew = src.phrases.findIndex((p) => !attempts[p.zh]?.length);
    const index = at ?? (firstNew >= 0 ? firstNew : 0);
    keepLast({ sourceId: src.id, index });
    navigate(paths.speakingSay(src.id, index), { replace: Boolean(open) });
  }

  if (status && !status.key.set) {
    if (open) return <Navigate to={paths.speaking()} replace />;
    return (
      <section className="ph">
        <div className="page-head">
          <h1>Phrases</h1>
        </div>
        <p className="small muted ph-lede">
          Choose a text and say it line by line: every syllable is scored — its initial, final and tone — with what to
          change. The scoring is SpeechSuper's or iFlytek's: add your keys once.
        </p>
        <PronunciationKey onChange={setStatus} />
      </section>
    );
  }

  const source = open ? find(open.sourceId) : null;
  if (open && !(source && source.phrases.length)) {
    // Its own texts come from the server: wait for them before saying it is gone.
    if (open.sourceId.startsWith('own:') && own === null) return null;
    return <Navigate to={paths.speaking()} replace />;
  }
  if (open && source) {
    const scores = source.phrases.map((p) => best(p.zh));
    const toTexts = () => navigate(paths.speaking());
    if (done) {
      return <Finished source={source} scores={scores} onAgain={(i) => start(source, i)} onBack={toTexts} />;
    }
    const index = Math.min(open.index, source.phrases.length - 1);
    const go = (i: number) => {
      keepLast({ sourceId: source.id, index: i });
      navigate(paths.speakingSay(source.id, i), { replace: true });
    };
    return (
      <PhraseView
        key={`${source.id}:${index}`}
        phrases={source.phrases}
        index={index}
        title={source.title}
        sourceId={source.id}
        lines={source.phrases.map((p) => p.zh)}
        scores={scores}
        tryAgain={attempts[source.phrases[index]!.zh] ?? []}
        onAttempt={(zh, a, r) => setAttempts(keepAttempt(zh, a, source.id, r))}
        onGo={go}
        onNext={() => (index + 1 < source.phrases.length ? go(index + 1) : navigate(`${paths.speakingSay(source.id)}?done=1`, { replace: true }))}
        onBack={toTexts}
      />
    );
  }

  const latest = Object.values(attempts)
    .map((list) => list[list.length - 1])
    .filter((a): a is Attempt => Boolean(a));
  const trouble = troubles(latest);
  const last = loadLast();
  const lastSource = last ? find(last.sourceId) : null;

  const row = (src: Source) => {
    const p = progressOf(src);
    return (
      <button key={src.id} className="ph-text" onClick={() => start(src)}>
        <span className="ph-text-name">
          <span className="hanzi ph-text-zh">{src.title}</span>
          <span className="tiny muted ph-text-sub">
            {src.phrases.length} lines{p.said ? ` · ${p.said} said` : ''}
            {src.sub ? ` · ${src.sub}` : ''}
          </span>
        </span>
        <span className="ph-score" data-band={p.avg < 0 ? 'none' : band(p.avg)}>
          {p.avg < 0 ? 'New' : Math.round(p.avg)}
        </span>
        <Icon name="chevron" className="muted" />
      </button>
    );
  };

  return (
    <section className="ph">
      <div className="page-head">
        <h1>Phrases</h1>
        <span className="spacer" />
        <Link className="btn quiet sm" to={paths.speakingHistory()}>
          Your tries
        </Link>
      </div>
      <p className="small muted ph-lede">Choose a text and say it line by line: each line is scored, then on to the next.</p>

      <div className="ph-columns">
        <div>
          {lastSource && last && (
            <section className="ph-continue">
              <span className="ph-text-name">
                <span className="small muted">Where you stopped</span>
                <span className="hanzi ph-text-zh">{lastSource.title}</span>
                <span className="tiny muted">
                  Line {Math.min(last.index, lastSource.phrases.length - 1) + 1} of {lastSource.phrases.length}
                </span>
              </span>
              <button className="btn primary" onClick={() => start(lastSource, Math.min(last.index, lastSource.phrases.length - 1))}>
                Carry on
              </button>
            </section>
          )}

          {shelves.map((g) => (
            <section key={g.name} className="block">
              <h2 className={`block-title${/\p{Script=Han}/u.test(g.name) ? ' hanzi ph-shelf' : ''}`}>{g.name}</h2>
              <div className="list">{g.list.map(row)}</div>
            </section>
          ))}

          <section className="block">
            <h2 className="block-title">Everyday</h2>
            <div className="list">{row(everyday)}</div>
          </section>

          <section className="block">
            <h2 className="block-title">Your own texts</h2>
            {owns.length ? (
              <div className="list">{owns.map(row)}</div>
            ) : (
              <p className="small muted">{own === null ? 'Getting your texts…' : 'None yet: write one in Voices, and a narrator reads it.'}</p>
            )}
          </section>
        </div>

        <aside className="block ph-aside">
          <h2 className="block-title">What keeps going wrong</h2>
          {trouble.length ? (
            <>
              <p className="small muted" style={{ margin: '0 0 8px' }}>
                From the last time you said each of {latest.length} line{latest.length === 1 ? '' : 's'}.
              </p>
              <ul className="list ph-trouble">
                {trouble.map((t) => (
                  <li key={t.kind} className="ph-trouble-row">
                    <span className="grow">
                      <b>{t.title}</b>
                      <span className="small muted">
                        <span className="hanzi">{t.chars.slice(0, 4).map((c) => `${c.char} ${partsOf(c.symbol).marked}`).join('  ')}</span> — {t.count} time{t.count === 1 ? '' : 's'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="small muted">Nothing yet: say a few lines and what keeps going wrong gathers here.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ a text finished */

function Finished({ source, scores, onAgain, onBack }: { source: Source; scores: number[]; onAgain: (i: number) => void; onBack: () => void }) {
  const said = scores.filter((x) => x >= 0);
  const avg = said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null;
  const weak = scores.findIndex((x) => x >= 0 && x < 75);
  return (
    <section className="ph">
      <button className="back-link" onClick={onBack}>
        <Icon name="back" /> Texts
      </button>
      <div className="page-head">
        <h1 className="hanzi ph-done-title">{source.title}</h1>
      </div>
      <p className="small muted ph-lede">
        {avg === null ? 'Nothing was scored this time.' : `To the end: ${said.length} of ${source.phrases.length} lines said, ${avg} on average.`}
      </p>
      <div className="list">
        {source.phrases.map((p, i) => (
          <button key={i} className="ph-text" onClick={() => onAgain(i)}>
            <span className="tiny muted ph-n">{i + 1}</span>
            <span className="ph-text-name">
              <span className="hanzi ph-line-zh">{p.zh}</span>
            </span>
            <span className="ph-score" data-band={scores[i]! < 0 ? 'none' : band(scores[i]!)}>
              {scores[i]! < 0 ? '–' : Math.round(scores[i]!)}
            </span>
          </button>
        ))}
      </div>
      <div className="page-foot ph-foot">
        {weak >= 0 && (
          <button className="btn primary lg" onClick={() => onAgain(weak)}>
            Say the weak lines again
          </button>
        )}
        <button className={`btn lg ${weak >= 0 ? 'tonal' : 'primary'}`} onClick={onBack}>
          Choose another text
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ one phrase */


function PhraseView({
  phrases,
  index,
  title,
  sourceId,
  lines,
  scores: lineScores,
  tryAgain,
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
  tryAgain: Attempt[];
  onAttempt: (zh: string, a: Attempt, r: EvalResult) => void;
  onGo: (i: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const lib = useLibrary();
  const phrase = phrases[index]!;
  const [result, setResult] = useState<EvalResult | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<Trouble | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [clips, setClips] = useState<Clips | null>(null);
  const [narrators, setNarrators] = useState<NarratorDto[] | null>(null);
  const [reading, setReading] = useState(false);
  const [readingFailed, setReadingFailed] = useState<string | null>(null);

  // The example: this phrase cut from a narrator's reading of the lines it is among.
  useEffect(() => {
    let live = true;
    void narratedReadings(lines).then(async (list) => {
      const c = chosenNarrator();
      const r = list.find((x) => x.n.narratorId === c) ?? list[0];
      if (r && live) setClips(await prepareClips(sourceId, r));
      else if (live) void listNarrators().then((n) => live && setNarrators(n), () => live && setNarrators([]));
    }, () => undefined);
    return () => {
      live = false;
      stopLine();
    };
    // By the lines' text, not the array: the parent makes a new one each render,
    // and every run stops what is playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.join('\n'), sourceId]);

  async function readThem() {
    const n = narrators?.find((x) => x.id === chosenNarrator()) ?? narrators?.[0];
    if (!n) return;
    setReading(true);
    setReadingFailed(null);
    try {
      const made = await narrationOf(n.id, lines, { generate: true });
      if (made) {
        const r = { n: made, name: n.name };
        addReading(lines, r);
        setClips(await prepareClips(sourceId, r));
      }
    } catch (err) {
      setReadingFailed(err instanceof Error ? err.message : 'MiniMax did not answer.');
    } finally {
      setReading(false);
    }
  }

  // Each character's reading, for the tiles and for the service.
  const readings = useMemo(() => alignPinyin({ zh: phrase.zh, py: phrase.py }, lib), [phrase, lib]);

  // Sends a recording to be scored; kept, so a failed one can be sent again without saying it again.
  function score(s: Float32Array) {
    setError(null);
    setNote(null);
    // Silence is not sent to be scored: it would come back as every syllable left out.
    if (!heardAnything(s)) {
      setNote(NOTHING_HEARD);
      return;
    }
    setChecking(true);
    setResult(null);
    evaluatePhrase(phrase.zh, s, numbered(readings))
      .then(
        (r) => {
          // Not the phrase at all is not a try at it: nothing marked, nothing counted.
          if (r.rejected) {
            setNote('That did not sound like this line. Hear it once more, then say all of it, close to the microphone.');
            return;
          }
          setResult(r);
          onAttempt(phrase.zh, attemptOf(r, Date.now()), r);
        },
        (err: unknown) => setError(troubleOf(err)),
      )
      .finally(() => setChecking(false));
  }

  const recorder = useRecorder((s) => {
    setSamples(s);
    score(s);
  }, 15_000);

  const state = checking ? 'checking' : recorder.state;
  const [slow, setSlow] = useState(false);
  const hear = () => clips && playLine(clips, index, slow ? 0.75 : 1);
  const last = index + 1 >= phrases.length;

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
        <button className="chip ph-slow" aria-pressed={slow} onClick={() => setSlow((x) => !x)} title="Hear it at three quarters of the speed">
          Slowly
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
        <ScoredLine zh={phrase.zh} en={phrase.en} readings={readings} result={result} samples={samples} tryAgain={tryAgain} scoring={checking}>
        {!clips && narrators !== null && (
          <p className="small muted ph-note">
            {narrators.length === 0 ? (
              'No narrator has read these yet. Make one in Voices, and it reads them for you to copy.'
            ) : (
              <>
                No narrator has read these yet.{' '}
                <button className="btn quiet sm" onClick={() => void readThem()} disabled={reading}>
                  {reading ? 'Reading… up to a minute' : `Have ${narrators.find((x) => x.id === chosenNarrator())?.name ?? narrators[0]!.name} read them`}
                </button>
              </>
            )}
            {readingFailed && <span className="ph-error"> {readingFailed}</span>}
          </p>
        )}
        {note && (
          <p className="small muted ph-note" role="status">
            {note}
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
              {error.retry && samples && (
                <button className="btn tonal sm" onClick={() => score(samples)} disabled={checking}>
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
        <RecordButton state={state} level={recorder.level} onToggle={recorder.toggle} compact />
        <button className="ph-dock-btn" onClick={() => samples && void playSamples(samples)} disabled={!samples}>
          <Icon name="play" />
          <span>Mine</span>
        </button>
        <button className="ph-dock-btn" data-go={result ? '' : undefined} onClick={onNext}>
          <Icon name="next" />
          <span>{last ? 'Done' : result ? 'Next' : 'Skip'}</span>
        </button>
      </footer>
    </section>
  );
}

