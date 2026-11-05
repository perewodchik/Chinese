import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AttemptOut, EvalResult } from '../../../shared/speechEval';
import { charBands, numbered, resultOfAttempt, troubles, type Attempt, type Phrase } from '../../domain/phrases';
import { alignPinyin } from '../../domain/reading';
import { recordingOf } from '../../platform/audio/recordings';
import { hush, playSamples } from '../../platform/audio/voiceOut';
import { Icon } from '../../ui/Icon';
import { useSheetDrag } from '../../ui/useSheetDrag';
import { useLibrary } from '../shared/library';
import { band, ScoredLine } from './ScoredLine';
import { knownTries, resultOf } from './speechHistory';
import { whenOf } from './when';
import './phrases.css';

/** One line's tries, oldest first, and what came of them. */
interface LineTries {
  list: AttemptOut[];
  best: AttemptOut | null;
  first: number | null;
}

const totalOf = (a: AttemptOut) => (a.summary as Attempt | null)?.total ?? null;

function triesOf(all: AttemptOut[], zh: string): LineTries {
  const list = all.filter((a) => a.text === zh && totalOf(a) !== null).sort((a, b) => a.at - b.at);
  const best = list.reduce<AttemptOut | null>((b, a) => (!b || totalOf(a)! > totalOf(b)! || (totalOf(a) === totalOf(b) && a.at > b.at) ? a : b), null);
  return { list, best, first: list[0] ? totalOf(list[0]) : null };
}

/**
 * A text, looked back on: how many of its lines were said and how well, a map
 * of the lines by their best, what goes wrong most in it, and every line with
 * each character coloured by its best try and a bar for each try. A line tapped
 * opens its tries on a sheet, for looking; a line not said yet is said. The one
 * action of the page is to go on: from the first line not said, or the weakest.
 */
