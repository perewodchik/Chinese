import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  checkScore,
  KIND_LABEL,
  markKey,
  scoreLines,
  scoreOverall,
  spokenOf,
  summarise,
  type CheckSummary,
  type MistakeKind,
} from '../../domain/dictation';
import { lessonById } from '../../domain/pinyin/sounds';
import { RULE_NOTE } from '../../domain/pinyin/sandhi';
import { hanOf, MARK_WAYS, OVERALL, syllablesOf, type LineMark, type MarkWay, type SylMark } from '../../domain/video';
import { mistakesPrompt } from '../../domain/videoPrompt';
import { paths } from '../../navigation/paths';
import { saveAsk, saveCheck } from '../../store/videoCommands';
import { ClaudeBox } from './ClaudeBox';
import { useLearner } from './hooks';
import { useVideoCtx } from './context';

const WAY_KEY = 'hanzi.videos.markWay';
const readWay = (): MarkWay => {
  try {
    const w = localStorage.getItem(WAY_KEY);
    return MARK_WAYS.some((m) => m.id === w) ? (w as MarkWay) : 'detailed';
  } catch {
    return 'detailed';
  }
};

type Marks = Map<string, SylMark>;

/**
 * Checking the notebook against the video.
 *
 * The notebook stays the learner's: the app cannot see it, so the learner
 * does the comparing. The right pinyin is laid out line by line under the
 * notebook's numbers; a tap on a syllable says "I got this one wrong" and
 * turns it red, and — in the detailed way — a small box opens beside it for
 * what the notebook actually says. When the marking is finished, everything
 * not tapped turns green by itself. Nothing is typed but the mistakes.
 *
 * The box floats over the text, so opening it moves nothing; each syllable
 * keeps room under it for what was written, so filling that in moves nothing
 * either.
 */