export function TextReview({ title, sub, phrases, onSay, onBack }: { title: string; sub: string; phrases: Phrase[]; onSay: (i: number) => void; onBack: () => void }) {
  const lib = useLibrary();
  const [all, setAll] = useState<AttemptOut[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void knownTries('phrase').then((list) => live && setAll(list), () => live && setAll([]));
    return () => {
      live = false;
    };
  }, []);

  const readings = useMemo(() => phrases.map((p) => alignPinyin({ zh: p.zh, py: p.py }, lib)), [phrases, lib]);
  const lines = useMemo(() => phrases.map((p) => triesOf(all ?? [], p.zh)), [phrases, all]);
  const bests = lines.map((l) => (l.best ? totalOf(l.best)! : -1));
  const said = bests.filter((b) => b >= 0);
  const avg = said.length ? Math.round(said.reduce((a, b) => a + b, 0) / said.length) : null;
  const tryCount = lines.reduce((n, l) => n + l.list.length, 0);
  // Each line coloured by its best try: from its whole answer's summary, as the line screen draws it.
  const bands = useMemo(
    () => phrases.map((p, i) => (lines[i]!.best?.summary ? charBands(p.zh, resultOfAttempt(p.zh, numbered(readings[i]!), lines[i]!.best!.summary as Attempt)) : null)),
    [phrases, lines, readings],
  );
  // What goes wrong most, from each line's latest try: what is true of the text now.
  const faults = troubles(lines.flatMap((l) => (l.list.length ? [l.list[l.list.length - 1]!.summary as Attempt] : [])), 3);
  const linesWith = (kind: string) => lines.filter((l) => l.list.length && (l.list[l.list.length - 1]!.summary as Attempt).faults.some((f) => f.kind === kind)).length;

  const firstNew = bests.findIndex((b) => b < 0);
  const weakest = said.length ? bests.indexOf(Math.min(...said)) : 0;
  const tap = (i: number) => (lines[i]!.list.length ? setOpen(i) : onSay(i));

  return (
    <section className="ph ph-review">
      <button className="back-link" onClick={onBack}>
        <Icon name="back" /> Phrases
      </button>
      <div className="page-head">
        <h1 className="hanzi ph-done-title">{title}</h1>
      </div>
      {sub && <p className="small muted ph-lede">{sub}</p>}

      <div className="ph-review-stats">
        <span>
          <b>
            {said.length}
            <small> of {phrases.length}</small>
          </b>
          <span className="tiny muted">lines said</span>
        </span>
        <span>
          <b data-band={avg === null ? undefined : band(avg)}>{avg ?? '–'}</b>
          <span className="tiny muted">average of bests</span>
        </span>
        <span>
          <b>{all === null ? '…' : tryCount}</b>
          <span className="tiny muted">tries</span>
        </span>
      </div>

      <section className="block">
        <div className="block-head">
          <h2 className="block-title">Each line</h2>
          <span className="tiny muted">its best · tap to see its tries</span>
        </div>
        <div className="ph-map">
          {bests.map((b, i) => (
            <button key={i} className="ph-map-cell" data-band={b < 0 ? 'none' : band(b)} onClick={() => tap(i)} aria-label={`Line ${i + 1}, ${b < 0 ? 'not said yet' : `best ${Math.round(b)}`}`}>
              <span>{i + 1}</span>
              <b>{b < 0 ? '–' : Math.round(b)}</b>
            </button>
          ))}
        </div>
      </section>

      {faults.length > 0 && (
        <section className="block">
          <h2 className="block-title">What goes wrong most in this text</h2>
          <div className="list">
            {faults.map((f) => {
              const n = linesWith(f.kind);
              return (
                <div key={f.kind} className="ph-review-fault">
                  <b className="small">{f.title}</b>
                  <span className="small muted">
                    <span className="hanzi ph-review-fault-zh">{f.chars.slice(0, 5).map((c) => c.char).join(' ')}</span> · {f.count} time{f.count === 1 ? '' : 's'} in {n} line{n === 1 ? '' : 's'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="block">
        <h2 className="block-title">The lines</h2>
        <div className="list">
          {phrases.map((p, i) => {
            const l = lines[i]!;
            const b = bests[i]!;
            return (
              <button key={i} className="ph-review-line" onClick={() => tap(i)}>
                <span className="tiny muted ph-n">{i + 1}</span>
                <span className="ph-review-line-main">
                  <span className="hanzi ph-review-line-zh">
                    {[...p.zh].map((c, k) => (
                      <span key={k} data-band={bands[i]?.[k] ?? undefined}>
                        {c}
                      </span>
                    ))}
                  </span>
                  <span className="tiny muted ph-review-line-meta">
                    {l.list.length ? (
                      <>
                        {l.list.length} tr{l.list.length === 1 ? 'y' : 'ies'}
                        {l.list.length > 1 && l.first !== null ? ` · first ${Math.round(l.first)}` : ''}
                        <span className="ph-review-bars" aria-hidden>
                          {l.list.slice(-12).map((a) => {
                            const t = totalOf(a)!;
                            return <i key={a.id} data-band={band(t)} style={{ '--h': `${Math.max(3, (t / 100) * 14)}px` } as CSSProperties} />;
                          })}
                        </span>
                      </>
                    ) : (
                      'Not said yet'
                    )}
                  </span>
                </span>
                <span className="ph-score" data-band={b < 0 ? 'none' : band(b)}>
                  {b < 0 ? 'New' : Math.round(b)}
                </span>
                <Icon name="chevron" className="muted" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="page-foot ph-foot">
        {firstNew >= 0 ? (
          <button className="btn primary lg" onClick={() => onSay(firstNew)}>
            {firstNew === 0 ? 'Start from the first line' : `Go on from line ${firstNew + 1}`}
          </button>
        ) : (
          <button className="btn primary lg" onClick={() => onSay(weakest)}>
            Say line {weakest + 1} again, your weakest
          </button>
        )}
      </div>

      {open !== null && (
        <LineSheet key={open} zh={phrases[open]!.zh} en={phrases[open]!.en} readings={readings[open]!} index={open} count={phrases.length} tries={lines[open]!.list} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

/**
 * A line's tries, for looking: the line coloured by the try shown, which try it
 * is with your sound of it and the others a tap away, its score with how it went,
 * and every character. Its one action is Close.
 */
function LineSheet({ zh, en, readings, index, count, tries, onClose }: { zh: string; en?: string; readings: string[]; index: number; count: number; tries: AttemptOut[]; onClose: () => void }) {
  const sheet = useSheetDrag(onClose);
  const { close } = sheet;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const newest = useMemo(() => [...tries].sort((a, b) => b.at - a.at), [tries]);
  const best = useMemo(() => newest.reduce<AttemptOut | null>((b, a) => (!b || totalOf(a)! > totalOf(b)! ? a : b), null), [newest]);
  const [sel, setSel] = useState<string | null>(best?.id ?? null);
  const take = newest.find((a) => a.id === sel) ?? null;

  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!take) return;
    let live = true;
    const fromSummary = () => (take.summary ? resultOfAttempt(zh, numbered(readings), take.summary as Attempt) : null);
    setSamples(null);
    if (!take.full) setResult(fromSummary());
    else {
      setLoading(true);
      resultOf(take.id)
        .then((r) => live && setResult(r), () => live && setResult(fromSummary()))
        .finally(() => live && setLoading(false));
    }
    void recordingOf(take.id).then((s) => live && setSamples(s));
    return () => {
      live = false;
    };
  }, [take, zh, readings]);

  // Your sound of the try shown: Hear it, and Stop while it plays.
  const [playing, setPlaying] = useState(false);
  const turn = useRef(0);
  const hearIt = () => {
    hush();
    if (playing) return setPlaying(false);
    if (!samples) return;
    const n = ++turn.current;
    setPlaying(true);
    void playSamples(samples).finally(() => turn.current === n && setPlaying(false));
  };
  useEffect(() => () => hush(), []);
  useEffect(() => {
    hush();
    setPlaying(false);
  }, [sel]);

  const [listOpen, setListOpen] = useState(false);
  const what = take ? `${take.id === best?.id ? 'Best' : 'Try'} · ${whenOf(take.at, true)}` : '';

  return (
    <div className="drawer ph-sheet-drawer" data-leaving={sheet.leaving || undefined} onClick={close}>
      <div />
      <div className="sheet ph-char-sheet ph-line-sheet" role="dialog" aria-modal="true" aria-label={`Line ${index + 1}, your tries`} onClick={(e) => e.stopPropagation()} {...sheet.sheetProps}>
        <div className="sheet-head">
          <div className="grip" {...sheet.gripProps} aria-hidden="true">
            <span />
          </div>
          <p className="small muted ph-line-sheet-no">
            Line {index + 1} of {count}
          </p>
        </div>
        <div className="ph-say-body">
          <ScoredLine zh={zh} en={en} readings={readings} result={result} samples={samples} scoring={loading} tableScrolls={false}>
            <div className="ph-showing">
              <span className="small muted ph-showing-what">{what}</span>
              <button className="chip" onClick={hearIt} disabled={!samples} aria-pressed={playing} title={samples ? undefined : 'This device did not keep the sound of this try'}>
                <Icon name={playing ? 'stop' : 'play'} size={14} /> {playing ? 'Stop' : 'Hear it'}
              </button>
              <button className="btn quiet sm" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)}>
                Tries {newest.length} <Icon name="down" size={14} />
              </button>
              {listOpen && (
                <div className="ph-tries-box" role="dialog" aria-label="Your tries">
                  <div className="list ph-tries-list" role="group" aria-label="Your tries of this line">
                    {newest.map((a) => {
                      const t = totalOf(a)!;
                      return (
                        <div key={a.id} className="ph-try-mini" aria-current={sel === a.id || undefined}>
                          <button
                            className="ph-try-pick"
                            onClick={() => {
                              setSel(a.id);
                              setListOpen(false);
                            }}
                          >
                            <span className="small">{whenOf(a.at).replace(/^./, (c) => c.toUpperCase())}</span>
                            <span className="tiny muted">{a.id === best?.id ? 'best' : ''}</span>
                            <b data-band={band(t)}>{Math.round(t)}</b>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScoredLine>
        </div>
        <footer className="ph-sheet-foot-close">
          <button className="btn tonal lg" onClick={close}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