export function CheckStep() {
  const { video: v, part, lines, go } = useVideoCtx();
  const learner = useLearner();
  const [way, setWayState] = useState<MarkWay>(readWay);
  const [marks, setMarks] = useState<Marks>(new Map());
  const [lineMarks, setLineMarks] = useState<Record<number, LineMark>>({});
  const [overall, setOverall] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showHan, setShowHan] = useState(true);
  const [showEn, setShowEn] = useState(false);

  // Another part, another sheet of marks.
  useEffect(() => {
    setMarks(new Map());
    setLineMarks({});
    setOverall(null);
    setOpen(null);
    setDone(false);
    setSavedId(null);
  }, [v.id, part]);

  function setWay(w: MarkWay) {
    setWayState(w);
    setOpen(null);
    setDone(false);
    setSavedId(null);
    try {
      localStorage.setItem(WAY_KEY, w);
    } catch {
      /* a per-device convenience; fine without */
    }
  }

  const markList = useMemo(() => [...marks.values()], [marks]);
  const summary = useMemo(() => (way === 'detailed' || way === 'quick' ? summarise(lines, markList) : null), [lines, markList, way]);
  const spoken = useMemo(() => lines.map(spokenOf), [lines]);

  function tapSyllable(line: number, syl: number) {
    if (done) return;
    const key = markKey({ line, syl });
    const next = new Map(marks);
    if (next.has(key)) {
      if (way === 'detailed' && open !== key) {
        setOpen(key);
        return;
      }
      next.delete(key);
      setOpen(null);
    } else {
      next.set(key, way === 'detailed' ? { line, syl, wrote: '' } : { line, syl });
      if (way === 'detailed') setOpen(key);
    }
    setMarks(next);
  }

  function tapLine(line: number) {
    if (done) return;
    const key = `${line}:*`;
    const next = new Map(marks);
    if (next.has(key)) next.delete(key);
    else next.set(key, { line, syl: 0, whole: true });
    setMarks(next);
    setOpen(null);
  }

  function addExtra(line: number) {
    if (done) return;
    const syl = syllablesOf(lines[line]!).length;
    const key = markKey({ line, syl, extra: true });
    const next = new Map(marks);
    next.set(key, { line, syl, extra: true, wrote: '' });
    setMarks(next);
    setOpen(way === 'detailed' ? key : null);
  }

  function write(key: string, wrote: string) {
    const m = marks.get(key);
    if (!m) return;
    const next = new Map(marks);
    next.set(key, { ...m, wrote });
    setMarks(next);
  }

  function remove(key: string) {
    const next = new Map(marks);
    next.delete(key);
    setMarks(next);
    setOpen(null);
  }

  function finish() {
    setOpen(null);
    setDone(true);
    let saved;
    if (way === 'detailed' || way === 'quick') {
      const s = summarise(lines, markList);
      const kept = markList.map((m) => (way === 'quick' ? { ...m, wrote: undefined } : m));
      saved = saveCheck(v.id, { part, way, total: s.total, right: s.right, marks: kept }, savedId ?? undefined);
    } else if (way === 'lines') {
      // As with syllables: a line not marked is a line that was right.
      const all: Record<number, LineMark> = Object.fromEntries(lines.map((_, i) => [i, lineMarks[i] ?? 'right']));
      setLineMarks(all);
      const s = scoreLines(lines, all);
      saved = saveCheck(v.id, { part, way, total: s.total, right: s.right, lines: all }, savedId ?? undefined);
    } else {
      const total = lines.reduce((n, l) => n + syllablesOf(l).length, 0);
      saved = saveCheck(v.id, { part, way, total, right: scoreOverall(total, overall ?? 0), overall: overall ?? 0 }, savedId ?? undefined);
    }
    setSavedId(saved.id);
  }

  const history = v.checks.filter((c) => c.part === part).sort((a, b) => a.at - b.at);

  return (
    <div className="video-step check-step">
      <div className="check-bar">
        <div className="chips" role="group" aria-label="How to mark">
          {MARK_WAYS.map((m) => (
            <button key={m.id} className="chip" aria-pressed={way === m.id} title={m.blurb} onClick={() => setWay(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {way !== 'overall' && (
          <div className="chips">
            <button className="chip" aria-pressed={showHan} onClick={() => setShowHan(!showHan)}>
              汉字
            </button>
            <button className="chip" aria-pressed={showEn} onClick={() => setShowEn(!showEn)}>
              English
            </button>
          </div>
        )}
      </div>
      <p className="tiny muted check-help">
        {done
          ? 'Green: right. Red: what you marked wrong.'
          : MARK_WAYS.find((m) => m.id === way)!.blurb +
            (way === 'detailed' ? ' Enter keeps it. Tap a line number if you missed the whole line; + adds a syllable you wrote that is not there.' : '') +
            (way === 'quick' ? ' Tap a line number if you missed the whole line.' : '')}
      </p>

      {(way === 'detailed' || way === 'quick') && (
        <ol className="check-lines" data-done={done || undefined}>
          {lines.map((line, i) => {
            const syl = syllablesOf(line);
            const han = hanOf(line.zh);
            const whole = marks.has(`${i}:*`);
            const extras = markList.filter((m) => m.extra && m.line === i);
            return (
              <li key={i} className="check-line" data-whole={whole || undefined}>
                <button className="check-n" aria-pressed={whole} onClick={() => tapLine(i)} title="Missed the whole line">
                  {i + 1}
                </button>
                <div className="check-body">
                  <div className="check-syls">
                    {syl.map((py, j) => {
                      const key = markKey({ line: i, syl: j });
                      const m = marks.get(key);
                      const verdict = summary?.verdicts.get(key);
                      const state = whole
                        ? 'wrong'
                        : sylState(!!m, done, verdict?.kinds ?? (m ? ['unknown'] : []), verdict?.sandhi);
                      const said = spoken[i]?.[j];
                      return (
                        <span key={j} className="syl-wrap">
                          <button
                            className="syl"
                            data-state={state}
                            aria-pressed={!!m}
                            onClick={() => tapSyllable(i, j)}
                            title={
                              state === 'sandhi' && verdict?.sandhi
                                ? `You wrote the tone that is said. ${RULE_NOTE[verdict.sandhi]}`
                                : verdict?.kinds.length
                                  ? verdict.kinds.map((k) => KIND_LABEL[k]).join(', ')
                                  : said?.rule
                                    ? RULE_NOTE[said.rule]
                                    : undefined
                            }
                          >
                            {showHan && <span className="syl-han hanzi">{han[j] ?? ''}</span>}
                            <span className="syl-py">{py}</span>
                            <span className="syl-wrote">{m?.wrote ? m.wrote : m && way === 'detailed' && m.wrote === '' && open !== key ? '—' : ' '}</span>
                          </button>
                          {open === key && m && (
                            <WrotePopover
                              value={m.wrote ?? ''}
                              want={py}
                              onChange={(w) => write(key, w)}
                              onClose={() => setOpen(null)}
                              onClear={() => remove(key)}
                            />
                          )}
                        </span>
                      );
                    })}
                    {extras.map((m) => {
                      const key = markKey(m);
                      return (
                        <span key={key} className="syl-wrap">
                          <button className="syl" data-state="wrong" data-extra onClick={() => (done ? undefined : setOpen(key))}>
                            {showHan && <span className="syl-han hanzi">&nbsp;</span>}
                            <span className="syl-py">+</span>
                            <span className="syl-wrote">{m.wrote || ' '}</span>
                          </button>
                          {open === key && (
                            <WrotePopover
                              value={m.wrote ?? ''}
                              want="something not in the video"
                              onChange={(w) => write(key, w)}
                              onClose={() => setOpen(null)}
                              onClear={() => remove(key)}
                            />
                          )}
                        </span>
                      );
                    })}
                    {!done && (
                      <button className="syl-extra" onClick={() => addExtra(i)} title="I wrote a syllable that is not there">
                        +
                      </button>
                    )}
                  </div>
                  {showEn && line.en && <p className="tiny muted check-en">{line.en}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {way === 'lines' && (
        <ol className="check-lines check-by-line" data-done={done || undefined}>
          {lines.map((line, i) => {
            const m = lineMarks[i] ?? (done ? 'right' : undefined);
            return (
              <li key={i} className="check-line" data-state={m}>
                <span className="check-n">{i + 1}</span>
                <div className="check-body">
                  {showHan && <span className="hanzi check-zh">{line.zh}</span>}
                  <span className="check-py">{line.py}</span>
                  {showEn && line.en && <span className="tiny muted">{line.en}</span>}
                </div>
                <div className="line-marks" role="group" aria-label={`Line ${i + 1}`}>
                  {(['right', 'close', 'wrong'] as const).map((k) => (
                    <button
                      key={k}
                      data-mark={k}
                      aria-pressed={lineMarks[i] === k}
                      disabled={done}
                      onClick={() => setLineMarks((prev) => ({ ...prev, [i]: k }))}
                      aria-label={k === 'right' ? 'Right' : k === 'close' ? 'Nearly' : 'Wrong'}
                    >
                      {k === 'right' ? '✓' : k === 'close' ? '~' : '✗'}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {way === 'overall' && (
        <div className="overall-marks" role="group" aria-label="How much you got">
          <p className="small" style={{ margin: '0 0 8px' }}>
            How much of part {part + 1} ({lines.length} lines) did you get right in the notebook?
          </p>
          {OVERALL.map((o) => (
            <button key={o.id} className="btn" aria-pressed={overall === o.id} disabled={done} onClick={() => setOverall(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="row video-actions">
        {!done ? (
          <button className="btn primary" disabled={way === 'overall' && overall === null} onClick={finish}>
            Done marking
          </button>
        ) : (
          <button
            className="btn"
            onClick={() => {
              setDone(false);
            }}
          >
            Change my marks
          </button>
        )}
        <span className="tiny muted">
          {done ? 'Saved.' : way === 'detailed' || way === 'quick' ? `${markList.filter((m) => !m.extra).length} marked wrong` : ''}
        </span>
      </div>

      {done && summary && <Summary s={summary} />}
      {done && way === 'lines' && <p className="small">{scoreText(scoreLines(lines, lineMarks))}</p>}
      {done && way === 'overall' && overall !== null && (
        <p className="small">
          Kept as <b>{OVERALL.find((o) => o.id === overall)!.label.toLowerCase()}</b>. A detailed check says which sounds went
          wrong; this one keeps the day and the trend.
        </p>
      )}

      {done && way === 'detailed' && markList.length > 0 && (
        <div className="card">
          <header>
            <h2>Why these mistakes?</h2>
          </header>
          <div className="body">
            <ClaudeBox
              kind="check"
              label="Ask Claude about my mistakes"
              what="an answer"
              prompt={() => mistakesPrompt(v, part, markList, learner)}
              onAnswer={(a) => {
                saveAsk(v.id, part, 'What is the pattern in my notebook mistakes?', a.trim());
                go('ask');
                return null;
              }}
            />
          </div>
        </div>
      )}

      {done && (
        <p className="small">
          Next: <button className="line-ref" onClick={() => go('words')}>take the new words</button>, or{' '}
          <button className="line-ref" onClick={() => go('study')}>see what Claude made of it</button>.
        </p>
      )}

      {history.length > 0 && (
        <div className="check-history">
          <h2 className="videos-label">Checks of this part</h2>
          <ul>
            {history.map((c, k) => (
              <li key={c.id}>
                <span className="tiny muted">{new Date(c.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                <span className="small">{MARK_WAYS.find((m) => m.id === c.way)?.label}</span>
                <span className="check-history-bar">
                  <i style={{ width: `${Math.round(checkScore(c) * 100)}%` }} />
                </span>
                <b className="small">{Math.round(checkScore(c) * 100)}%</b>
                {k === 0 && history.length > 1 && <span className="tiny muted">first</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function sylState(marked: boolean, done: boolean, kinds: MistakeKind[], sandhi?: string) {
  if (!done) return marked ? 'wrong' : undefined;
  if (!marked) return 'right';
  if (!kinds.length) return sandhi ? 'sandhi' : 'right';
  return 'wrong';
}

const scoreText = (s: { total: number; right: number }) =>
  `${s.right} of ${s.total} syllables right — ${s.total ? Math.round((s.right / s.total) * 100) : 0}%.`;

function Summary({ s }: { s: CheckSummary }) {
  const kinds = (Object.keys(s.counts) as MistakeKind[]).filter((k) => s.counts[k] > 0);
  return (
    <div className="card check-summary">
      <div className="body">
        <p className="check-score">
          <b>{Math.round(s.score * 100)}%</b>
          <span className="small muted">
            {s.right} of {s.total} syllables right · {s.soundsRight} right apart from the tone
          </span>
        </p>
        {kinds.length > 0 && (
          <p className="small" style={{ margin: '4px 0' }}>
            {kinds.map((k) => `${s.counts[k]} ${KIND_LABEL[k]}`).join(' · ')}
          </p>
        )}
        {s.sandhi > 0 && (
          <p className="tiny muted" style={{ margin: '4px 0' }}>
            {s.sandhi} tone{s.sandhi === 1 ? '' : 's'} written as {s.sandhi === 1 ? 'it is' : 'they are'} said rather than as the
            dictionary prints {s.sandhi === 1 ? 'it' : 'them'} — counted right (shown grey).
          </p>
        )}
        {s.confusions.length > 0 && (
          <ul className="confusions">
            {s.confusions.map((c) => {
              const lesson = c.lesson ? lessonById(c.lesson) : null;
              return (
                <li key={c.key}>
                  <span className="small">
                    {c.label}
                    {c.count > 1 ? ` ×${c.count}` : ''}
                  </span>
                  {lesson && (
                    <Link className="btn sm ghost" to={paths.speakingSounds(lesson.id, 'hear')}>
                      Practise {lesson.mark}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * The small box beside a red syllable: what the notebook says. It floats, so
 * the lines under it stay where they are, and it is nudged sideways to stay
 * on a narrow screen.
 */
function WrotePopover({
  value,
  want,
  onChange,
  onClose,
  onClear,
}: {
  value: string;
  want: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    if (r.left < margin) setShift(margin - r.left);
    else if (r.right > window.innerWidth - margin) setShift(window.innerWidth - margin - r.right);
    input.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="syl-pop" ref={box} style={{ ['--shift' as string]: `${shift}px` }} role="dialog" aria-label="What did you write?">
      <label className="tiny muted" htmlFor="syl-pop-input">
        You wrote, for <b>{want}</b>:
      </label>
      <div className="syl-pop-row">
        <input
          id="syl-pop-input"
          ref={input}
          type="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. ji4"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <button className="btn sm primary" onClick={onClose}>
          OK
        </button>
      </div>
      <button className="syl-pop-clear tiny" onClick={onClear}>
        It was right after all
      </button>
    </div>
  );
}
